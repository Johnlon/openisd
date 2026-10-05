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

  static readonly DRIVER_WITHOUT_FS_VAS = new WinisdFixedBug({
    title: 'A driver without Fs or Vas crashes WinISD',
    winisd: 'WinISD does not work out a missing Fs or Vas when it opens a project: a driver given by Mms, Cms, BL, Re, Qms and Sd alone makes WinISD stop with a divide-by-zero error at the first chart. A driver with no parameters at all stops it with "Invalid floating point operation" on opening the Box tab or the Driver editor.',
    openisd: 'OpenISD works out the missing parameters from the ones given and never crashes; what cannot be worked out is left blank.',
    seenIn: 'opening a project or driver file, the Box tab and the Driver editor.',
    size: 'WinISD closes and unsaved work is lost.',
  });

  static readonly PR_BOX_VOLUME_BLANK = new WinisdFixedBug({
    title: 'A blank passive radiator box volume traps WinISD in a popup loop',
    winisd: 'Deleting the Volume on WinISD\'s Box tab for a passive radiator box and leaving the box empty brings up an error popup that keeps coming back.',
    openisd: 'OpenISD takes an empty volume as no value: readouts that need it are left blank and nothing pops up.',
    seenIn: 'the Volume box on the Box tab, passive radiator boxes.',
    size: 'WinISD has to be closed; unsaved work is lost.',
  });

  static readonly FIGURES_OF_MERIT_ON_LOAD = new WinisdFixedBug({
    title: 'WinISD shows 0 for a loaded driver\'s figures of merit until you edit something',
    winisd: 'WinISD does not work out EBP, Rme, gamma, Mpow, SPLmax, SPLmax LF and Gloss when a driver file is opened: they show 0 in the colour of a calculated value until any field is edited.',
    openisd: 'OpenISD works out every calculated value as soon as the driver is loaded.',
    seenIn: 'the Driver editor\'s Advanced parameters.',
    size: 'SPLmax shows 0 until an edit, then 111 dB (Beyma 10BR60).',
  });

  static readonly DECIMAL_COMMA = new WinisdFixedBug({
    title: 'WinISD drops what is typed before a decimal comma',
    winisd: 'WinISD reads a typed "0,1" as 1: the comma and everything before it are dropped, with no warning.',
    openisd: 'OpenISD reads a comma as the decimal point: "0,1" is 0.1.',
    seenIn: 'any number box, such as Sd in the Driver editor.',
    size: 'Sd typed as 0,1 m² becomes 1 m², ten times too large, and Dd, Vd and the SPL follow it.',
  });

  static readonly COMMENT_CHARACTERS = new WinisdFixedBug({
    title: 'WinISD loses some characters of a driver comment',
    winisd: 'WinISD saves a driver comment correctly but cannot read some characters back: ¤ and some Cyrillic and Indian letters come back as "?" and a line break, and saving again writes the damage into the file.',
    openisd: 'OpenISD reads and writes every character of a comment, and reads WinISD\'s own files the way WinISD reads the ones it handles correctly.',
    seenIn: 'the Comment box on the Driver editor\'s General tab, after saving and reopening.',
    size: 'Each affected character becomes "?" and a new line.',
  });

  static readonly VOICE_COIL_WIRING = new WinisdFixedBug({
    title: 'WinISD can lose the voice coil wiring',
    winisd: 'WinISD\'s Driver editor saves Series as Parallel for a single-coil driver. Changing the number of coils after picking Series puts the box back to Parallel but leaves Re and BL at their series values, so the file says parallel beside series values, and picking Series again scales them a second time.',
    openisd: 'OpenISD keeps the wiring you chose at any number of coils and works out Re and BL from it, so changing the coil count cannot leave them out of step.',
    seenIn: 'the Voice coil connection and Number of voice coils boxes in the Driver editor, and the saved driver file.',
    size: 'Two coils, Series then the coil count edited: Re four times and BL twice the parallel value, saved as parallel; Series again makes them 16 and 4 times.',
  });

  /** Every fixed bug, by reflection; declared last. */
  static readonly ALL: readonly WinisdFixedBug[] =
    Object.freeze(Object.values(WinisdFixedBug).filter((v): v is WinisdFixedBug => v instanceof WinisdFixedBug));
}
