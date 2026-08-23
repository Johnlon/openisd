/**
 * `ManagedOpenISDProject` — the one facade over every state layer of ONE project.
 *
 * A user does not explore "a what-if driver". They explore a DESIGN: a driver in a box, with a
 * vent or a radiator, at a drive level, in an environment. Scrubbing `Vb` and scrubbing `Qts`
 * are the same act, so the overlay wraps the whole PROJECT and not one part of it.
 *
 * This is the domain object for ONE project in the left nav. It holds three complete
 * `_OpenISDProjectJson`s:
 *
 *   ground     — the design exactly as loaded. What Reset goes back to.
 *   committed  — the design as it stands. What the charts draw and a save writes.
 *   overlay    — a what-if over committed state, open at most one at a time.
 *
 * ── `_OpenISDProjectJson` is PRIVATE ──
 * No instance of one ever leaves, and nor does the live `OpenISDDriver` inside it. A caller
 * reads with `cell()`/`metaCell()`/`toEngineDriver()`/`errors()`/`_snapshot()` and writes with
 * `enter()`/`clear()`/`mutate()`. Handing the project out would let a caller change it behind
 * the facade — with no notification and no what-if guard — which is precisely what this class
 * exists to make impossible.
 *
 * ── Subscription: every public mutator notifies (`docs/design/REACTIVITY.md`) ──
 * Every change re-fires immediately, whether it lands on committed state or a live what-if —
 * `mutate()` and the four driver methods (`enter`/`clear`/`enterMeta`/`clearMeta`) call
 * `#notify()` unconditionally. `beginWhatIf()`/`cancelWhatIf()` notify too: they change which
 * layer is effective.
 *
 * ── A what-if never leaks into anything persistent ──
 * Its values are unverified against physical reality, so nothing outside the live overlay may
 * see them. `_recordToPersist()` — the ONLY route to a savable project — cancels an active
 * what-if itself. That is structural, not a rule call sites must remember: the defect it
 * replaces was a per-call-site guard that `shareLink()` was missing while every sibling had it.
 *
 * ── One object graph, no synchronisation ──
 * `OpenISDDriver.fromJsonRecord()` holds its record BY REFERENCE and mutates it in place, so a
 * layer's `project.driver` record and its live driver are the same object. A write through the
 * driver is already in the project; there is no copy to keep in step, and therefore no way for
 * the two to disagree.
 */
import { OpenISDDriver, OpenISDProject, Provenance, driverRecordProblems } from '@openisd/model';
import type { ProjectFieldId } from '@openisd/model';
import type {
  Cell, MetaCell, SpecField, MetaField,
  OpenISDVent, OpenISDPassiveRadiatorRef, AlignmentKind, OpenISDProjectMeta,
} from '@openisd/model';
import { winisdTextToBytes } from '@openisd/winisd';
import type { DriverError, ConsistencyIssue, EngineDriver as EngineDriver, Filter, Result, SweepResult } from '@openisd/engine';
import {
  sealedResonance as computeSealedResonance, sourceLoadedQts, prTuning as computePrTuning,
  moistAirSoundVelocity, T_REF_K, RH_REF_PCT, P_REF_PA,
  driveVoltage,
} from '@openisd/engine';
import type { LossMode, BoxType } from '@openisd/engine';
import { decodeDriverFileBytes } from './driverFileText.js';
import { ProjectFileFormat } from '../fileFormat.js';
import type { UiParams } from '../types.js';

type ManagedOpenISDProjectListener = () => void;

/** `BoxType` (@openisd/engine) and `AlignmentKind` (@openisd/model) name the same four
 *  alignments and spell one of them differently — `'pr'` vs `'passive-radiator'`. Both types
 *  are used pervasively under their own names elsewhere, so this is a translation at the one
 *  seam that needs it, not a rename of either. */
/** The one alignment the two vocabularies spell differently. `satisfies` keeps the literal
 *  type — a widened `AlignmentKind` annotation would stop the narrowing the two translations
 *  below depend on — while still checking it IS an `AlignmentKind`. */
const PR_ALIGNMENT = 'passive-radiator' satisfies AlignmentKind;

export function toAlignmentKind(box: BoxType): AlignmentKind {
  return box === 'pr' ? PR_ALIGNMENT : box;
}
export function fromAlignmentKind(active: AlignmentKind): BoxType {
  return active === PR_ALIGNMENT ? 'pr' : active;
}

/** One state layer: the project, and the live driver over its record. `openIsdDriver` is
 *  materialised from `project.driverText()` and re-materialised on every `mutate()` —
 *  `ManagedOpenISDProject` is the one file, by architecture rule, that constructs an
 *  `OpenISDDriver`; `OpenISDProject` itself holds only the record. */
interface Layer {
  project: OpenISDProject;
  /** Null exactly when no driver has been chosen. */
  openIsdDriver: OpenISDDriver | null;
}

type Overlay =
  | { kind: 'whatif'; layer: Layer };

/** A layer over `project`, with its live driver materialised from the project's own record. */
function layerOf(project: OpenISDProject): Layer {
  const text = project.driverText();
  return { project, openIsdDriver: text ? OpenISDDriver.fromOwdrText(text) : null };
}

