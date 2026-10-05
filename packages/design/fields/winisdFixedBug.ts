/** A fixed WinISD bug's help text. */
export interface WinisdFixedBugSpec {
  readonly title: string;
  /** What WinISD does, in plain words. */
  readonly winisd: string;
  /** What OpenISD does instead. */
  readonly openisd: string;
  /** Where the user meets it. */
  readonly seenIn: string;
  /** How large the effect is, for a realistic case. */
  readonly size: string;
}

/**
 * A WinISD update, linkage, crash or data-loss bug that OpenISD fixes with no switch and no ≠W cue:
 * there is nothing to reproduce on purpose (CLAUDE.md "WinISD controls behave as native WinISD").
 */
export class WinisdFixedBug {
  readonly title: string;
  readonly winisd: string;
  readonly openisd: string;
  readonly seenIn: string;
  readonly size: string;

  private constructor(spec: WinisdFixedBugSpec) {
    this.title = spec.title;
    this.winisd = spec.winisd;
    this.openisd = spec.openisd;
    this.seenIn = spec.seenIn;
    this.size = spec.size;
  }

  static readonly DRIVE_VOLTAGE_EACH = new WinisdFixedBug({
    title: 'WinISD\'s driver voltage (each) ignores the driver count',
    winisd: 'WinISD\'s "Driver input voltage (each)" readout does not change when the number of drivers changes: it keeps showing the voltage of one driver taking the whole input power.',
    openisd: 'OpenISD shows the voltage each driver really gets and recomputes it when the driver count changes. A typed voltage sets the input power of the whole array.',
    seenIn: 'the Signal tab\'s Driver input voltage (each) readout.',
    size: 'W5-1138SMF at 1 W and 4 drivers: WinISD shows 1.8 V; each driver gets 0.92 V.',
  });

  static readonly PR_SD_EDIT = new WinisdFixedBug({
    title: 'WinISD ignores a typed passive radiator Sd',
    winisd: 'Typing a new Sd into WinISD\'s passive radiator pane changes no chart; only a project file loaded with that Sd draws it.',
    openisd: 'OpenISD applies a typed Sd at once.',
    seenIn: 'the Cone excursion (PR) and PR air velocity charts.',
    size: 'Both scale as 1/Sd: doubling Sd halves the radiator\'s excursion.',
  });

  static readonly PR_VAS_EMPTIED = new WinisdFixedBug({
    title: 'Emptying the passive radiator\'s Vas box crashes WinISD',
    winisd: 'Deleting the passive radiator\'s Vas until the box is empty makes WinISD stop with a divide-by-zero error.',
    openisd: 'OpenISD never crashes on an empty or zero passive radiator Fs, Qms, Vas or Sd: every value worked out from it stays finite or is left blank.',
    seenIn: 'the passive radiator pane.',
    size: 'WinISD closes and unsaved work is lost.',
  });

  static readonly FILTER_ORDER_ABOVE_10 = new WinisdFixedBug({
    title: 'WinISD\'s filters stop at order 10',
    winisd: 'WinISD\'s filter calculation overflows above order 10: its Filter Editor stops at 10, and a project file with a higher order shows an overflow error.',
    openisd: 'OpenISD calculates filters up to order 20. Saved as a WinISD project, an order above 10 is written as 10, with a warning.',
    seenIn: 'the Order box of low-pass, high-pass and allpass filters in the EQ/Filter chain.',
    size: 'A Butterworth of order 20 is −3.01 dB at fc, as it should be.',
  });

  static readonly SAVE_DROPS_ALLPASS = new WinisdFixedBug({
    title: 'WinISD\'s save loses an allpass filter and every filter after it',
    winisd: 'When WinISD saves a project holding an allpass filter, the file stops at the allpass; reopened, it and every filter after it come back as default low-pass filters.',
    openisd: 'OpenISD saves every filter. A WinISD project damaged this way opens as WinISD opens it, with a warning naming the lost filters.',
    seenIn: 'the EQ/Filter chain, after saving and reopening a project.',
    size: 'Every filter from the first allpass on becomes a 50 Hz order-2 Butterworth low-pass.',
  });

  static readonly READOUTS_LAG_TYPING = new WinisdFixedBug({
    title: 'WinISD\'s readouts can lag while you type',
    winisd: 'WinISD does not always recompute its calculated values on each keystroke: typing 10 L into the volume box can leave Fsc showing the value for 1 L.',
    openisd: 'OpenISD recomputes every readout and chart on every edit.',
    seenIn: 'calculated readouts such as Fsc and Qtc on the Box tab, and the charts.',
    size: 'Fsc stuck at 120.70 Hz, the 1 L value, after typing 10 L.',
  });

  static readonly NO_REFRESH_ON_LOAD = new WinisdFixedBug({
    title: 'WinISD does not refresh on load',
    winisd: 'After loading a file, WinISD shows stale calculated values until you edit something: EBP, Rme, gamma, Mpow, SPLmax, SPLmax LF and Gloss read 0.',
    openisd: 'OpenISD works out every calculated value as soon as a file is loaded.',
    seenIn: 'the Driver editor\'s Advanced parameters, after opening a file.',
    size: 'SPLmax reads 0 until an edit, then 111 dB (Beyma 10BR60).',
  });

  static readonly UNSTABLE_INPUT_FIELDS = new WinisdFixedBug({
    title: 'WinISD\'s input boxes are unstable',
    winisd: 'A mistyped character, a decimal comma or a value that divides by zero makes WinISD raise an error popup. Cancel on the popup crashes WinISD; OK brings the same popup back, again and again.',
    openisd: 'OpenISD rejects or flags a bad entry in its box. It never crashes and never loops.',
    seenIn: 'any number box.',
    size: 'WinISD closes and unsaved work is lost.',
  });

  static readonly CHARTS_DO_NOT_REPAINT = new WinisdFixedBug({
    title: 'WinISD\'s charts disappear',
    winisd: 'WinISD\'s charts can disappear and stay blank until you change something.',
    openisd: 'OpenISD always redraws its charts.',
    seenIn: 'every chart.',
    size: 'The chart stays blank until the next edit.',
  });

  /** Every fixed bug, by reflection; declared last. */
  static readonly ALL: readonly WinisdFixedBug[] =
    Object.freeze(Object.values(WinisdFixedBug).filter((v): v is WinisdFixedBug => v instanceof WinisdFixedBug));
}
