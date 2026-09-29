/**
 * Give a box type a sane starting volume (and, for vented, tuning + vent geometry) the first
 * time it becomes active with nothing entered — mirroring exactly what the New Project wizard
 * already writes when it FIRST creates a project of that type (OriginalNewProject-hooks.ts's own
 * `createProject()`), applied again whenever an EXISTING project switches into a type it has
 * never used. Every box type's volume field is always present and independently dormant
 * (Box's own doc comment), so switching types with none of this left every downstream chart
 * sweep failing (group delay, max SPL) and the vent pane unable to solve a length at all — a
 * `Vb`/`Fb`/`area_m2` of 0 has no Helmholtz solution.
 *
 * Bug (John, live on his phone, 2026-09-29): "the app needs to pick defaults for these
 * components that don't cause immediate errors, sealed should be a vol for flat if none selected
 * same for others, for vent".
 *
 * Never overwrites anything already entered — every branch checks the type's own volume is
 * still exactly 0 (the domain's unset state) before writing.
 */
import type {ComputedRef, Ref} from 'vue';
import {watch} from 'vue';
import type {OpenISDProject, Vent} from '@openisd/design';
import type {BoxType, SealedEngine, VentedEngine} from '@openisd/design/engine';
import {DEFAULT_SOURCE_RESISTANCE_OHM} from '@openisd/design/fields';
import {defaultPassiveRadiator} from '../logic/appState.js';

export interface BoxTypeVolumeDefaultsDeps {
  project: ComputedRef<OpenISDProject>;
  selectedBox: Ref<BoxType>;
  sealed: SealedEngine;
  vented: VentedEngine;
}

/** SEALED_ALIGNMENT_OPTIONS' own "0.707 Max flat amplitude response" — Butterworth. */
const FLAT_SEALED_QTC = 0.707;
/** VENTED_ALIGNMENT_OPTIONS' own "QB3 Quasi-butterworth". */
const FLAT_VENTED_ALIGNMENT = 'qb3';
/** Matches OriginalNewProject-hooks.ts's own NEW_PROJECT_VENTED_QL and vent diameter default. */
const DEFAULT_VENTED_QL = 10;
const DEFAULT_VENT_DIAMETER_M = 0.05;
/** OriginalNewProject-hooks.ts's own `vol = ref(7)` (litres) — not alignment-derived like
 *  sealed/vented, just a flat starting point the wizard itself uses for PR/dual-chamber types. */
const DEFAULT_PR_VOLUME_M3 = 0.007;
/** OriginalNewProject-hooks.ts's own PR tuning-goal default. */
const DEFAULT_PR_TUNING_HZ = 35;
/** A slotted vent's height has no driver-relative analogue to borrow (unlike width, below) — a
 *  plausible fixed starting slot height. */
const DEFAULT_VENT_SLOT_HEIGHT_M = 0.03;
/** "default the width as same as driver dia if known otherwise 10cm" — the round-vent fallback
 *  above is 5cm; a slot is wider than a round port of the same area, so this fallback is wider
 *  too, matching John's own number. */
const DEFAULT_VENT_SLOT_WIDTH_FALLBACK_M = 0.10;
/** Named so nobody mistakes it for a real spec sheet (John, 2026-09-29: "can be called
 *  Placeholder and ReplaceMe"). */
const PLACEHOLDER_PR_BRAND = 'Placeholder';
const PLACEHOLDER_PR_MODEL = 'ReplaceMe';
/** "a similar displacement X2... to the main driver" — a passive radiator has no motor forcing
 *  it, so it commonly needs more excursion capability than the driver it complements; double is
 *  the rule-of-thumb John gave. */
const PR_XMAX_MULTIPLE_OF_DRIVER = 2;

/** Fills whichever of a vent's two geometry pairs its current `shape` uses — diameter (round) or
 *  width/height (slotted) — only where still unset. `driverDd_m` borrows the main driver's own
 *  diaphragm diameter for a slotted vent's width when it's known ("default the width as same as
 *  driver dia if known otherwise 10cm", John); a round vent's diameter has no such analogue in
 *  the wizard's own precedent, so it keeps the flat 5cm default regardless. */
