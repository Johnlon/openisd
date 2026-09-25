/**
 * The Options dialog's application settings — not a project's.
 *
 * Environment: the temperature/humidity/pressure a project reads for any of the three it has
 * not entered. Vented design limits: the band a designed vented box is judged plausible
 * against. WinISD extrapolates its alignment polynomials outside their design range, OpenISD
 * matches it bit-exact, and an implausible answer is marked rather than changed (John
 * 2026-09-22: "keep parity and use dq — this is the way"). Not editable here: the non-physical
 * judgement (zero, negative, non-finite), which is absolute and has no band to set.
 *
 * Everything is a draft until `apply()` — the dialog's OK. The user sees litres and hertz; the
 * repo stores m³ and hertz. This hook is that boundary.
 */
import {computed, type ComputedRef, ref, type Ref} from 'vue';
import type {Air, EnvDefaults, VentedDesignLimits} from '@openisd/design/engine';
import {
  envDefaults as appEnvDefaults,
  FACTORY_ENV_DEFAULTS,
  FACTORY_VENTED_LIMITS,
  setEnvDefaults as setAppEnvDefaults,
  setVentedLimits as setAppVentedLimits,
  ventedLimits as appVentedLimits,
} from '../logic/appState.js';
import {airForEnvironment} from '../logic/environment.js';
import type {ChartTabId} from '../types.js';

/** The settings seam this dialog edits through — `appState`'s by default, a substitute in a test. */
export interface OptionsModalDeps {
  ventedLimits(): VentedDesignLimits;
  setVentedLimits(limits: VentedDesignLimits): void;
  envDefaults(): EnvDefaults;
  setEnvDefaults(defaults: EnvDefaults): void;
}

/** One row of the Plot Window "Limits" table: a chart and WinISD's default Y range for it. */
export interface LimitRow {
  readonly tab: ChartTabId;
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly unit: string;
}

/**
 * WinISD's per-chart Start/End/Unit table, in WinISD's order. `start`/`end` are shown as the
 * row's placeholder until the user sets an override; an untouched row keeps auto-scaling —
 * no default is ever written to `presentationState.yRanges`.
 *
 * `tab` is a `ChartTabId`, not a string: the row was keyed `'TFmag'` while the chart is
 * `'TFMag'`, so the override landed under a key no chart read (John, 2026-09-24: "The
 * selection of the Y axis limits of the TFM chart seem not to do anything"). WinISD's "EQ
 * transfer func mag" is OpenISD's filter-magnitude chart, `FltMag`.
 */
export const LIMIT_ROWS: readonly LimitRow[] = [
  { tab: 'TFMag',     label: 'Transfer func. magn.',  start: -30,  end: 6,    unit: 'dB' },
  { tab: 'FltMag',    label: 'EQ transfer func mag',  start: -40,  end: 20,   unit: 'dB' },
  { tab: 'Phase',     label: 'Transfer func. phase',  start: -180, end: 180,  unit: 'deg' },
  { tab: 'SPL',       label: 'SPL',                   start: 40,   end: 115,  unit: 'dB' },
  { tab: 'Excursion', label: 'Cone excursion',        start: 0.0,  end: 30.0, unit: 'mm peak' },
  { tab: 'Zmag',      label: 'Impedance',             start: 0,    end: 150,  unit: 'ohm' },
  { tab: 'Zph',       label: 'Impedance phase',       start: -90,  end: 90,   unit: 'deg' },
  { tab: 'GD',        label: 'Group delay',           start: 0,    end: 40,   unit: 'ms' },
  { tab: 'MaxPwr',    label: 'Maximum power',         start: 0,    end: 500,  unit: 'W' },
  { tab: 'Port',      label: 'Air velocity',          start: 0.00, end: 40.00, unit: 'm/s peak' },
];

export interface OptionsModalAPI {
  /** The band being edited, in the units on screen. Editing these writes nothing. */
  readonly minVolume_L: Ref<number>;
  readonly maxVolume_L: Ref<number>;
  readonly minTuning_hz: Ref<number>;
  readonly maxTuning_hz: Ref<number>;
  /** The environment being edited. Editing these writes nothing. */
  readonly tempK: Ref<number>;
  readonly humidityPct: Ref<number>;
  readonly pressurePa: Ref<number>;
  /** Why the edited band is not a band, or null when it is one. */
  readonly error: ComputedRef<string | null>;
  /** Whether `apply()` would write. False exactly when `error` is set. */
  readonly canApply: ComputedRef<boolean>;
  /** Whether the edited band is the factory one — what greys out its reset. */
  readonly limitsAreFactory: ComputedRef<boolean>;
  /** Whether the edited environment is the factory one — what greys out its reset. */
  readonly envIsFactory: ComputedRef<boolean>;
  /** Sound velocity and air density of the edited environment, physical model. */
  readonly defaultAir: ComputedRef<Air>;
  /** Put the factory band in the draft. Writes nothing. */
  resetLimits(): void;
  /** Put the factory environment in the draft. Writes nothing. */
  resetEnv(): void;
  /** Write the draft — both settings — and through them recall every open project. Writes
   *  nothing at all while `error` is set. */
  apply(): void;
}

