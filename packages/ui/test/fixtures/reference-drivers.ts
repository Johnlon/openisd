/**
 * Reference drivers and their expected physical constants across enclosure alignments.
 *
 * Bundles driver characteristics (Thiele/Small parameters) together with their
 * verified expected outputs (Qtc, fc, Fb, etc.) under the engine's air baseline,
 * so tests do not scatter hardcoded numbers inline.
 */

export interface DriverCharacteristics {
  brand: string;
  model: string;
  Fs_hz: number;
  Qts: number;
  Vas_L: number;
  Qes?: number;
  Qms?: number;
  Re_ohm?: number;
  Sd_cm2?: number;
  Xmax_mm?: number;
  BL_Tm?: number;
  Mms_g?: number;
  Cms_mm_per_N?: number;
  Le_mH?: number;
  Pe_W?: number;
}

export interface ExpectedSealed {
  Vb_L: number;
  Qtc: string;
  fc_hz: string;
}

export interface ExpectedVented {
  Vb_L: number;
  Fb_hz: string;
  ventD_cm?: number;
  ventL_cm?: number;
}

export interface ExpectedAlignments {
  sealed?: Record<string, ExpectedSealed>;
  vented?: Record<string, ExpectedVented>;
  butterworth?: {
    Vb_L?: number;
    Qtc: string;
    fc_hz?: string;
  };
  [key: string]: unknown;
}

export class ReferenceDriverFixture {
  constructor(
    public readonly id: string,
    public readonly characteristics: DriverCharacteristics,
    public readonly expected: ExpectedAlignments = {},
  ) {}

  get brand(): string { return this.characteristics.brand; }
  get model(): string { return this.characteristics.model; }
  get name(): string { return `${this.brand} ${this.model}`.trim(); }
  get Fs(): number { return this.characteristics.Fs_hz; }
  get Qts(): number { return this.characteristics.Qts; }
  get Vas_L(): number { return this.characteristics.Vas_L; }
  get Vas_m3(): number { return this.characteristics.Vas_L / 1000; }
  get Qes(): number | undefined { return this.characteristics.Qes; }
  get Qms(): number | undefined { return this.characteristics.Qms; }
  get Re(): number | undefined { return this.characteristics.Re_ohm; }
  get Sd_cm2(): number | undefined { return this.characteristics.Sd_cm2; }
  get Sd_m2(): number | undefined {
    return this.characteristics.Sd_cm2 != null ? this.characteristics.Sd_cm2 / 10000 : undefined;
  }

  toSeedDriver() {
    return {
      brand: this.brand,
      model: this.model,
      specs: {
        Fs_hz: this.Fs,
        Qts: this.Qts,
        Qms: this.Qms,
        Vas_m3: this.Vas_m3,
        Re_ohm: this.Re,
        Sd_m2: this.Sd_m2,
        Xmax_m: this.characteristics.Xmax_mm != null ? this.characteristics.Xmax_mm / 1000 : undefined,
      },
    };
  }
}

/**
 * Tang Band W5-1138SMF 5" Subwoofer (authoritative manufacturer datasheet baseline).
 */
export const W5_1138SMF = new ReferenceDriverFixture(
  'w5-1138smf',
  {
    brand: 'Tang Band',
    model: 'W5-1138SMF',
    Fs_hz: 45,
    Qts: 0.49,
    Vas_L: 4.85,
    Qes: 0.57,
    Qms: 3.56,
    Re_ohm: 3.4,
    Sd_cm2: 94,
    Xmax_mm: 9.25,
    BL_Tm: 7.17,
    Mms_g: 28.81,
    Cms_mm_per_N: 0.36872,
    Le_mH: 0.34,
    Pe_W: 40,
  },
  {
    sealed: {
      '20L': {
        Vb_L: 20,
        Qtc: '0.781',
        fc_hz: '60.7',
      },
      defaultAlignment: {
        Vb_L: 4.51,
        Qtc: '0.707',
        fc_hz: '64.9',
      },
    },
    butterworth: {
      Vb_L: 4.51,
      Qtc: '0.707',
      fc_hz: '64.9',
    },
    vented: {
      sampleProject: {
        Vb_L: 7.0,
        Fb_hz: '35.0',
        ventD_cm: 5.0,
        ventL_cm: 65.6,
      },
    },
  },
);

/**
 * Generic 37 Hz reference driver (Small/Thiele synthetic benchmark from scenarios.ts).
 */
export const GENERIC_37HZ = new ReferenceDriverFixture(
  'generic-37hz',
  {
    brand: 'Generic',
    model: '37Hz Sub',
    Fs_hz: 37,
    Qts: 0.38,
    Vas_L: 30,
    Sd_cm2: 196.35,
    Re_ohm: 6.0,
  },
  {
    sealed: {
      '20L': {
        Vb_L: 20,
        Qtc: '0.611',
        fc_hz: '61.4',
      },
    },
    butterworth: {
      Vb_L: 12.18,
      Qtc: '0.708',
      fc_hz: '72.2',
    },
    vented: {
      '30L_5cm_10cm': {
        Vb_L: 30,
        ventD_cm: 5,
        ventL_cm: 10,
        Fb_hz: '37.9',
      },
    },
  },
);

/**
 * Golden master driver (WinISD 0.7.0.950 parity reference from sealed-fsc-winisd-golden).
 */
export const GOLDEN_WINISD_40HZ = new ReferenceDriverFixture(
  'golden-winisd-40hz',
  {
    brand: 'WinISD',
    model: 'Golden 40Hz',
    Fs_hz: 40,
    Qts: 0.39,
    Qes: 0.45,
    Qms: 2.94,
    Vas_L: 7.65,
    Re_ohm: 6.6,
  },
  {
    sealed: {
      '6L_lossy': {
        Vb_L: 6,
        Qtc: '0.5995',
        fc_hz: '63.1762',
      },
    },
  },
);

export const REFERENCE_DRIVERS = {
  w5_1138smf: W5_1138SMF,
  generic_37hz: GENERIC_37HZ,
  golden_winisd_40hz: GOLDEN_WINISD_40HZ,
} as const;