function defaultVentGeometry(vent: Vent, driverDd_m: number | null): void {
  if (vent.shape.value === 'slotted') {
    if ((vent.width_m.value ?? 0) <= 0) {
      vent.width_m.set(driverDd_m != null && driverDd_m > 0 ? driverDd_m : DEFAULT_VENT_SLOT_WIDTH_FALLBACK_M);
    }
    if ((vent.height_m.value ?? 0) <= 0) vent.height_m.set(DEFAULT_VENT_SLOT_HEIGHT_M);
  } else if ((vent.diameter_m.value ?? 0) <= 0) {
    vent.diameter_m.set(DEFAULT_VENT_DIAMETER_M);
  }
}

export function createBoxTypeVolumeDefaults({ project, selectedBox, sealed, vented }: BoxTypeVolumeDefaultsDeps): void {
  // `immediate: true`: a project opened directly on a type it has never used (not just one
  // switched into mid-session) gets the same default, not only a later switch.
  watch(selectedBox, (b) => {
    const p = project.value;
    const ts = p.driver.specs;

    // Passive radiator: not alignment-derived (no Qts/Vas needed) — a flat starting volume plus
    // a chart-ready PR, exactly what the wizard's own createProject() writes for this type, then
    // sized off the real driver where one is known ("a similar displacement X2 and a similar
    // diameter... to the main driver", John) — named so it reads as a stand-in, never mistaken
    // for a real spec sheet.
    if (b === 'box-passive-radiator') {
      if (p.box.passiveRadiator.volume_m3.value > 0) return;
      p.box.passiveRadiator.volume_m3.set(DEFAULT_PR_VOLUME_M3);
      defaultPassiveRadiator(p);
      p.box.passiveRadiator.tuning_goal_hz.set(DEFAULT_PR_TUNING_HZ);
      p.box.passiveRadiator.radiator.brand.set(PLACEHOLDER_PR_BRAND);
      p.box.passiveRadiator.radiator.model.set(PLACEHOLDER_PR_MODEL);
      const driverSd_m2 = ts.Sd_m2.value;
      if (driverSd_m2 != null && driverSd_m2 > 0) p.box.passiveRadiator.radiator.spec.Sd_m2.set(driverSd_m2);
      const driverXmax_m = ts.Xmax_m.value;
      if (driverXmax_m != null && driverXmax_m > 0) {
        p.box.passiveRadiator.radiator.spec.Xmax_m.set(driverXmax_m * PR_XMAX_MULTIPLE_OF_DRIVER);
      }
      return;
    }

    const Qts = ts.Qts.value;
    const Vas_m3 = ts.Vas_m3.value;
    if (Qts == null || Vas_m3 == null) return; // no driver specs yet — nothing to compute from

    switch (b) {
      case 'sealed': {
        if (p.box.sealed.volume_m3.value > 0) return;
        const Vb = sealed.volumeForQtc(Qts, Vas_m3, FLAT_SEALED_QTC);
        if (Vb != null && Vb > 0) p.box.sealed.volume_m3.set(Vb);
        break;
      }
      case 'vented': {
        if (p.box.vented.volume_m3.value > 0) return;
        const Fs_hz = ts.Fs_hz.value;
        if (Fs_hz == null) return;
        const QtsLoaded = p.driver.sourceLoadedQts(p.Rs_ohm.value ?? DEFAULT_SOURCE_RESISTANCE_OHM);
        if (QtsLoaded == null) return;
        const Ql = p.box.vented.losses.Ql.value || DEFAULT_VENTED_QL;
        const design = vented.alignment(FLAT_VENTED_ALIGNMENT, Fs_hz, QtsLoaded, Vas_m3, Ql);
        p.box.vented.volume_m3.set(design.Vb);
        p.box.vented.tuning_goal_hz.set(design.Fb);
        defaultVentGeometry(p.box.vented.vent, ts.Dd_m.value);
        break;
      }
      case 'bandpass4':
      case 'bandpass6':
      case 'abc':
        // Not covered yet — dual-chamber geometry is more involved; scoped to sealed/vented/PR
        // per the immediate bug report.
        break;
    }
  }, { immediate: true });
}
