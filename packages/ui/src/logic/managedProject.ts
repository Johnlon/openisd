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
 *   overlay    — an edit draft OR a what-if. Never both at once.
 *
 * ── `_OpenISDProjectJson` is PRIVATE ──
 * No instance of one ever leaves, and nor does the live `OpenISDDriver` inside it. A caller
 * reads with `cell()`/`metaCell()`/`toEngineDriver()`/`errors()`/`_snapshot()` and writes with
 * `enter()`/`clear()`/`mutate()`. Handing the project out would let a caller change it behind
 * the facade — with no notification and no what-if guard — which is precisely what this class
 * exists to make impossible.
 *
 * ── Subscription: what-if is live ──
 * A WHAT-IF is LIVE. Every change re-fires immediately, because the charts are previewing it.
 * `beginWhatIf()`/`cancelWhatIf()` notify too: they change which layer is effective.
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
import { OpenISDDriver, Provenance } from '@openisd/model';
import { prototypeBox } from '@openisd/model';
import {
  activeVent, boxVolume_m3 as readBoxVolume_m3, setBoxVolume_m3 as writeBoxVolume_m3,
  boxTuning_Fb_hz as readBoxTuning_Fb_hz, setBoxTuning_Fb_hz as writeBoxTuning_Fb_hz,
  passiveRadiatorOrDefault, ensurePassiveRadiator, ventArea_m2 as computeVentArea_m2,
} from '@openisd/model';
import type {
  Cell, MetaCell, SpecField, MetaField, _OpenISDProjectJson, _OpenISDDriverJson,
  OpenISDVent, OpenISDPassiveRadiatorRef,
} from '@openisd/model';
import type { DriverError, ConsistencyIssue, EngineDriver as EngineDriver } from '@openisd/engine';
import {
  sealedResonance as computeSealedResonance, sourceLoadedQts, prTuning as computePrTuning,
  prVas as computePrVas, prFs as computePrFs, prFsWithMass as computePrFsWithMass,
  prQms as computePrQms, moistAirSoundVelocity, T_REF_K, RH_REF_PCT, P_REF_PA,
} from '@openisd/engine';
import type { LossMode } from '@openisd/engine';

type ManagedOpenISDProjectListener = () => void;

/** One state layer: the project, and the live driver over its record. They share one object
 *  graph, so `driver` is a VIEW of `project.driver`, never a second copy of it. */
interface Layer {
  project: _OpenISDProjectJson;
  /** Null exactly when no driver has been chosen. */
  openIsdDriver: OpenISDDriver | null;
}

type Overlay =
  | { kind: 'whatif'; layer: Layer; unsubscribe: () => void };

/**
 * Human ruling: the ONLY files, `packages/`-relative, permitted to name `_prototypeProject` —
 * enforced by `packages/ui/test/ui/architecture.test.ts` the same way as
 * `_OpenISDDriverJsonPrivateAllow` in openisdDriver.ts. ONLY the human may add, remove, or
 * change an entry here — no agent may edit this list on its own judgement.
 */
export const _prototypeProjectPrivateAllow: string[] = [];

/** A project with nothing chosen — what the app holds before a driver is picked. Every value is
 *  a real default a user could have set; none is a fake driver standing in for a real one. */
export function _prototypeProject(): _OpenISDProjectJson {
  return {
    driver: undefined,
    box: prototypeBox(),
    // WinISD's direction: volume, diameter and tuning are typed; vent length is returned.
    // `Frc` has no OpenISDBox home yet (no 6th-order alignment exists — QO44) and is carried
    // here as a bare flag with no corresponding value; `prMadd` is the PR's own entered
    // member — added mass is typed, its tuning solved. `ventW`/`ventH` mark round-vent
    // dimensions entered even though only a slotted vent solves against them, matching what
    // ships: `ventFieldState` reads this set for EVERY vent field's E/C/N badge, not only the
    // ones the Helmholtz solver consumes.
    target: { entered: {
      Vb: true, ventD: true, ventW: true, ventH: true, Fb: true, Frc: true, prMadd: true,
    } },
    filters: [],
    environment: {
      tempK: 293.15, humidityPct: 30, pressurePa: 101325, ignoreHumidityAndPressure: false,
    },
    signal: {
      inputPower_W: 1, seriesResistance_ohm: 0.1, driverCount: 1,
      wiring: 'parallel', rgAtDriverSide: false,
    },
    listening: { distance_m: 1, angle_rad: 0 },
    simOptions: {
      circuitModel: 'winisd', tlPortModel: false, forceFlatResponse: false,
      splXmaxLimited: false, vcTempRise: 0, alfaVC: 0.0039, driverAddedMass: 0,
    },
    sweep: { fmin_hz: 1, fmax_hz: 20000, points: 400 },
    meta: { name: '', creator: '', created: '', modified: '', description: '' },
  };
}