/** An independent copy of a layer — `OpenISDProject.copy()` clones the record and hands back a
 *  new facade over it; the live driver is re-materialised over that clone's own record. */
function cloneLayer(layer: Layer): Layer {
  return layerOf(layer.project.copy());
}

export class ManagedOpenISDProject {
  #ground: Layer;
  #committed: Layer;
  #overlay: Overlay | null = null;
  readonly #listeners = new Set<ManagedOpenISDProjectListener>();

  private constructor(ground: Layer, committed: Layer) {
    this.#ground = ground;
    this.#committed = committed;
  }

  /** Adopt `project` as freshly loaded: ground and committed become independent copies of it. */
  static fromProject(project: OpenISDProject): ManagedOpenISDProject {
    return new ManagedOpenISDProject(layerOf(project.copy()), layerOf(project.copy()));
  }

  /** A project with nothing chosen. */
  static createEmpty(): ManagedOpenISDProject {
    return ManagedOpenISDProject.fromProject(OpenISDProject.empty());
  }

  // ---- which layer is effective ---------------------------------------------------------

  /** PRIVATE. The open overlay if there is one, else committed. Never leaves this class. */
  #effective(): Layer {
    if (this.#overlay) return this.#overlay.layer;
    return this.#committed;
  }

  // ---- driver reads, on the EFFECTIVE layer ----------------------------------------------

