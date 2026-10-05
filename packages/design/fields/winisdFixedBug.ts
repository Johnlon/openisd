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
    winisd: 'WinISD\'s "Driver input voltage (each)" does not change when you change the number of drivers. It keeps showing the voltage one driver would get if it took all the input power.',
    openisd: 'OpenISD shows the voltage each driver really gets, and updates it when the number of drivers changes. A voltage you type sets the input power for all the drivers.',
    seenIn: 'the Driver input voltage (each) box on the Signal tab.',
    size: 'W5-1138SMF at 1 W with 4 drivers: WinISD shows 1.8 V, but each driver gets 0.92 V.',
  });

  static readonly PR_SD_EDIT = new WinisdFixedBug({
    title: 'WinISD ignores a typed passive radiator Sd',
    winisd: 'WinISD ignores a new Sd typed into the passive radiator pane: no chart changes. Only a project file loaded with that Sd shows it.',
    openisd: 'OpenISD uses a typed Sd straight away.',
    seenIn: 'the Cone excursion (PR) and PR air velocity charts.',
    size: 'Both change with 1/Sd: doubling Sd halves the radiator\'s excursion.',
  });

  static readonly PR_VAS_EMPTIED = new WinisdFixedBug({
    title: 'Emptying the passive radiator\'s Vas box crashes WinISD',
    winisd: 'If you delete the passive radiator\'s Vas until the box is empty, WinISD stops with a divide-by-zero error.',
    openisd: 'OpenISD never crashes when a passive radiator\'s Fs, Qms, Vas or Sd is empty or zero. Values worked out from it stay finite or are left blank.',
    seenIn: 'the passive radiator pane.',
    size: 'WinISD closes and you lose unsaved work.',
  });

  static readonly FILTER_ORDER_ABOVE_10 = new WinisdFixedBug({
    title: 'WinISD\'s filters stop at order 10',
    winisd: 'WinISD\'s filter maths overflows above order 10. Its Filter Editor stops at 10, and a project file with a higher order shows an overflow error.',
    openisd: 'OpenISD works out filters up to order 20. When you save a WinISD project, OpenISD writes an order above 10 as 10 and warns you.',
    seenIn: 'the Order box of low-pass, high-pass and allpass filters in the EQ/Filter chain.',
    size: 'A Butterworth filter of order 20 is −3.01 dB at fc, as it should be.',
  });

  static readonly SAVE_DROPS_ALLPASS = new WinisdFixedBug({
    title: 'WinISD\'s save loses an allpass filter and every filter after it',
    winisd: 'When WinISD saves a project with an allpass filter, the file stops at the allpass. When you reopen it, the allpass and every filter after it come back as default low-pass filters.',
    openisd: 'OpenISD saves every filter. It opens a WinISD project damaged this way just as WinISD does, and tells you which filters were lost.',
    seenIn: 'the EQ/Filter chain, after saving and reopening a project.',
    size: 'Every filter from the first allpass on becomes a 50 Hz, order 2 Butterworth low-pass.',
  });

  static readonly READOUTS_LAG_TYPING = new WinisdFixedBug({
    title: 'WinISD\'s readouts can lag while you type',
    winisd: 'WinISD does not always update its calculated values as you type. Typing 10 L into the volume box can leave Fsc showing the value for 1 L.',
    openisd: 'OpenISD updates every readout and chart after every edit.',
    seenIn: 'calculated readouts such as Fsc and Qtc on the Box tab, and the charts.',
    size: 'Fsc stays at 120.70 Hz, the 1 L value, after you type 10 L.',
  });

  static readonly NO_REFRESH_ON_LOAD = new WinisdFixedBug({
    title: 'WinISD does not refresh on load',
    winisd: 'After you load a file, WinISD shows old calculated values until you edit something. EBP, Rme, gamma, Mpow, SPLmax, SPLmax LF and Gloss show 0.',
    openisd: 'OpenISD works out every calculated value as soon as you load a file.',
    seenIn: 'the Driver editor\'s Advanced parameters, after opening a file.',
    size: 'Beyma 10BR60: SPLmax shows 0 until you edit something, then 111 dB.',
  });

  static readonly UNSTABLE_INPUT_FIELDS = new WinisdFixedBug({
    title: 'WinISD\'s input boxes are unstable',
    winisd: 'A mistyped character, a decimal comma or a value that divides by zero makes WinISD raise an error popup. Cancel on the popup crashes WinISD; OK brings the same popup back, again and again.',
    openisd: 'OpenISD rejects or marks a bad entry in its own box. It never crashes and never shows a popup loop.',
    seenIn: 'any number box.',
    size: 'WinISD closes and you lose unsaved work.',
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
