/**
 * `ManagedProject` — the one facade over every state layer of ONE project.
 *
 * A user does not explore "a what-if driver". They explore a DESIGN: a driver in a box, with a
 * vent or a radiator, at a drive level, in an environment. Scrubbing `Vb` and scrubbing `Qts`
 * are the same act, so the overlay wraps the whole PROJECT and not one part of it.
 *
 * This is the domain object for ONE project in the left nav. It holds three complete
 * `OpenISDProjectJson`s:
 *
 *   ground     — the design exactly as loaded. What Reset goes back to.
 *   committed  — the design as it stands. What the charts draw and a save writes.
 *   overlay    — a what-if over committed state, open at most one at a time.
 *
 * ── `OpenISDProjectJson` is PRIVATE ──
 * No instance of one ever leaves, and nor does the live `OpenISDDriver` inside it. A caller
 * reads with `cell()`/`metaCell()`/`toEngineDriver()`/`errors()`/`snapshot()` and writes with
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
 * see them. `projectToPersist()` — the ONLY route to a savable project — cancels an active
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
import type {
  Cell, MetaCell,
  OpenISDVent, AlignmentKind, OpenISDProjectMeta,
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
import type { UiParams } from '@openisd/model';

type ManagedProjectListener = () => void;

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

/** One state layer: the project, and its own live driver, read straight off it. `openIsdDriver`
 *  is `project.driver()` — the SAME object, never a re-parse: `OpenISDProject` holds the live
 *  driver directly. Never absent — a project cannot exist without a driver
 *  (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
interface Layer {
  project: OpenISDProject;
  openIsdDriver: OpenISDDriver;
}

type Overlay =
  | { kind: 'whatif'; layer: Layer };

/** A layer over `project`, its live driver read straight off it. */
function layerOf(project: OpenISDProject): Layer {
  return { project, openIsdDriver: project.driver() };
}

/** An independent copy of a layer — `OpenISDProject.copy()` clones the whole project, driver
 *  included, and the layer's own driver reference is just read back off that copy. */
function cloneLayer(layer: Layer): Layer {
  return layerOf(layer.project.copy());
}

export class ManagedProject {
  #ground: Layer;
  #committed: Layer;
  #overlay: Overlay | null = null;
  readonly #listeners = new Set<ManagedProjectListener>();

  private constructor(ground: Layer, committed: Layer) {
    this.#ground = ground;
    this.#committed = committed;
  }

  /** Adopt `project` as freshly loaded: ground and committed become independent copies of it. */
  static fromProject(project: OpenISDProject): ManagedProject {
    return new ManagedProject(layerOf(project.copy()), layerOf(project.copy()));
  }

  /** A project holding an empty (unfilled) driver — nothing chosen yet. A project cannot
   *  exist without SOME driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`), so this
   *  constructs `OpenISDDriver.empty()` itself: it is the one place outside `OpenISDDriver`'s
   *  own module licensed to name it as a value (QO73/ENCAPSULATION IS ABSOLUTE) — a caller
   *  never supplies one. */
  static createEmpty(): ManagedProject {
    return ManagedProject.fromProject(OpenISDProject.empty(OpenISDDriver.empty()));
  }

  // ---- which layer is effective ---------------------------------------------------------

  /** PRIVATE. The open overlay if there is one, else committed. Never leaves this class. */
  #effective(): Layer {
    if (this.#overlay) return this.#overlay.layer;
    return this.#committed;
  }

  // ---- driver reads, on the EFFECTIVE layer ----------------------------------------------

  /** The resolved, engine-ready driver the charts sweep, or null when nothing can be drawn
   *  (an incomplete driver — never "no driver", since one is always chosen). */
  toEngineDriver(): EngineDriver | null {
    return this.#effective().openIsdDriver.toDriver();
  }
  /** What the engine says stops this driver simulating. */
  errors(): DriverError[] {
    return this.#effective().openIsdDriver.errors();
  }
  /** Stated fields that contradict each other beyond their own precision. */
  consistencyIssues(): ConsistencyIssue[] {
    return this.#effective().openIsdDriver.consistencyIssues();
  }

  // ---- driver writes, on the EFFECTIVE layer ---------------------------------------------

  // Every public mutator notifies unconditionally (`docs/design/REACTIVITY.md`) — no mode guard.
  // A driver-field edit is not bridged through the driver's OWN `#notify()`: that channel would
  // need re-subscribing every time `mutate()` re-materialises the effective layer's
  // `OpenISDDriver` (any box/vent/PR edit does), which is exactly what silently dropped
  // notifications for `BUG_20260821_whatif_bridge_detaches_when_mutate_rematerialises_the_driver.md`.
  // Calling `this.#notify()` here directly needs no such subscription and cannot go stale.

  // ---- Flat, individually-named driver-field accessors — the public surface -------------
  //
  // `SpecField`/`MetaField` never appear here as a public parameter (human ruling 2026-08-24,
  // docs/design/ENCAPSULATION_AND_LAYERING.md: "SpecField is an internal datatype"). Mirrors
  // `OpenISDDriver`'s own flat surface one-for-one; writes notify directly (not through
  // `mutate()`) for the same reason the old generic `enter`/`clear` did — see the comment
  // above this block.