  /** One driver field's value and its provenance. Absent when no driver is chosen: that is a
   *  real answer, and inventing a zero would be indistinguishable from a measured one. */
  cell(field: SpecField): Cell {
    return this.#effective().openIsdDriver?.cell(field)
      ?? { value: null, state: Provenance.NotAvailable };
  }
  /** One driver metadata field (brand/model/manufacturer/provided_by/comment/added). */
  metaCell(field: MetaField): MetaCell {
    return this.#effective().openIsdDriver?.metaCell(field)
      ?? { value: '', state: Provenance.NotAvailable };
  }
  /** The resolved, engine-ready driver the charts sweep, or null when nothing can be drawn. */
  toEngineDriver(): EngineDriver | null {
    return this.#effective().openIsdDriver?.toDriver() ?? null;
  }
  /** What the engine says stops this driver simulating. */
  errors(): DriverError[] {
    return this.#effective().openIsdDriver?.errors() ?? [];
  }
  /** Stated fields that contradict each other beyond their own precision. */
  consistencyIssues(): ConsistencyIssue[] {
    return this.#effective().openIsdDriver?.consistencyIssues() ?? [];
  }
  /** Whether a driver has been chosen at all. */
  hasDriver(): boolean { return this.#effective().openIsdDriver !== null; }

  // ---- driver writes, on the EFFECTIVE layer ---------------------------------------------

  // Every public mutator notifies unconditionally (`docs/design/REACTIVITY.md`) — no mode guard.
  // A driver-field edit is not bridged through the driver's OWN `#notify()`: that channel would
  // need re-subscribing every time `mutate()` re-materialises the effective layer's
  // `OpenISDDriver` (any box/vent/PR edit does), which is exactly what silently dropped
  // notifications for `BUG_20260821_whatif_bridge_detaches_when_mutate_rematerialises_the_driver.md`.
  // Calling `this.#notify()` here directly needs no such subscription and cannot go stale.

  enter(field: SpecField, value: number): void {
    this.#effective().openIsdDriver?.enter(field, value);
    this.#notify();
  }
  clear(field: SpecField): void {
    this.#effective().openIsdDriver?.clear(field);
    this.#notify();
  }
  enterMeta(field: MetaField, value: string): void {
    this.#effective().openIsdDriver?.enterMeta(field, value);
    this.#notify();
  }
  clearMeta(field: MetaField): void {
    this.#effective().openIsdDriver?.clearMeta(field);
    this.#notify();
  }

  // ---- box / vent / PR flat-field accessors, ledger QO54 ---------------------------------
  //
  // The box IS the storage: every caller reads and writes these fields through the methods
  // below, directly, reactive via `logic/liveProject.ts`'s change-notification adapter. Reads
  // go straight to the effective layer (no clone: these are read on every reactive tick);
  // writes go through `mutate()` so the existing edit/what-if notification rule keeps applying
  // with no second code path to keep in step.

  boxVolume_m3(): number { return this.#effective().project.volume_m3(); }
  setBoxVolume_m3(value: number): void {
    this.mutate(p => p.setVolume_m3(value));
  }

  boxTuning_Fb_hz(): number { return this.#effective().project.tuning_Fb_hz(); }
  setBoxTuning_Fb_hz(value: number): void {
    this.mutate(p => p.setTuning_Fb_hz(value));
  }

  /** `Vf` — bandpass4's OWN front-chamber volume. Unconditional: unlike `Vb`, this never
   *  addresses another alignment's storage, dormant or active — there is only one home. */
  frontVolume_m3(): number { return this.#effective().project.frontVolume_m3(); }

  // ── Project field cells — value + provenance, owned and solved by the domain object ──────
  projectCell(field: ProjectFieldId): { value: number; state: Provenance } {
    return this.#effective().project.cell(field);
  }
  enterProjectField(field: ProjectFieldId, value: number): void {
    this.mutate(p => p.enter(field, value));
  }
  clearProjectField(field: ProjectFieldId): void {
    this.mutate(p => p.clear(field));
  }
  solveVentGroup(): void { this.mutate(p => p.solveVentGroup()); }
  solvePrGroup(): void { this.mutate(p => p.solvePrGroup()); }
  ventAchievedFb(): number | null { return this.#effective().project.ventAchievedFb(); }
  ventMaxReachableFb(): number | null { return this.#effective().project.ventMaxReachableFb(); }
  ventTargetUnreachable(): boolean { return this.#effective().project.ventTargetUnreachable(); }
  prTargetUnreachable(): boolean { return this.#effective().project.prTargetUnreachable(); }
  setFrontVolume_m3(value: number): void {
    this.mutate(p => p.setFrontVolume_m3(value));
  }

  activeVentField<K extends keyof OpenISDVent>(field: K): OpenISDVent[K] {
    return this.#effective().project.ventField(field);
  }
  setActiveVentField<K extends keyof OpenISDVent>(field: K, value: OpenISDVent[K]): void {
    this.mutate(p => p.setVentField(field, value));
  }

  /** The active vent's cross-sectional area — round or slotted, whichever it currently is.
   *  A calculated value, exposed here (not computed by any caller) per ARCHITECTURE.md §5
   *  "only the domain objects calculate". */
  ventArea_m2(): number {
    return this.#effective().project.cell('Sp').value;
  }

  /** The active vent's effective acoustic length — physical length plus the end-correction
   *  term, which needs an equivalent diameter for a slotted vent (derived from its area) since
   *  the correction is inherently a round-port concept. Calculated here, not by any caller. */
  ventEffectiveLength_m(): number {
    return this.#effective().project.ventEffectiveLength_m();
  }

  /** Drive voltage from the project's input power and the EFFECTIVE driver's Re — V = √(Pin·Re),
   *  WinISD's reference-power convention (`bugs/BUG_20260820_syncedp_computes_eg_inside_the_store.md`,
   *  the fix this getter IS: the formula lives in `@openisd/engine`, read here, never
   *  recomputed at a call site). 1 Ω assumed until a driver is chosen, matching historic
   *  behaviour. */
  driveVoltage_V(): number {
    return driveVoltage(this.inputPower_W(), this.toEngineDriver()?.Re ?? 1);
  }

  /** Sealed-box (and PR rear-chamber) resonance + system Q via the given loss model. `Rs`/`Ql`/
   *  `Qa` are not yet fields of `_OpenISDProjectJson` (they live on `UiParams` today), so they
   *  are taken as parameters rather than read internally — same shape as `sealedFc`'s own
   *  decoupling in `wprMapping.ts`. Null when no driver is chosen or `Vb` isn't set. */
  sealedResonance(lossMode: LossMode, Rs: number, Ql: number, Qa: number): { Fsc: number; Qtc: number } | null {
    const d = this.toEngineDriver();
    const Vb = this.boxVolume_m3();
    if (!d || !(Vb > 0)) return null;
    const qts = sourceLoadedQts(d.Qms, d.Qes, d.Re, Rs, d.Qts);
    return computeSealedResonance(lossMode, { Fs: d.Fs, Vas: d.Vas, Qts: qts, Vb, Ql, Qa });
  }

  /** WinISD's "Fh" for a PR box: the passive-radiator system tuning, distinct from the sealed
   *  resonance above (which ignores the PR entirely). Null until Vb/prSd/prCms are all set. */
  prSystemTuning_hz(): number | null {
    const Vb = this.boxVolume_m3();
    const prSd = this.prField('Sd_m2');
    const prCms = this.prField('Cms_m_per_N');
    if (!(Vb > 0) || !(prSd > 0) || !(prCms > 0)) return null;
    return computePrTuning({
      Vb, prSd, prCms,
      prMmd: this.prField('Mmd_kg'), prMadd: this.prAddedMass_kg(),
    });
  }

  /** First port (organ-pipe) resonance of the vent tube itself — the open-open duct
   *  fundamental c/(2·L) on the PHYSICAL vent length, distinct from the box Helmholtz tuning. */
  portPipeResonance_hz(): number | null {
    const ventL = this.activeVentField('length_m');
    return ventL > 0 ? moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA) / (2 * ventL) : null;
  }

  /** Passive-radiator derived T/S params, from the stored PR bag. */
  /** Adopt a radiator from its datasheet vocabulary — the one conversion, on the owner. */
  enterPrDatasheet(d: { vasL: number; fsHz: number; qms: number; sdM2: number; xmaxM?: number }): void {
    this.mutate(p => p.enterPrDatasheet(d));
  }

  prField<K extends keyof OpenISDPassiveRadiatorRef>(field: K): OpenISDPassiveRadiatorRef[K] {
    return this.#effective().project.prField(field);
  }
  setPrField<K extends keyof OpenISDPassiveRadiatorRef>(field: K, value: OpenISDPassiveRadiatorRef[K]): void {
    this.mutate(p => p.setPrField(field, value));
  }

  prCount(): number { return this.#effective().project.prCount(); }
  setPrCount(value: number): void { this.mutate(p => p.setPrCount(value)); }

  prAddedMass_kg(): number { return this.#effective().project.prAddedMass_kg(); }
  setPrAddedMass_kg(value: number): void {
    this.mutate(p => p.setPrAddedMass_kg(value));
  }

  prFp_hz(): number { return this.#effective().project.prFp_hz(); }
  setPrFp_hz(value: number): void { this.mutate(p => p.setPrFp_hz(value)); }

  // ---- box loss factors (leakage/absorption/port), shared by every alignment ------------

  boxQl(): number { return this.#effective().project.loss('Ql'); }
  setBoxQl(value: number): void { this.mutate(p => p.setLoss('Ql', value)); }
  boxQa(): number { return this.#effective().project.loss('Qa'); }
  setBoxQa(value: number): void { this.mutate(p => p.setLoss('Qa', value)); }
  boxQp(): number { return this.#effective().project.loss('Qp'); }
  setBoxQp(value: number): void { this.mutate(p => p.setLoss('Qp', value)); }

  // ---- environment ------------------------------------------------------------------------

  envTempK(): number { return this.#effective().project.cell('advTemp').value; }
  setEnvTempK(value: number): void { this.mutate(p => p.enter('advTemp', value)); }
  envHumidityPct(): number { return this.#effective().project.cell('advHumidity').value; }
  setEnvHumidityPct(value: number): void { this.mutate(p => p.enter('advHumidity', value)); }
  envPressurePa(): number { return this.#effective().project.cell('advPressure').value; }
  setEnvPressurePa(value: number): void { this.mutate(p => p.enter('advPressure', value)); }
  envIgnoreHumidityAndPressure(): boolean {
    return this.#effective().project.ignoreHumidityAndPressure();
  }
  setEnvIgnoreHumidityAndPressure(value: boolean): void {
    this.mutate(p => p.setIgnoreHumidityAndPressure(value));
  }

  // ---- signal ------------------------------------------------------------------------------

  driverCount(): number { return this.#effective().project.cell('nDrivers').value; }
  setDriverCount(value: number): void { this.mutate(p => p.enter('nDrivers', value)); }
  wiring(): 'series' | 'parallel' { return this.#effective().project.wiring(); }
  setWiring(value: 'series' | 'parallel'): void { this.mutate(p => p.setWiring(value)); }
  inputPower_W(): number { return this.#effective().project.cell('Pin').value; }
  setInputPower_W(value: number): void { this.mutate(p => p.enter('Pin', value)); }
  seriesResistance_ohm(): number { return this.#effective().project.cell('Rs').value; }
  setSeriesResistance_ohm(value: number): void {
    this.mutate(p => p.enter('Rs', value));
  }
  rgAtDriverSide(): boolean { return this.#effective().project.rgAtDriverSide(); }
  setRgAtDriverSide(value: boolean): void { this.mutate(p => p.setRgAtDriverSide(value)); }

  // ---- simulation options (WinISD Advanced pane) -------------------------------------------

  circuitModel(): 'winisd' | 'gyrator' { return this.#effective().project.circuitModel(); }
  setCircuitModel(value: 'winisd' | 'gyrator'): void {
    this.mutate(p => p.setCircuitModel(value));
  }
  tlPortModel(): boolean { return this.#effective().project.tlPortModel(); }
  setTlPortModel(value: boolean): void { this.mutate(p => p.setTlPortModel(value)); }
  forceFlatResponse(): boolean { return this.#effective().project.forceFlatResponse(); }
  setForceFlatResponse(value: boolean): void {
    this.mutate(p => p.setForceFlatResponse(value));
  }
  splXmaxLimited(): boolean { return this.#effective().project.splXmaxLimited(); }
  setSplXmaxLimited(value: boolean): void { this.mutate(p => p.setSplXmaxLimited(value)); }
  vcTempRise(): number { return this.#effective().project.cell('vcTempRise').value; }
  setVcTempRise(value: number): void { this.mutate(p => p.enter('vcTempRise', value)); }
  alfaVC(): number { return this.#effective().project.alfaVC(); }
  setAlfaVC(value: number): void { this.mutate(p => p.setAlfaVC(value)); }
  driverAddedMass(): number { return this.#effective().project.cell('driverAddedMass').value; }
  setDriverAddedMass(value: number): void {
    this.mutate(p => p.enter('driverAddedMass', value));
  }

  // ---- sweep range ---------------------------------------------------------------------------

  sweepFmin_hz(): number { return this.#effective().project.sweepFmin_hz(); }
  setSweepFmin_hz(value: number): void { this.mutate(p => p.setSweepFmin_hz(value)); }
  sweepFmax_hz(): number { return this.#effective().project.sweepFmax_hz(); }
  setSweepFmax_hz(value: number): void { this.mutate(p => p.setSweepFmax_hz(value)); }
  sweepPoints(): number { return this.#effective().project.sweepPoints(); }
  setSweepPoints(value: number): void { this.mutate(p => p.setSweepPoints(value)); }

  // ---- filters (parametric EQ chain) ----------------------------------------------------------

  /** A COPY of the filter chain — mutate it and call `setFilters()` to write it back, same
   *  copy-out/write-back discipline as `_snapshot()`. Prefer `addFilter`/`removeFilter`/
   *  `setFilter(id, patch)` below for a single-filter change: this whole-array setter is for a
   *  caller legitimately replacing the WHOLE chain (a project restore), not a per-keystroke
   *  edit — a UI editing ONE filter's ONE field through a read-modify-write of this copy risks
   *  losing a concurrent write to a DIFFERENT filter (or from a project reset) that lands
   *  between the read and the write. */
  filters(): Filter[] { return this.#effective().project.filters(); }
  setFilters(value: Filter[]): void {
    this.mutate(p => p.setFilters(value));
  }

  /** Append one filter to the chain. */
  addFilter(filter: Filter): void {
    this.mutate(p => p.setFilters([...p.filters(), filter]));
  }

  /** Patch one filter's fields by id — the narrow write a per-field UI control makes, so a
   *  keystroke never has to read-modify-write a copy of the WHOLE chain. A no-op if `id` names
   *  no filter (never fabricates one). */
  setFilter(id: string, patch: Partial<Filter>): void {
    this.mutate(p => {
      p.setFilters(p.filters().map(f => (f.id === id ? { ...f, ...patch } : f)));
    });
  }

  /** Drop the filter with the given id. A no-op if `id` names no filter. */
  removeFilter(id: string): void {
    this.mutate(p => p.setFilters(p.filters().filter(f => f.id !== id)));
  }

  /** Which alignment is active, in the domain's own vocabulary (`'passive-radiator'`, not
   *  `UiParams`'s `'pr'`). */
  activeAlignment(): AlignmentKind { return this.#effective().project.activeAlignment(); }
  setActiveAlignment(value: AlignmentKind): void {
    this.mutate(p => p.setAlignment(value));
  }

  // ---- entered-set (target provenance), ledger QO54 --------------------------------------
  //
  // Which box/vent/PR fields the user entered, one home: `_OpenISDProjectJson.target.entered`.

  isEntered(field: string): boolean {
    return this.#effective().project.isEntered(field);
  }
  setEntered(field: string, value: boolean): void {
    this.mutate(p => p.setEntered(field, value));
  }

  /** The whole entered set, as a COPY — for a caller that needs every key at once (a
   *  serialised snapshot), not one field's provenance. */
  enteredSet(): Record<string, true> { return this.#effective().project.enteredSet(); }

  /** Replace the WHOLE entered set in one mutation — clears every currently-true key, then
   *  applies `value`. For a caller adopting a whole provenance snapshot at once (a test
   *  fixture, a restore); a single-field edit uses `setEntered()` instead. */
  setEnteredSet(value: Record<string, true>): void {
    this.mutate(p => p.replaceEnteredSet(value));
  }

  // ---- rear-chamber tuning target (bandpass6/ABC) — STUBBED, ledger QO44 -----------------
  //
  // No `OpenISDBox` alignment exists yet for a 6th-order bandpass or ABC box, so there is
  // nowhere real to store this. The UI's Frc input renders only when one of those two
  // (unbuilt) alignments is selected, so this is unreachable by any live code path today —
  // it exists so that unreachable call site compiles against a real domain method instead of
  // holding its own copy of the value (John's ruling 2026-08-20).
  /** 50 Hz is an arbitrary placeholder, not a measured or derived value — nothing computes
   *  this field yet (no alignment exists to hold it), and no design has ever entered a real
   *  one through this unreachable call path. It is a constant so a caller reading it gets a
   *  stable number rather than 0/NaN while the field waits on QO44. */
  frcHz(): number { return 50; }
  /** Stores nothing (no home exists yet) — notifies anyway, uniformly with every other public
   *  mutator (`docs/design/REACTIVITY.md`, `architecture-notify.test.ts`), so a caller waiting
   *  on the change channel is never left silently guessing whether this one forgot to. */
  setFrcHz(_value: number): void { this.#notify(); }

  // ---- project reads and writes ----------------------------------------------------------

  /**
   * A COPY of the effective project, safe to read and impossible to write back through. A copy
   * rather than the object itself, because handing out the object would be handing out the
   * state — the thing this class exists to prevent.
   */
  _snapshot(): OpenISDProject {
    return this.#effective().project.copy();
  }

  /**
   * Change the effective project — box, vent, environment, signal, filters, anything that is
   * not a driver field.
   *
   * The mutation happens inside the callback so that this class stays in charge of what follows
   * it — re-materialising the effective layer's `OpenISDDriver` and notifying. A caller that
   * mutated a project it had been handed could not be given either behaviour.
   */
  mutate(fn: (project: OpenISDProject) => void): void {
    const layer = this.#effective();
    fn(layer.project);
    // The driver record may have been replaced wholesale (a different driver chosen), so the
    // live view is re-materialised rather than left pointing at the old object.
    const text = layer.project.driverText();
    layer.openIsdDriver = text ? OpenISDDriver.fromOwdrText(text) : null;
    this.#notify();
  }

  // ---- the project, for anything persistent ----------------------------------------------

  /**
   * The project to SAVE, EXPORT or SHARE — committed state, never an open overlay, and it
   * cancels an active what-if first as an observable side effect.
   *
   * That cancellation is STRUCTURAL: this is the only route to a persistable project, so no
   * call site can forget it.
   */
  _projectToPersist(): OpenISDProject {
    this.#endWhatIfIfActive();
    return this.#committed.project.copy();
  }

  isWhatIfActive(): boolean { return this.#overlay?.kind === 'whatif'; }

  // ---- what-if lifecycle -------------------------------------------------------------------

  /** Open a what-if over committed state. Notifies once open, because it changes which layer
   *  is effective. Live from here on. */
  beginWhatIf(): void {
    if (this.#overlay?.kind === 'whatif') return;
    this.#overlay = this.#openWhatIfOver(this.#committed);
    this.#notify();
  }

  /** Reset an open what-if to the design AS LOADED — the Tune panel's Reset. Seeded from
   *  GROUND, not committed: Reset goes back to the library, not to the last keystroke
   *  (`docs/design/STATE_MODEL.md` rule 5). A no-op when no what-if is open. */
  resetOverlayToGround(): void {
    if (this.#overlay?.kind !== 'whatif') return;
    this.#endWhatIfIfActive();
    this.#overlay = this.#openWhatIfOver(this.#ground);
    this.#notify();
  }

  /** Discard the what-if — the ONLY way a what-if session ends. There is no `commitWhatIf()`,
   *  ever: a what-if explores values the app cannot verify against physical reality, so
   *  nothing promotes one into the design. */
  cancelWhatIf(): void {
    this.#endWhatIfIfActive();
  }

  #openWhatIfOver(source: Layer): Overlay {
    return { kind: 'whatif', layer: cloneLayer(source) };
  }

  #endWhatIfIfActive(): void {
    if (this.#overlay?.kind !== 'whatif') return;
    this.#overlay = null;
    this.#notify();
  }

  // ---- load / switch -----------------------------------------------------------------------

  /** Adopt a project as freshly loaded. Ground and committed both become independent copies;
   *  any open what-if is discarded, because loading is a named trigger of the what-if-never-leaks
   *  rule and a what-if over the old design has nothing left to explore. */
  load(project: OpenISDProject): void {
    this.#overlay = null;
    this.#ground = layerOf(project.copy());
    this.#committed = layerOf(project.copy());
    this.#notify();
  }

  /** Replace the whole design with an empty one. */
  loadEmpty(): void {
    this.load(OpenISDProject.empty());
  }

  // ---- driver file IO (QO78: driver/project file IO lives IN the managed layer) ----------
  //
  // The driver enters and leaves this class as SERIALISED TEXT/BYTES, never as the private
  // record shape — no caller outside the licensed modules can name, alias, or clone the
  // record (QO73, behavioral §"ENCAPSULATION IS ABSOLUTE"). Construction of the live
  // `OpenISDDriver` happens here, inside the gate's licensed set.

  /** Drop the design's driver — back to the no-driver-chosen state. */
  clearDriver(): void {
    this.mutate(p => { p.setDriver(undefined); });
  }

  /** Adopt a driver from WinISD `.wdr` text into the CURRENT design, leaving the box and
   *  everything else alone — choosing a driver is not opening a new project. */
  loadDriverFromWdrText(text: string): void {
    const driver = OpenISDDriver.fromWdrText(text);
    this.mutate(p => { p.setDriver(driver); });
  }

  /** Adopt a driver from `.owdr` text (the record's own JSON serialisation). Throws on
   *  malformed JSON — for a checked, non-throwing adoption of UNTRUSTED text (localStorage,
   *  a share link) use `loadDriverFromPersistedText`. */
  loadDriverFromOwdrText(text: string): void {
    const driver = OpenISDDriver.fromOwdrText(text);
    this.mutate(p => { p.setDriver(driver); });
  }

  /**
   * Adopt a driver from persisted text (the same serialisation `persistedDriverText()`
   * produces), CHECKED: malformed JSON or a structurally unloadable record is REFUSED, and
   * the returned problems say why — empty means adopted. The checked/throwing split exists
   * because persisted text is data someone else wrote (an older build, a hand-edited file),
   * while `.wdr`/`.owdr` adoption sits behind format detection that already vouched for it.
   */
  loadDriverFromPersistedText(text: string): string[] {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch (err) { return [(err as Error).message]; }
    const problems = driverRecordProblems(parsed);
    if (problems.length) return problems;
    const driver = OpenISDDriver.fromOwdrText(text);
    this.mutate(p => { p.setDriver(driver); });
    return [];
  }

  /** The COMMITTED driver as persisted text (its own JSON serialisation) — what a save, a
   *  share link, or a ground fingerprint embeds. Cancels an active what-if first, the same
   *  structural guard as `_projectToPersist()`. Undefined when no driver is chosen. */
  persistedDriverText(): string | undefined {
    this.#endWhatIfIfActive();
    return this.#committed.project.driverText();
  }

  /**
   * The committed driver's own serialisation, or an EMPTY driver's when none is chosen. TEXT —
   * `ManagedOpenISDProject` never hands an `OpenISDDriver` out (architecture.test.ts, "every
   * public member returns data"), so this is the sanctioned channel: any caller LICENSED to
   * construct a driver (today: `DriverEditorModal.vue`, via `OpenISDDriver.fromOwdrText`) can
   * build its own detached instance from this text without this class handing out the live
   * object itself. Becomes part of the capability seam when serialisation goes `#`-private.
   */
  committedDriverText(): string {
    this.#endWhatIfIfActive();
    const driver = this.#committed.openIsdDriver;
    return driver ? driver.toOwdrText() : OpenISDDriver.empty().toOwdrText();
  }

  /** The COMMITTED driver as `.wdr` bytes. Fails (with the projection's own errors) when the
   *  driver is too incomplete to project, or when none is chosen. */
  exportDriverWdr(): Result<Uint8Array<ArrayBuffer>> {
    this.#endWhatIfIfActive();
    const driver = this.#committed.openIsdDriver;
    if (!driver) {
      return { value: null, errors: [{ level: 'error', field: 'driver', message: 'no driver has been chosen' }] };
    }
    const { value: text, errors } = driver.toWdrText();
    if (!text) return { value: null, errors };
    return { value: winisdTextToBytes(text), errors };
  }

  /** The COMMITTED driver as `.owdr` bytes — cannot fail once a driver is chosen (the record
   *  is always representable as its own JSON). Null when none is chosen. */
  exportDriverOwdr(): Uint8Array<ArrayBuffer> | null {
    this.#endWhatIfIfActive();
    const driver = this.#committed.openIsdDriver;
    return driver ? new TextEncoder().encode(driver.toOwdrText()) as Uint8Array<ArrayBuffer> : null;
  }

  // ---- project file IO (QO78) -------------------------------------------------------------

  /**
   * The COMMITTED design as WinISD `.wpr` bytes. `now` is passed, never read from the clock,
   * so the same design is byte-reproducible; `curve` is the current swept impedance result
   * (for the sealed-box resonance refinement), or null when none has been computed — only the
   * live sweep pipeline can supply it, so it is a parameter, never fabricated here.
   */
  exportWpr(now: Date, curve: SweepResult | null): Result<Uint8Array<ArrayBuffer>> {
    this.#endWhatIfIfActive();
    const driver = this.#committed.openIsdDriver;
    if (!driver) {
      return { value: null, errors: [{ level: 'error', field: 'driver', message: 'no driver has been chosen' }] };
    }
    const { value: driverSection, errors } = driver.toWdrText();
    if (!driverSection) return { value: null, errors };

    // The domain object derives its own box/vent tuning and speaks the file's vocabulary —
    // this layer only supplies what it alone has: the driver's serialisation, the engine
    // projection, the clock, and the live sweep.
    const wpr = this.#committed.project.toWinISDProject(driverSection, driver.toDriver(), now, curve);
    return { value: winisdTextToBytes(wpr.toWpr()), errors };
  }

  /**
   * Adopt a WinISD `.wpr` file's bytes as THIS project — box-type mapping and PR conversion
   * happen in `OpenISDProject.fromWinISDProject` (the model's one licensed site), the
   * `[Driver]` block goes through the driver's own `.wdr` reader, and the loaded project
   * replaces ground and committed alike. Returns the loaded project's meta (a public plain
   * type) so the caller can mirror it into its own view state; `value` null means the file
   * was refused, with the reasons in `errors`.
   */
  importWpr(bytes: Uint8Array): Result<OpenISDProjectMeta> {
    let text: string;
    try { text = decodeDriverFileBytes(bytes, ProjectFileFormat.Wpr).text; }
    catch (err) { return { value: null, errors: [{ level: 'error', field: 'wpr', message: (err as Error).message }] }; }

    // The MODEL parses its own format — box-type mapping, PR conversion and the embedded
    // [Driver] block all happen inside `OpenISDProject`/`OpenISDDriver` (QO83). This method
    // decodes the bytes, then adopts whatever the model hands back.
    const { value: project, errors } = OpenISDProject.fromWprText(text);
    if (!project) return { value: null, errors };
    this.load(project);
    return { value: project.projectMeta(), errors: [] };
  }

  // ---- UiParams — the flat, engine-facing snapshot ----------------------------------------
  //
  // `UiParams` (packages/ui/src/types.ts) is the shape `@openisd/engine`'s `sweep()`/
  // `maxCurves()` and the persisted/shared blob (`SerializedState.P`) both need — a superset
  // of `SweepParams`. It is not a second store: every field here is read from, or written to,
  // the project fields above. Gathering them into one plain object is not a CALCULATION (no
  // formula runs), so it belongs beside the getters it reads, not duplicated at every caller.

  /** A live snapshot of every `UiParams` field, gathered from this project's own accessors. */
  toUiParams(): UiParams {
    return {
      Vb: this.boxVolume_m3(), Vf: this.frontVolume_m3(),
      ventShape: this.activeVentField('shape'), ventD: this.activeVentField('diameter_m'),
      ventW: this.activeVentField('width_m'), ventH: this.activeVentField('height_m'),
      ventL: this.activeVentField('length_m'), endCorrection: this.activeVentField('endCorrection'),
      Fb: this.boxTuning_Fb_hz(), Frc: this.frcHz(),
      prFp: this.prFp_hz(), prName: this.prField('name'), prSd: this.prField('Sd_m2'),
      prNum: this.prCount(), prMmd: this.prField('Mmd_kg'), prMadd: this.prAddedMass_kg(),
      prCms: this.prField('Cms_m_per_N'), prRms: this.prField('Rms_Ns_per_m'),
      prXmax: this.prField('Xmax_m'),
      entered: this.enteredSet(),
      Ql: this.boxQl(), Qa: this.boxQa(), Qp: this.boxQp(),
      nDrivers: this.driverCount(), wiring: this.wiring(),
      Pin: this.inputPower_W(), Rs: this.seriesResistance_ohm(),
      fmin: this.sweepFmin_hz(), fmax: this.sweepFmax_hz(), N: this.sweepPoints(),
      circuitModel: this.circuitModel(), filters: this.filters(),
      vcTempRise: this.vcTempRise(), alfaVC: this.alfaVC(), driverAddedMass: this.driverAddedMass(),
      rgAtDriverSide: this.rgAtDriverSide(), tlPortModel: this.tlPortModel(),
      forceFlatResponse: this.forceFlatResponse(), splXmaxLimited: this.splXmaxLimited(),
      tempK: this.envTempK(), humidityPct: this.envHumidityPct(),
      pressurePa: this.envPressurePa(), ignoreHumidityAndPressure: this.envIgnoreHumidityAndPressure(),
    };
  }

  /**
   * Adopt a `UiParams` blob — a restore (local save, share link, ground checkpoint) that must
   * land byte-identical on every field IT SUPPLIES, with nothing re-solved
   * (`docs/design/STATE_MODEL.md` rule 3). `box` is set first so every alignment-relative
   * write (`Vb`, the vent fields) lands on the alignment the snapshot was taken from.
   *
   * `p` is `Partial<UiParams>` because every real caller's blob can genuinely be partial — a
   * caller restoring only the entered set, or a legacy save missing fields this build added
   * since it was written. `field()` below is the ONE fallback rule, applied UNIFORMLY to
   * every field: `p`'s own value if it supplied one, else the CURRENT value — restoring one
   * field must not silently reset every other one, and no field gets a special-cased fallback
   * the rest don't have.
   */
  loadUiParams(p: Partial<UiParams>, box: AlignmentKind): void {
    const current = this.toUiParams();
    const field = <K extends keyof UiParams>(k: K): UiParams[K] => (p[k] !== undefined ? p[k]! : current[k]);
    // `tempK`/`humidityPct`/`pressurePa`/`ignoreHumidityAndPressure` are the only FOUR fields
    // `UiParams` itself declares optional (a legacy/serialised blob may genuinely omit them —
    // WinISD's own environment fields predate this app tracking them per-project). Every other
    // field is required by the interface, so `field()` alone type-checks for them. These four
    // need one more step: `current[k]` — read from the LIVE domain object, where
    // `OpenISDEnvironment`'s fields are NOT optional — is never actually undefined, so this
    // narrows `field()`'s `T | undefined` back to `T` without inventing a fallback value.
    const requiredField = <K extends 'tempK' | 'humidityPct' | 'pressurePa' | 'ignoreHumidityAndPressure'>(k: K)
      : NonNullable<UiParams[K]> => field(k)!;
    this.mutate(project => {
      project.setAlignment(box);
      project.setVentField('shape', field('ventShape'));
      project.setVentField('diameter_m', field('ventD'));
      project.setVentField('width_m', field('ventW'));
      project.setVentField('height_m', field('ventH'));
      project.setVentField('length_m', field('ventL'));
      project.setVentField('endCorrection', field('endCorrection'));
      project.setVolume_m3(field('Vb'));
      project.setFrontVolume_m3(field('Vf'));
      project.setTuning_Fb_hz(field('Fb'));
      project.setLoss('Ql', field('Ql')); project.setLoss('Qa', field('Qa')); project.setLoss('Qp', field('Qp'));
      project.setPrField('name', field('prName'));
      project.setPrField('Sd_m2', field('prSd'));
      project.setPrField('Mmd_kg', field('prMmd'));
      project.setPrField('Cms_m_per_N', field('prCms'));
      project.setPrField('Rms_Ns_per_m', field('prRms'));
      project.setPrField('Xmax_m', field('prXmax'));
      project.setPrCount(field('prNum'));
      project.setPrAddedMass_kg(field('prMadd'));
      project.setPrFp_hz(field('prFp'));
      project.set('advTemp', requiredField('tempK'));
      project.set('advHumidity', requiredField('humidityPct'));
      project.set('advPressure', requiredField('pressurePa'));
      project.setIgnoreHumidityAndPressure(requiredField('ignoreHumidityAndPressure'));
      project.set('nDrivers', field('nDrivers')); project.setWiring(field('wiring'));
      project.set('Pin', field('Pin')); project.set('Rs', field('Rs'));
      project.setRgAtDriverSide(field('rgAtDriverSide'));
      project.setCircuitModel(field('circuitModel'));
      project.setTlPortModel(field('tlPortModel'));
      project.setForceFlatResponse(field('forceFlatResponse'));
      project.setSplXmaxLimited(field('splXmaxLimited'));
      project.set('vcTempRise', field('vcTempRise')); project.setAlfaVC(field('alfaVC'));
      project.set('driverAddedMass', field('driverAddedMass'));
      project.setSweepFmin_hz(field('fmin')); project.setSweepFmax_hz(field('fmax')); project.setSweepPoints(field('N'));
      project.setFilters(field('filters'));
      project.replaceEnteredSet({ ...field('entered') });
    });
  }

  // ---- subscription -------------------------------------------------------------------------

  subscribe(fn: ManagedOpenISDProjectListener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(): void {
    for (const fn of [...this.#listeners]) fn();
  }
}