/** A layer from a project, with its live driver materialised over the SAME record object. */
function layerOf(project: _OpenISDProjectJson): Layer {
  return {
    project,
    openIsdDriver: project.driver ? OpenISDDriver.fromJsonRecord(project.driver) : null,
  };
}

/** An independent copy of a layer. `structuredClone` is why `_OpenISDProjectJson` is plain data:
 *  it would silently reduce a class instance to a bare object, so the project holds the
 *  driver's RECORD and the live driver is re-materialised over the clone. */
function cloneLayer(layer: Layer): Layer {
  return layerOf(structuredClone(layer.project));
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
  static fromProject(project: _OpenISDProjectJson): ManagedOpenISDProject {
    return new ManagedOpenISDProject(
      layerOf(structuredClone(project)),
      layerOf(structuredClone(project)),
    );
  }

  /** A project with nothing chosen. Here rather than at the call site so no caller has to name
   *  `_OpenISDProjectJson`'s shape to make one. */
  static createEmpty(): ManagedOpenISDProject {
    return ManagedOpenISDProject.fromProject(_prototypeProject());
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

  enter(field: SpecField, value: number): void {
    this.#effective().openIsdDriver?.enter(field, value);
  }
  clear(field: SpecField): void {
    this.#effective().openIsdDriver?.clear(field);
  }
  enterMeta(field: MetaField, value: string): void {
    this.#effective().openIsdDriver?.enterMeta(field, value);
  }
  clearMeta(field: MetaField): void {
    this.#effective().openIsdDriver?.clearMeta(field);
  }

  // ---- box / vent / PR flat-field accessors, ledger QO54 ---------------------------------
  //
  // What `state.P.Vb`/`.ventD`/`.Fb`/`.pr*`/`.entered` accessor properties (store.ts) delegate
  // to, so the box IS the storage and state.P is a view — not a synced copy. Reads go straight
  // to the effective layer (no clone: these are read on every reactive tick); writes go
  // through `mutate()` so the existing edit/what-if notification rule keeps applying with no
  // second code path to keep in step.

  boxVolume_m3(): number { return readBoxVolume_m3(this.#effective().project.box); }
  setBoxVolume_m3(value: number): void {
    this.mutate(p => writeBoxVolume_m3(p.box, value));
  }

  boxTuning_Fb_hz(): number { return readBoxTuning_Fb_hz(this.#effective().project.box); }
  setBoxTuning_Fb_hz(value: number): void {
    this.mutate(p => writeBoxTuning_Fb_hz(p.box, value));
  }

  /** `Vf` — bandpass4's OWN front-chamber volume. Unconditional: unlike `Vb`, this never
   *  addresses another alignment's storage, dormant or active — there is only one home. */
  frontVolume_m3(): number { return this.#effective().project.box.bandpass4.frontVolume_m3; }
  setFrontVolume_m3(value: number): void {
    this.mutate(p => { p.box.bandpass4.frontVolume_m3 = value; });
  }

  activeVentField<K extends keyof OpenISDVent>(field: K): OpenISDVent[K] {
    return activeVent(this.#effective().project.box)[field];
  }
  setActiveVentField<K extends keyof OpenISDVent>(field: K, value: OpenISDVent[K]): void {
    this.mutate(p => { activeVent(p.box)[field] = value; });
  }

  /** The active vent's cross-sectional area — round or slotted, whichever it currently is.
   *  A calculated value, exposed here (not computed by any caller) per ARCHITECTURE.md §5
   *  "only the domain objects calculate". */
  ventArea_m2(): number {
    return computeVentArea_m2(activeVent(this.#effective().project.box));
  }

  /** The active vent's effective acoustic length — physical length plus the end-correction
   *  term, which needs an equivalent diameter for a slotted vent (derived from its area) since
   *  the correction is inherently a round-port concept. Calculated here, not by any caller. */
  ventEffectiveLength_m(): number {
    const vent = activeVent(this.#effective().project.box);
    const equivalentDiameter_m = vent.shape === 'slotted'
      ? 2 * Math.sqrt(this.ventArea_m2() / Math.PI)
      : vent.diameter_m;
    return vent.length_m + vent.endCorrection * equivalentDiameter_m;
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
  prVas_l(): number { return computePrVas(this.prField('Cms_m_per_N'), this.prField('Sd_m2')); }
  prFs_hz(): number { return computePrFs(this.prField('Mmd_kg'), this.prField('Cms_m_per_N')); }
  prFsWithMass_hz(): number {
    return computePrFsWithMass(this.prField('Mmd_kg'), this.prAddedMass_kg(), this.prField('Cms_m_per_N'));
  }
  prQms(): number {
    return computePrQms(this.prField('Mmd_kg'), this.prField('Cms_m_per_N'), this.prField('Rms_Ns_per_m'));
  }

  prField<K extends keyof OpenISDPassiveRadiatorRef>(field: K): OpenISDPassiveRadiatorRef[K] {
    return passiveRadiatorOrDefault(this.#effective().project.box.passiveRadiator)[field];
  }
  setPrField<K extends keyof OpenISDPassiveRadiatorRef>(field: K, value: OpenISDPassiveRadiatorRef[K]): void {
    this.mutate(p => { ensurePassiveRadiator(p.box.passiveRadiator)[field] = value; });
  }

  prCount(): number { return this.#effective().project.box.passiveRadiator.count; }
  setPrCount(value: number): void { this.mutate(p => { p.box.passiveRadiator.count = value; }); }

  prAddedMass_kg(): number { return this.#effective().project.box.passiveRadiator.addedMass_kg; }
  setPrAddedMass_kg(value: number): void {
    this.mutate(p => { p.box.passiveRadiator.addedMass_kg = value; });
  }

  prFp_hz(): number { return this.#effective().project.box.passiveRadiator.Fp_hz; }
  setPrFp_hz(value: number): void { this.mutate(p => { p.box.passiveRadiator.Fp_hz = value; }); }

  // ---- entered-set (target provenance), ledger QO54 --------------------------------------
  //
  // Replaces `state.P.entered: Record<string, true>` — the "second, hand-rolled provenance
  // mechanism" the migration plan (Step 4) requires deleted. Same shape, one home:
  // `_OpenISDProjectJson.target.entered`, already scaffolded for exactly this in P1S1.

  isEntered(field: string): boolean {
    return this.#effective().project.target.entered[field] === true;
  }
  setEntered(field: string, value: boolean): void {
    this.mutate(p => {
      if (value) p.target.entered[field] = true;
      else delete p.target.entered[field];
    });
  }

  // ---- project reads and writes ----------------------------------------------------------

  /**
   * A COPY of the effective project, safe to read and impossible to write back through. A copy
   * rather than the object itself, because handing out the object would be handing out the
   * state — the thing this class exists to prevent.
   */
  _snapshot(): _OpenISDProjectJson {
    return structuredClone(this.#effective().project);
  }

  /**
   * Change the effective project — box, vent, environment, signal, filters, anything that is
   * not a driver field.
   *
   * The mutation happens inside the callback so that this class stays in charge of what
   * follows it: a live what-if notifies immediately, an open edit draft stays silent until
   * commit. A caller that mutated a project it had been handed could not be given either
   * behaviour.
   */
  mutate(fn: (project: _OpenISDProjectJson) => void): void {
    const layer = this.#effective();
    fn(layer.project);
    // The driver record may have been replaced wholesale (a different driver chosen), so the
    // live view is re-materialised rather than left pointing at the old object.
    layer.openIsdDriver = layer.project.driver ? OpenISDDriver.fromJsonRecord(layer.project.driver) : null;
    if (this.#overlay?.kind === 'whatif') this.#notify();
  }

  // ---- the project, for anything persistent ----------------------------------------------

  /**
   * The project to SAVE, EXPORT or SHARE — committed state, never an open overlay, and it
   * cancels an active what-if first as an observable side effect.
   *
   * That cancellation is STRUCTURAL: this is the only route to a persistable project, so no
   * call site can forget it.
   */
  _projectToPersist(): _OpenISDProjectJson {
    this.#endWhatIfIfActive();
    return structuredClone(this.#committed.project);
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
    const layer = cloneLayer(source);
    // Driver-field scrubs notify through the driver's own channel; project-field scrubs notify
    // through mutate(). Both routes reach the same subscribers.
    const unsubscribe = layer.openIsdDriver?.subscribe(() => this.#notify()) ?? (() => {});
    return { kind: 'whatif', layer, unsubscribe };
  }

  #endWhatIfIfActive(): void {
    if (this.#overlay?.kind !== 'whatif') return;
    this.#overlay.unsubscribe();
    this.#overlay = null;
    this.#notify();
  }

  // ---- load / switch -----------------------------------------------------------------------

  /** Adopt a project as freshly loaded. Ground and committed both become independent copies;
   *  any open overlay is discarded, because loading is a named trigger of the
   *  what-if-never-leaks rule and a draft over the old design has nothing left to commit onto. */
  load(project: _OpenISDProjectJson): void {
    if (this.#overlay?.kind === 'whatif') this.#overlay.unsubscribe();
    this.#overlay = null;
    this.#ground = layerOf(structuredClone(project));
    this.#committed = layerOf(structuredClone(project));
    this.#notify();
  }

  /** Adopt a chosen driver into the CURRENT design, leaving the box and everything else alone —
   *  choosing a driver is not opening a new project. */
  loadDriverRecord(record: _OpenISDDriverJson): void {
    this.mutate(p => { p.driver = structuredClone(record); });
    if (this.#overlay?.kind !== 'whatif') this.#notify();
  }

  /** Replace the whole design with an empty one. */
  loadEmpty(): void {
    this.load(_prototypeProject());
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