  Fs(): number | null { return this.#effective().openIsdDriver.Fs(); }
  FsCell(): Cell { return this.#effective().openIsdDriver.FsCell(); }
  enterFs(value: number): void { this.#effective().openIsdDriver.enterFs(value); this.#notify(); }
  clearFs(): void { this.#effective().openIsdDriver.clearFs(); this.#notify(); }
  Re(): number | null { return this.#effective().openIsdDriver.Re(); }
  ReCell(): Cell { return this.#effective().openIsdDriver.ReCell(); }
  enterRe(value: number): void { this.#effective().openIsdDriver.enterRe(value); this.#notify(); }
  clearRe(): void { this.#effective().openIsdDriver.clearRe(); this.#notify(); }
  Le(): number | null { return this.#effective().openIsdDriver.Le(); }
  LeCell(): Cell { return this.#effective().openIsdDriver.LeCell(); }
  enterLe(value: number): void { this.#effective().openIsdDriver.enterLe(value); this.#notify(); }
  clearLe(): void { this.#effective().openIsdDriver.clearLe(); this.#notify(); }
  fLe(): number | null { return this.#effective().openIsdDriver.fLe(); }
  fLeCell(): Cell { return this.#effective().openIsdDriver.fLeCell(); }
  enterFLe(value: number): void { this.#effective().openIsdDriver.enterFLe(value); this.#notify(); }
  clearFLe(): void { this.#effective().openIsdDriver.clearFLe(); this.#notify(); }
  KLe(): number | null { return this.#effective().openIsdDriver.KLe(); }
  KLeCell(): Cell { return this.#effective().openIsdDriver.KLeCell(); }
  enterKLe(value: number): void { this.#effective().openIsdDriver.enterKLe(value); this.#notify(); }
  clearKLe(): void { this.#effective().openIsdDriver.clearKLe(); this.#notify(); }
  Znom(): number | null { return this.#effective().openIsdDriver.Znom(); }
  ZnomCell(): Cell { return this.#effective().openIsdDriver.ZnomCell(); }
  enterZnom(value: number): void { this.#effective().openIsdDriver.enterZnom(value); this.#notify(); }
  clearZnom(): void { this.#effective().openIsdDriver.clearZnom(); this.#notify(); }
  Qts(): number | null { return this.#effective().openIsdDriver.Qts(); }
  QtsCell(): Cell { return this.#effective().openIsdDriver.QtsCell(); }
  enterQts(value: number): void { this.#effective().openIsdDriver.enterQts(value); this.#notify(); }
  clearQts(): void { this.#effective().openIsdDriver.clearQts(); this.#notify(); }
  Qes(): number | null { return this.#effective().openIsdDriver.Qes(); }
  QesCell(): Cell { return this.#effective().openIsdDriver.QesCell(); }
  enterQes(value: number): void { this.#effective().openIsdDriver.enterQes(value); this.#notify(); }
  clearQes(): void { this.#effective().openIsdDriver.clearQes(); this.#notify(); }
  Qms(): number | null { return this.#effective().openIsdDriver.Qms(); }
  QmsCell(): Cell { return this.#effective().openIsdDriver.QmsCell(); }
  enterQms(value: number): void { this.#effective().openIsdDriver.enterQms(value); this.#notify(); }
  clearQms(): void { this.#effective().openIsdDriver.clearQms(); this.#notify(); }
  Vas(): number | null { return this.#effective().openIsdDriver.Vas(); }
  VasCell(): Cell { return this.#effective().openIsdDriver.VasCell(); }
  enterVas(value: number): void { this.#effective().openIsdDriver.enterVas(value); this.#notify(); }
  clearVas(): void { this.#effective().openIsdDriver.clearVas(); this.#notify(); }
  Sd(): number | null { return this.#effective().openIsdDriver.Sd(); }
  SdCell(): Cell { return this.#effective().openIsdDriver.SdCell(); }
  enterSd(value: number): void { this.#effective().openIsdDriver.enterSd(value); this.#notify(); }
  clearSd(): void { this.#effective().openIsdDriver.clearSd(); this.#notify(); }
  BL(): number | null { return this.#effective().openIsdDriver.BL(); }
  BLCell(): Cell { return this.#effective().openIsdDriver.BLCell(); }
  enterBL(value: number): void { this.#effective().openIsdDriver.enterBL(value); this.#notify(); }
  clearBL(): void { this.#effective().openIsdDriver.clearBL(); this.#notify(); }
  Mms(): number | null { return this.#effective().openIsdDriver.Mms(); }
  MmsCell(): Cell { return this.#effective().openIsdDriver.MmsCell(); }
  enterMms(value: number): void { this.#effective().openIsdDriver.enterMms(value); this.#notify(); }
  clearMms(): void { this.#effective().openIsdDriver.clearMms(); this.#notify(); }
  Cms(): number | null { return this.#effective().openIsdDriver.Cms(); }
  CmsCell(): Cell { return this.#effective().openIsdDriver.CmsCell(); }
  enterCms(value: number): void { this.#effective().openIsdDriver.enterCms(value); this.#notify(); }
  clearCms(): void { this.#effective().openIsdDriver.clearCms(); this.#notify(); }
  Rms(): number | null { return this.#effective().openIsdDriver.Rms(); }
  RmsCell(): Cell { return this.#effective().openIsdDriver.RmsCell(); }
  enterRms(value: number): void { this.#effective().openIsdDriver.enterRms(value); this.#notify(); }
  clearRms(): void { this.#effective().openIsdDriver.clearRms(); this.#notify(); }
  Xmax(): number | null { return this.#effective().openIsdDriver.Xmax(); }
  XmaxCell(): Cell { return this.#effective().openIsdDriver.XmaxCell(); }
  enterXmax(value: number): void { this.#effective().openIsdDriver.enterXmax(value); this.#notify(); }
  clearXmax(): void { this.#effective().openIsdDriver.clearXmax(); this.#notify(); }
  Xlim(): number | null { return this.#effective().openIsdDriver.Xlim(); }
  XlimCell(): Cell { return this.#effective().openIsdDriver.XlimCell(); }
  enterXlim(value: number): void { this.#effective().openIsdDriver.enterXlim(value); this.#notify(); }
  clearXlim(): void { this.#effective().openIsdDriver.clearXlim(); this.#notify(); }
  SPL(): number | null { return this.#effective().openIsdDriver.SPL(); }
  SPLCell(): Cell { return this.#effective().openIsdDriver.SPLCell(); }
  enterSPL(value: number): void { this.#effective().openIsdDriver.enterSPL(value); this.#notify(); }
  clearSPL(): void { this.#effective().openIsdDriver.clearSPL(); this.#notify(); }
  Pe(): number | null { return this.#effective().openIsdDriver.Pe(); }
  PeCell(): Cell { return this.#effective().openIsdDriver.PeCell(); }
  enterPe(value: number): void { this.#effective().openIsdDriver.enterPe(value); this.#notify(); }
  clearPe(): void { this.#effective().openIsdDriver.clearPe(); this.#notify(); }
  Dd(): number | null { return this.#effective().openIsdDriver.Dd(); }
  DdCell(): Cell { return this.#effective().openIsdDriver.DdCell(); }
  enterDd(value: number): void { this.#effective().openIsdDriver.enterDd(value); this.#notify(); }
  clearDd(): void { this.#effective().openIsdDriver.clearDd(); this.#notify(); }
  EBP(): number | null { return this.#effective().openIsdDriver.EBP(); }
  EBPCell(): Cell { return this.#effective().openIsdDriver.EBPCell(); }
  enterEBP(value: number): void { this.#effective().openIsdDriver.enterEBP(value); this.#notify(); }
  clearEBP(): void { this.#effective().openIsdDriver.clearEBP(); this.#notify(); }
  numVC(): number | null { return this.#effective().openIsdDriver.numVC(); }
  numVCCell(): Cell { return this.#effective().openIsdDriver.numVCCell(); }
  enterNumVC(value: number): void { this.#effective().openIsdDriver.enterNumVC(value); this.#notify(); }
  clearNumVC(): void { this.#effective().openIsdDriver.clearNumVC(); this.#notify(); }
  VCCon(): number | null { return this.#effective().openIsdDriver.VCCon(); }
  VCConCell(): Cell { return this.#effective().openIsdDriver.VCConCell(); }
  enterVCCon(value: number): void { this.#effective().openIsdDriver.enterVCCon(value); this.#notify(); }
  clearVCCon(): void { this.#effective().openIsdDriver.clearVCCon(); this.#notify(); }
  Dia(): number | null { return this.#effective().openIsdDriver.Dia(); }
  DiaCell(): Cell { return this.#effective().openIsdDriver.DiaCell(); }
  enterDia(value: number): void { this.#effective().openIsdDriver.enterDia(value); this.#notify(); }
  clearDia(): void { this.#effective().openIsdDriver.clearDia(); this.#notify(); }
  Vd(): number | null { return this.#effective().openIsdDriver.Vd(); }
  VdCell(): Cell { return this.#effective().openIsdDriver.VdCell(); }
  enterVd(value: number): void { this.#effective().openIsdDriver.enterVd(value); this.#notify(); }
  clearVd(): void { this.#effective().openIsdDriver.clearVd(); this.#notify(); }
  no(): number | null { return this.#effective().openIsdDriver.no(); }
  noCell(): Cell { return this.#effective().openIsdDriver.noCell(); }
  enterNo(value: number): void { this.#effective().openIsdDriver.enterNo(value); this.#notify(); }
  clearNo(): void { this.#effective().openIsdDriver.clearNo(); this.#notify(); }
  SPLmax(): number | null { return this.#effective().openIsdDriver.SPLmax(); }
  SPLmaxCell(): Cell { return this.#effective().openIsdDriver.SPLmaxCell(); }
  enterSPLmax(value: number): void { this.#effective().openIsdDriver.enterSPLmax(value); this.#notify(); }
  clearSPLmax(): void { this.#effective().openIsdDriver.clearSPLmax(); this.#notify(); }
  SPLmaxLF(): number | null { return this.#effective().openIsdDriver.SPLmaxLF(); }
  SPLmaxLFCell(): Cell { return this.#effective().openIsdDriver.SPLmaxLFCell(); }
  enterSPLmaxLF(value: number): void { this.#effective().openIsdDriver.enterSPLmaxLF(value); this.#notify(); }
  clearSPLmaxLF(): void { this.#effective().openIsdDriver.clearSPLmaxLF(); this.#notify(); }
  USPL(): number | null { return this.#effective().openIsdDriver.USPL(); }
  USPLCell(): Cell { return this.#effective().openIsdDriver.USPLCell(); }
  enterUSPL(value: number): void { this.#effective().openIsdDriver.enterUSPL(value); this.#notify(); }
  clearUSPL(): void { this.#effective().openIsdDriver.clearUSPL(); this.#notify(); }
  driverAlfaVC(): number | null { return this.#effective().openIsdDriver.alfaVC(); }
  driverAlfaVCCell(): Cell { return this.#effective().openIsdDriver.alfaVCCell(); }
  enterDriverAlfaVC(value: number): void { this.#effective().openIsdDriver.enterAlfaVC(value); this.#notify(); }
  clearDriverAlfaVC(): void { this.#effective().openIsdDriver.clearAlfaVC(); this.#notify(); }
  Rt(): number | null { return this.#effective().openIsdDriver.Rt(); }
  RtCell(): Cell { return this.#effective().openIsdDriver.RtCell(); }
  enterRt(value: number): void { this.#effective().openIsdDriver.enterRt(value); this.#notify(); }
  clearRt(): void { this.#effective().openIsdDriver.clearRt(); this.#notify(); }
  Ct(): number | null { return this.#effective().openIsdDriver.Ct(); }
  CtCell(): Cell { return this.#effective().openIsdDriver.CtCell(); }
  enterCt(value: number): void { this.#effective().openIsdDriver.enterCt(value); this.#notify(); }
  clearCt(): void { this.#effective().openIsdDriver.clearCt(); this.#notify(); }
  gamma(): number | null { return this.#effective().openIsdDriver.gamma(); }
  gammaCell(): Cell { return this.#effective().openIsdDriver.gammaCell(); }
  enterGamma(value: number): void { this.#effective().openIsdDriver.enterGamma(value); this.#notify(); }
  clearGamma(): void { this.#effective().openIsdDriver.clearGamma(); this.#notify(); }
  Rme(): number | null { return this.#effective().openIsdDriver.Rme(); }
  RmeCell(): Cell { return this.#effective().openIsdDriver.RmeCell(); }
  enterRme(value: number): void { this.#effective().openIsdDriver.enterRme(value); this.#notify(); }
  clearRme(): void { this.#effective().openIsdDriver.clearRme(); this.#notify(); }
  Mpow(): number | null { return this.#effective().openIsdDriver.Mpow(); }
  MpowCell(): Cell { return this.#effective().openIsdDriver.MpowCell(); }
  enterMpow(value: number): void { this.#effective().openIsdDriver.enterMpow(value); this.#notify(); }
  clearMpow(): void { this.#effective().openIsdDriver.clearMpow(); this.#notify(); }
  Mcost(): number | null { return this.#effective().openIsdDriver.Mcost(); }
  McostCell(): Cell { return this.#effective().openIsdDriver.McostCell(); }
  enterMcost(value: number): void { this.#effective().openIsdDriver.enterMcost(value); this.#notify(); }
  clearMcost(): void { this.#effective().openIsdDriver.clearMcost(); this.#notify(); }
  Gloss(): number | null { return this.#effective().openIsdDriver.Gloss(); }
  GlossCell(): Cell { return this.#effective().openIsdDriver.GlossCell(); }
  enterGloss(value: number): void { this.#effective().openIsdDriver.enterGloss(value); this.#notify(); }
  clearGloss(): void { this.#effective().openIsdDriver.clearGloss(); this.#notify(); }
  c(): number | null { return this.#effective().openIsdDriver.c(); }
  cCell(): Cell { return this.#effective().openIsdDriver.cCell(); }
  enterC(value: number): void { this.#effective().openIsdDriver.enterC(value); this.#notify(); }
  clearC(): void { this.#effective().openIsdDriver.clearC(); this.#notify(); }
  roo(): number | null { return this.#effective().openIsdDriver.roo(); }
  rooCell(): Cell { return this.#effective().openIsdDriver.rooCell(); }
  enterRoo(value: number): void { this.#effective().openIsdDriver.enterRoo(value); this.#notify(); }
  clearRoo(): void { this.#effective().openIsdDriver.clearRoo(); this.#notify(); }
  Vcd(): number | null { return this.#effective().openIsdDriver.Vcd(); }
  VcdCell(): Cell { return this.#effective().openIsdDriver.VcdCell(); }
  enterVcd(value: number): void { this.#effective().openIsdDriver.enterVcd(value); this.#notify(); }
  clearVcd(): void { this.#effective().openIsdDriver.clearVcd(); this.#notify(); }
  Hg(): number | null { return this.#effective().openIsdDriver.Hg(); }
  HgCell(): Cell { return this.#effective().openIsdDriver.HgCell(); }
  enterHg(value: number): void { this.#effective().openIsdDriver.enterHg(value); this.#notify(); }
  clearHg(): void { this.#effective().openIsdDriver.clearHg(); this.#notify(); }
  Hc(): number | null { return this.#effective().openIsdDriver.Hc(); }
  HcCell(): Cell { return this.#effective().openIsdDriver.HcCell(); }
  enterHc(value: number): void { this.#effective().openIsdDriver.enterHc(value); this.#notify(); }
  clearHc(): void { this.#effective().openIsdDriver.clearHc(); this.#notify(); }
  freq_low_hz(): number | null { return this.#effective().openIsdDriver.freq_low_hz(); }
  freq_low_hzCell(): Cell { return this.#effective().openIsdDriver.freq_low_hzCell(); }
  enterFreq_low_hz(value: number): void { this.#effective().openIsdDriver.enterFreq_low_hz(value); this.#notify(); }
  clearFreq_low_hz(): void { this.#effective().openIsdDriver.clearFreq_low_hz(); this.#notify(); }
  freq_high_hz(): number | null { return this.#effective().openIsdDriver.freq_high_hz(); }
  freq_high_hzCell(): Cell { return this.#effective().openIsdDriver.freq_high_hzCell(); }
  enterFreq_high_hz(value: number): void { this.#effective().openIsdDriver.enterFreq_high_hz(value); this.#notify(); }
  clearFreq_high_hz(): void { this.#effective().openIsdDriver.clearFreq_high_hz(); this.#notify(); }
  power_peak_W(): number | null { return this.#effective().openIsdDriver.power_peak_W(); }
  power_peak_WCell(): Cell { return this.#effective().openIsdDriver.power_peak_WCell(); }
  enterPower_peak_W(value: number): void { this.#effective().openIsdDriver.enterPower_peak_W(value); this.#notify(); }
  clearPower_peak_W(): void { this.#effective().openIsdDriver.clearPower_peak_W(); this.#notify(); }
  weight_kg(): number | null { return this.#effective().openIsdDriver.weight_kg(); }
  weight_kgCell(): Cell { return this.#effective().openIsdDriver.weight_kgCell(); }
  enterWeight_kg(value: number): void { this.#effective().openIsdDriver.enterWeight_kg(value); this.#notify(); }
  clearWeight_kg(): void { this.#effective().openIsdDriver.clearWeight_kg(); this.#notify(); }
  Thick(): number | null { return this.#effective().openIsdDriver.Thick(); }
  ThickCell(): Cell { return this.#effective().openIsdDriver.ThickCell(); }
  enterThick(value: number): void { this.#effective().openIsdDriver.enterThick(value); this.#notify(); }
  clearThick(): void { this.#effective().openIsdDriver.clearThick(); this.#notify(); }
  Depth(): number | null { return this.#effective().openIsdDriver.Depth(); }
  DepthCell(): Cell { return this.#effective().openIsdDriver.DepthCell(); }
  enterDepth(value: number): void { this.#effective().openIsdDriver.enterDepth(value); this.#notify(); }
  clearDepth(): void { this.#effective().openIsdDriver.clearDepth(); this.#notify(); }
  MagDepth(): number | null { return this.#effective().openIsdDriver.MagDepth(); }
  MagDepthCell(): Cell { return this.#effective().openIsdDriver.MagDepthCell(); }
  enterMagDepth(value: number): void { this.#effective().openIsdDriver.enterMagDepth(value); this.#notify(); }
  clearMagDepth(): void { this.#effective().openIsdDriver.clearMagDepth(); this.#notify(); }
  Magnet(): number | null { return this.#effective().openIsdDriver.Magnet(); }
  MagnetCell(): Cell { return this.#effective().openIsdDriver.MagnetCell(); }
  enterMagnet(value: number): void { this.#effective().openIsdDriver.enterMagnet(value); this.#notify(); }
  clearMagnet(): void { this.#effective().openIsdDriver.clearMagnet(); this.#notify(); }
  Basket(): number | null { return this.#effective().openIsdDriver.Basket(); }
  BasketCell(): Cell { return this.#effective().openIsdDriver.BasketCell(); }
  enterBasket(value: number): void { this.#effective().openIsdDriver.enterBasket(value); this.#notify(); }
  clearBasket(): void { this.#effective().openIsdDriver.clearBasket(); this.#notify(); }
  Outer(): number | null { return this.#effective().openIsdDriver.Outer(); }
  OuterCell(): Cell { return this.#effective().openIsdDriver.OuterCell(); }
  enterOuter(value: number): void { this.#effective().openIsdDriver.enterOuter(value); this.#notify(); }
  clearOuter(): void { this.#effective().openIsdDriver.clearOuter(); this.#notify(); }
  OuterX(): number | null { return this.#effective().openIsdDriver.OuterX(); }
  OuterXCell(): Cell { return this.#effective().openIsdDriver.OuterXCell(); }
  enterOuterX(value: number): void { this.#effective().openIsdDriver.enterOuterX(value); this.#notify(); }
  clearOuterX(): void { this.#effective().openIsdDriver.clearOuterX(); this.#notify(); }
  OuterY(): number | null { return this.#effective().openIsdDriver.OuterY(); }
  OuterYCell(): Cell { return this.#effective().openIsdDriver.OuterYCell(); }
  enterOuterY(value: number): void { this.#effective().openIsdDriver.enterOuterY(value); this.#notify(); }
  clearOuterY(): void { this.#effective().openIsdDriver.clearOuterY(); this.#notify(); }
  DVol(): number | null { return this.#effective().openIsdDriver.DVol(); }
  DVolCell(): Cell { return this.#effective().openIsdDriver.DVolCell(); }
  enterDVol(value: number): void { this.#effective().openIsdDriver.enterDVol(value); this.#notify(); }
  clearDVol(): void { this.#effective().openIsdDriver.clearDVol(); this.#notify(); }
  brand(): string { return this.#effective().openIsdDriver.brand(); }
  brandCell(): MetaCell { return this.#effective().openIsdDriver.brandCell(); }
  enterBrand(value: string): void { this.#effective().openIsdDriver.enterBrand(value); this.#notify(); }
  clearBrand(): void { this.#effective().openIsdDriver.clearBrand(); this.#notify(); }
  model(): string { return this.#effective().openIsdDriver.model(); }
  modelCell(): MetaCell { return this.#effective().openIsdDriver.modelCell(); }
  enterModel(value: string): void { this.#effective().openIsdDriver.enterModel(value); this.#notify(); }
  clearModel(): void { this.#effective().openIsdDriver.clearModel(); this.#notify(); }
  manufacturer(): string { return this.#effective().openIsdDriver.manufacturer(); }
  manufacturerCell(): MetaCell { return this.#effective().openIsdDriver.manufacturerCell(); }
  enterManufacturer(value: string): void { this.#effective().openIsdDriver.enterManufacturer(value); this.#notify(); }
  clearManufacturer(): void { this.#effective().openIsdDriver.clearManufacturer(); this.#notify(); }
  providedBy(): string { return this.#effective().openIsdDriver.providedBy(); }
  providedByCell(): MetaCell { return this.#effective().openIsdDriver.providedByCell(); }
  enterProvidedBy(value: string): void { this.#effective().openIsdDriver.enterProvidedBy(value); this.#notify(); }
  clearProvidedBy(): void { this.#effective().openIsdDriver.clearProvidedBy(); this.#notify(); }
  comment(): string { return this.#effective().openIsdDriver.comment(); }
  commentCell(): MetaCell { return this.#effective().openIsdDriver.commentCell(); }
  enterComment(value: string): void { this.#effective().openIsdDriver.enterComment(value); this.#notify(); }
  clearComment(): void { this.#effective().openIsdDriver.clearComment(); this.#notify(); }
  added(): string { return this.#effective().openIsdDriver.added(); }
  addedCell(): MetaCell { return this.#effective().openIsdDriver.addedCell(); }
  enterAdded(value: string): void { this.#effective().openIsdDriver.enterAdded(value); this.#notify(); }
  clearAdded(): void { this.#effective().openIsdDriver.clearAdded(); this.#notify(); }

  // ---- box / vent / PR flat-field accessors, ledger QO54 ---------------------------------
  //
  // The box IS the storage: every caller reads and writes these fields through the methods
  // below, directly, reactive via `logic/liveProject.ts`'s change-notification adapter. Reads
  // go straight to the effective layer (no clone: these are read on every reactive tick);
  // writes go through `mutate()` so the existing edit/what-if notification rule keeps applying
  // with no second code path to keep in step.

  // ── Vent-group / PR-group flat enter/clear/provenance pairs — `useVentGroup.ts`/
  //    `usePrGroup.ts`'s only route to provenance-marking + solve-triggering entry. Each is a
  //    thin wrapper over the matching flat `OpenISDProject` method (which owns the actual
  //    mark-and-solve logic) — no keyed dispatch survives here, one flat method per field. The
  //    RAW named accessors elsewhere in this class (`boxVolume_m3`/`setBoxVolume_m3` etc.) do
  //    not mark provenance or solve, so they are not a substitute for these. ──────────────────
  enterBoxVolume_m3(value: number): void { this.mutate(p => p.enterBoxVolume_m3(value)); }
  clearBoxVolume_m3(): void { this.mutate(p => p.clearBoxVolume_m3()); }
  boxVolumeProvenance(): Provenance { return this.#effective().project.boxVolumeProvenance(); }

  enterBoxTuning_Fb_hz(value: number): void { this.mutate(p => p.enterBoxTuning_Fb_hz(value)); }
  clearBoxTuning_Fb_hz(): void { this.mutate(p => p.clearBoxTuning_Fb_hz()); }
  boxTuningProvenance(): Provenance { return this.#effective().project.boxTuningProvenance(); }

  enterVentDiameter_m(value: number): void { this.mutate(p => p.enterVentDiameter_m(value)); }
  clearVentDiameter_m(): void { this.mutate(p => p.clearVentDiameter_m()); }
  ventDiameterProvenance(): Provenance { return this.#effective().project.ventDiameterProvenance(); }

  enterVentLength_m(value: number): void { this.mutate(p => p.enterVentLength_m(value)); }
  clearVentLength_m(): void { this.mutate(p => p.clearVentLength_m()); }
  ventLengthProvenance(): Provenance { return this.#effective().project.ventLengthProvenance(); }

  enterVentWidth_m(value: number): void { this.mutate(p => p.enterVentWidth_m(value)); }
  clearVentWidth_m(): void { this.mutate(p => p.clearVentWidth_m()); }
  ventWidthProvenance(): Provenance { return this.#effective().project.ventWidthProvenance(); }

  enterVentHeight_m(value: number): void { this.mutate(p => p.enterVentHeight_m(value)); }
  clearVentHeight_m(): void { this.mutate(p => p.clearVentHeight_m()); }
  ventHeightProvenance(): Provenance { return this.#effective().project.ventHeightProvenance(); }

  enterPrFp_hz(value: number): void { this.mutate(p => p.enterPrFp_hz(value)); }
  clearPrFp_hz(): void { this.mutate(p => p.clearPrFp_hz()); }
  prFpProvenance(): Provenance { return this.#effective().project.prFpProvenance(); }

  enterPrAddedMass_kg(value: number): void { this.mutate(p => p.enterPrAddedMass_kg(value)); }
  clearPrAddedMass_kg(): void { this.mutate(p => p.clearPrAddedMass_kg()); }
  prAddedMassProvenance(): Provenance { return this.#effective().project.prAddedMassProvenance(); }

  solveVentGroup(): void { this.mutate(p => p.solveVentGroup()); }
  solvePrGroup(): void { this.mutate(p => p.solvePrGroup()); }
  ventAchievedFb(): number | null { return this.#effective().project.ventAchievedFb(); }
  ventMaxReachableFb(): number | null { return this.#effective().project.ventMaxReachableFb(); }
  ventTargetUnreachable(): boolean { return this.#effective().project.ventTargetUnreachable(); }
  prTargetUnreachable(): boolean { return this.#effective().project.prTargetUnreachable(); }

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
  setFrontVolume_m3(value: number): void {
    this.mutate(p => p.setFrontVolume_m3(value));
  }

  /** Rear-chamber tuning target for bandpass6/ABC. RELATIONLESS on the domain object — always
   *  reported Entered, no group solve. */
  frcHz(): number { return this.#effective().project.frcHz(); }
  setFrcHz(value: number): void { this.mutate(p => p.setFrcHz(value)); }

  /** The active vent's cross-sectional area — round or slotted, whichever it currently is.
   *  A calculated value, exposed here (not computed by any caller) per ARCHITECTURE.md §5
   *  "only the domain objects calculate". */
  ventArea_m2(): number {
    return this.#effective().project.ventArea_m2();
  }

  ventShape(): OpenISDVent['shape'] { return this.#effective().project.ventShape(); }
  setVentShape(value: OpenISDVent['shape']): void { this.mutate(p => p.setVentShape(value)); }
  ventDiameter_m(): number { return this.#effective().project.ventDiameter_m(); }
  setVentDiameter_m(value: number): void { this.mutate(p => p.setVentDiameter_m(value)); }
  ventWidth_m(): number { return this.#effective().project.ventWidth_m(); }
  setVentWidth_m(value: number): void { this.mutate(p => p.setVentWidth_m(value)); }
  ventHeight_m(): number { return this.#effective().project.ventHeight_m(); }
  setVentHeight_m(value: number): void { this.mutate(p => p.setVentHeight_m(value)); }
  ventLength_m(): number { return this.#effective().project.ventLength_m(); }
  setVentLength_m(value: number): void { this.mutate(p => p.setVentLength_m(value)); }
  ventEndCorrection(): number { return this.#effective().project.ventEndCorrection(); }
  setVentEndCorrection(value: number): void { this.mutate(p => p.setVentEndCorrection(value)); }

  /** The active vent's effective acoustic length — physical length plus the end-correction
   *  term, which needs an equivalent diameter for a slotted vent (derived from its area) since
   *  the correction is inherently a round-port concept. Calculated here, not by any caller. */
  ventEffectiveLength_m(): number {
    return this.#effective().project.ventEffectiveLength_m();
  }

  /** Drive voltage from the project's input power and the EFFECTIVE driver's Re — V = √(Pin·Re),
   *  WinISD's reference-power convention (`bugs/BUG_20260820_syncedp_computes_eg_inside_the_store.md`,
   *  the fix this getter IS: the formula lives in `@openisd/engine`, read here, never
   *  recomputed at a call site). 1 Ω assumed while the driver is too incomplete to resolve an
   *  `EngineDriver` (`toEngineDriver()` null), matching historic behaviour. */
  driveVoltage_V(): number {
    return driveVoltage(this.inputPower_W(), this.toEngineDriver()?.Re ?? 1);
  }

  /** Sealed-box (and PR rear-chamber) resonance + system Q via the given loss model. `Rs`/`Ql`/
   *  `Qa` are not yet fields of `OpenISDProjectJson` (they live on `UiParams` today), so they
   *  are taken as parameters rather than read internally — same shape as `sealedFc`'s own
   *  decoupling in `wprMapping.ts`. Null when the driver is too incomplete to resolve an
   *  `EngineDriver`, or `Vb` isn't set. */
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
    const prSd = this.prSd_m2();
    const prCms = this.prCms_m_per_N();
    if (!(Vb > 0) || !(prSd > 0) || !(prCms > 0)) return null;
    return computePrTuning({
      Vb, prSd, prCms,
      prMmd: this.prMmd_kg(), prMadd: this.prAddedMass_kg(),
    });
  }

  /** First port (organ-pipe) resonance of the vent tube itself — the open-open duct
   *  fundamental c/(2·L) on the PHYSICAL vent length, distinct from the box Helmholtz tuning. */
  portPipeResonance_hz(): number | null {
    const ventL = this.ventLength_m();
    return ventL > 0 ? moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA) / (2 * ventL) : null;
  }

  /** Passive-radiator derived T/S params, from the stored PR bag. */
  /** Adopt a radiator from its datasheet vocabulary — the one conversion, on the owner. */
  enterPrDatasheet(d: { vasL: number; fsHz: number; qms: number; sdM2: number; xmaxM?: number }): void {
    this.mutate(p => p.enterPrDatasheet(d));
  }

  prName(): string { return this.#effective().project.prName(); }
  setPrName(value: string): void { this.mutate(p => p.setPrName(value)); }
  prSd_m2(): number { return this.#effective().project.prSd_m2(); }
  setPrSd_m2(value: number): void { this.mutate(p => p.setPrSd_m2(value)); }
  prMmd_kg(): number { return this.#effective().project.prMmd_kg(); }
  setPrMmd_kg(value: number): void { this.mutate(p => p.setPrMmd_kg(value)); }
  prCms_m_per_N(): number { return this.#effective().project.prCms_m_per_N(); }
  setPrCms_m_per_N(value: number): void { this.mutate(p => p.setPrCms_m_per_N(value)); }
  prRms_Ns_per_m(): number { return this.#effective().project.prRms_Ns_per_m(); }
  setPrRms_Ns_per_m(value: number): void { this.mutate(p => p.setPrRms_Ns_per_m(value)); }
  prXmax_m(): number { return this.#effective().project.prXmax_m(); }
  setPrXmax_m(value: number): void { this.mutate(p => p.setPrXmax_m(value)); }

  /** Datasheet-vocabulary PR views — each a reverse-solve into the canonical fields above via
   *  `OpenISDProject.enter()`, not simple storage. */
  prVas_m3(): number { return this.#effective().project.prVas_m3(); }
  setPrVas_m3(value: number): void { this.mutate(p => p.setPrVas_m3(value)); }
  prFs_hz(): number { return this.#effective().project.prFs_hz(); }
  setPrFs_hz(value: number): void { this.mutate(p => p.setPrFs_hz(value)); }
  prQms(): number { return this.#effective().project.prQms(); }
  setPrQms(value: number): void { this.mutate(p => p.setPrQms(value)); }
  /** Fs including the added mass — derived, no setter. */
  prFsMass_hz(): number { return this.#effective().project.prFsMass_hz(); }

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
   *  copy-out/write-back discipline as `snapshot()`. Prefer `addFilter`/`removeFilter`/
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
  // Which box/vent/PR fields the user entered, one home: `OpenISDProjectJson.target.entered`.

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

  // ---- project reads and writes ----------------------------------------------------------

  /**
   * A COPY of the effective project, safe to read and impossible to write back through. A copy
   * rather than the object itself, because handing out the object would be handing out the
   * state — the thing this class exists to prevent.
   */
  snapshot(): OpenISDProject {
    return this.#effective().project.copy();
  }

  /**
   * Change the effective project — box, vent, environment, signal, filters, anything that is
   * not a driver field.
   *
   * The mutation happens inside the callback so that this class stays in charge of what follows
   * it — re-reading the effective layer's driver reference and notifying. A caller that
   * mutated a project it had been handed could not be given either behaviour.
   */
  mutate(fn: (project: OpenISDProject) => void): void {
    const layer = this.#effective();
    fn(layer.project);
    // The driver may have been replaced wholesale (a different driver chosen), so the layer's
    // own reference is re-read rather than left pointing at the old one.
    layer.openIsdDriver = layer.project.driver();
    this.#notify();
  }

  // ---- the project, for anything persistent ----------------------------------------------

  /**
   * The project to SAVE, EXPORT or SHARE — committed state, never an open overlay, and it
   * cancels an active what-if first as an observable side effect.
   *
   * That cancellation is STRUCTURAL: this is the only route to a persistable project, so no
   * call site can forget it. NOT for a read that merely needs to know what committed state
   * currently looks like without acting on the user's behalf — use `committedSnapshot()` for
   * that (BUG_20260825: the autosave watcher called this on every reactive tick, silently
   * cancelling an open what-if moments after the user opened one).
   */
  projectToPersist(): OpenISDProject {
    this.#endWhatIfIfActive();
    return this.#committed.project.copy();
  }

  /** Committed state, read-only — never cancels an open what-if. For a caller that only needs
   *  to observe what committed state looks like (e.g. an autosave watcher deciding what to
   *  write), not one performing an explicit save/export/share action. */
  committedSnapshot(): OpenISDProject {
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

  /** Replace the whole design with an empty one, holding an empty (unfilled) driver — see
   *  `createEmpty()`. */
  loadEmpty(): void {
    this.load(OpenISDProject.empty(OpenISDDriver.empty()));
  }

  // ---- driver file IO (QO78: driver/project file IO lives IN the managed layer) ----------
  //
  // The driver enters and leaves this class as SERIALISED TEXT/BYTES, never as the private
  // record shape — no caller outside the licensed modules can name, alias, or clone the
  // record (QO73, behavioral §"ENCAPSULATION IS ABSOLUTE"). Construction of the live
  // `OpenISDDriver` happens here, inside the gate's licensed set.

  /** Adopt a driver from WinISD `.wdr` text into the CURRENT design, leaving the box and
   *  everything else alone — choosing a driver is not opening a new project. */
  loadDriverFromWdrText(text: string): void {
    const driver = OpenISDDriver.fromWdrText(text);
    this.mutate(p => { p.setDriver(driver); });
  }

  /** Adopt a driver from `.owdr` text (the record's own YAML serialisation, BUG_20260826).
   *  Throws on malformed YAML — for a checked, non-throwing adoption of UNTRUSTED text
   *  (localStorage, a share link, still JSON) use `loadDriverFromPersistedText`. */
  loadDriverFromOwdrText(text: string): void {
    const driver = OpenISDDriver.fromOwdrYml(text);
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
    const driver = OpenISDDriver.fromOwdrJson(text);
    this.mutate(p => { p.setDriver(driver); });
    return [];
  }

  /** The COMMITTED driver as persisted text (its own JSON serialisation) — what a save, a
   *  share link, or a ground fingerprint embeds. Cancels an active what-if first, the same
   *  structural guard as `projectToPersist()`. */
  persistedDriverText(): string {
    this.#endWhatIfIfActive();
    return this.#committed.openIsdDriver.toOwdrJson();
  }

  /**
   * The committed driver's own serialisation. TEXT — `ManagedProject` never hands an
   * `OpenISDDriver` out (architecture.test.ts, "every public member returns data"), so this is
   * the sanctioned channel: any caller LICENSED to construct a driver (today:
   * `DriverEditorModal.vue`, via `OpenISDDriver.fromOwdrJson`) can build its own detached
   * instance from this text without this class handing out the live object itself. Becomes
   * part of the capability seam when serialisation goes `#`-private.
   */
  committedDriverText(): string {
    this.#endWhatIfIfActive();
    return this.#committed.openIsdDriver.toOwdrJson();
  }

  /** The COMMITTED driver as `.wdr` bytes. Every field not entered projects to its WinISD
   *  default (`OpenISDDriver.toWinISDDriver()`'s fallback-fill), so this never refuses on an
   *  unfilled driver — `errors` carries warnings only (a non-finite or entered-zero field). */
  exportDriverWdr(): Result<Uint8Array<ArrayBuffer>> {
    this.#endWhatIfIfActive();
    const { value: text, errors } = this.#committed.openIsdDriver.toWdrText();
    if (!text) return { value: null, errors };
    return { value: winisdTextToBytes(text), errors };
  }

  /** The COMMITTED driver as `.owdr` bytes — cannot fail (the record is always representable
   *  as its own YAML, BUG_20260826). */
  exportDriverOwdr(): Uint8Array<ArrayBuffer> {
    this.#endWhatIfIfActive();
    return new TextEncoder().encode(this.#committed.openIsdDriver.toOwdrYml()) as Uint8Array<ArrayBuffer>;
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
  toUiParams(): UiParams { return this.#effective().project.toUiParams(); }

  /** Adopt a `UiParams` blob — the domain's own restore (`OpenISDProject.loadUiParams`),
   *  wrapped in `mutate` for the single notification every public mutator owes. */
  loadUiParams(p: Partial<UiParams>, box: AlignmentKind): void {
    this.mutate(project => project.loadUiParams(p, box));
  }

  // ---- subscription -------------------------------------------------------------------------

  subscribe(fn: ManagedProjectListener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(): void {
    for (const fn of [...this.#listeners]) fn();
  }
}