const LITRES_PER_M3 = 1000;

function isPositive(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

export function useOptionsModal(deps?: OptionsModalDeps): OptionsModalAPI {
  const settings: OptionsModalDeps = deps ?? {
    ventedLimits: appVentedLimits,
    setVentedLimits: setAppVentedLimits,
    envDefaults: appEnvDefaults,
    setEnvDefaults: setAppEnvDefaults,
  };

  const band = settings.ventedLimits();
  const minVolume_L = ref(band.minVb_m3 * LITRES_PER_M3);
  const maxVolume_L = ref(band.maxVb_m3 * LITRES_PER_M3);
  const minTuning_hz = ref(band.minFb_hz);
  const maxTuning_hz = ref(band.maxFb_hz);

  const env = settings.envDefaults();
  const tempK = ref(env.tempK);
  const humidityPct = ref(env.humidityPct);
  const pressurePa = ref(env.pressurePa);

  /** The edited values as the band they would become — not yet checked. */
  const editedBand = computed<VentedDesignLimits>(() => ({
    minVb_m3: minVolume_L.value / LITRES_PER_M3,
    maxVb_m3: maxVolume_L.value / LITRES_PER_M3,
    minFb_hz: minTuning_hz.value,
    maxFb_hz: maxTuning_hz.value,
  }));

  const editedEnv = computed<EnvDefaults>(() => ({
    tempK: tempK.value,
    humidityPct: humidityPct.value,
    pressurePa: pressurePa.value,
  }));

  const error = computed<string | null>(() => {
    const b = editedBand.value;
    if (!isPositive(b.minVb_m3) || !isPositive(b.maxVb_m3)) {
      return 'Both volume limits must be greater than zero.';
    }
    if (!isPositive(b.minFb_hz) || !isPositive(b.maxFb_hz)) {
      return 'Both tuning limits must be greater than zero.';
    }
    if (b.minVb_m3 >= b.maxVb_m3) {
      return 'Minimum volume must be below maximum volume.';
    }
    if (b.minFb_hz >= b.maxFb_hz) {
      return 'Minimum tuning must be below maximum tuning.';
    }
    return null;
  });

  const canApply = computed(() => error.value === null);

  const limitsAreFactory = computed(() => {
    const b = editedBand.value;
    return b.minVb_m3 === FACTORY_VENTED_LIMITS.minVb_m3
      && b.maxVb_m3 === FACTORY_VENTED_LIMITS.maxVb_m3
      && b.minFb_hz === FACTORY_VENTED_LIMITS.minFb_hz
      && b.maxFb_hz === FACTORY_VENTED_LIMITS.maxFb_hz;
  });

  const envIsFactory = computed(() => {
    const e = editedEnv.value;
    return e.tempK === FACTORY_ENV_DEFAULTS.tempK
      && e.humidityPct === FACTORY_ENV_DEFAULTS.humidityPct
      && e.pressurePa === FACTORY_ENV_DEFAULTS.pressurePa;
  });

  const defaultAir = computed<Air>(() => airForEnvironment(editedEnv.value));

  function resetLimits(): void {
    minVolume_L.value = FACTORY_VENTED_LIMITS.minVb_m3 * LITRES_PER_M3;
    maxVolume_L.value = FACTORY_VENTED_LIMITS.maxVb_m3 * LITRES_PER_M3;
    minTuning_hz.value = FACTORY_VENTED_LIMITS.minFb_hz;
    maxTuning_hz.value = FACTORY_VENTED_LIMITS.maxFb_hz;
  }

  function resetEnv(): void {
    tempK.value = FACTORY_ENV_DEFAULTS.tempK;
    humidityPct.value = FACTORY_ENV_DEFAULTS.humidityPct;
    pressurePa.value = FACTORY_ENV_DEFAULTS.pressurePa;
  }

  function apply(): void {
    if (!canApply.value) return;
    settings.setEnvDefaults(editedEnv.value);
    settings.setVentedLimits(editedBand.value);
  }

  return {
    minVolume_L, maxVolume_L, minTuning_hz, maxTuning_hz,
    tempK, humidityPct, pressurePa,
    error, canApply, limitsAreFactory, envIsFactory, defaultAir,
    resetLimits, resetEnv, apply,
  };
}
