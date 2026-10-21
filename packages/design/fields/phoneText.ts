import type {BoxType, FilterType} from '../engine/index.js';

/** One line of a help sheet: the row's label, then what it is. */
export interface PhoneHelpRow {
  readonly label: string;
  readonly text: string;
}

/** What a section band's ? opens: what the section is for, then one line per row in it. */
export class PhoneHelpSection {
  constructor(
    readonly title: string,
    readonly intro: string,
    readonly rows: readonly PhoneHelpRow[],
  ) {}
}

/** The words of the colour key strip under the phone header (PHONE_CLASSIC_BUILD_SPEC §1). */
export class KeyStripText {
  static readonly ENTERED = 'Entered';
  static readonly CALCULATED = 'Calculated';
  static readonly NOT_AVAILABLE = 'Not Available';
}

/** The short row labels of the classic phone pages (WinISD's symbols; the bands carry the words). */
export class PhoneLabels {
  static readonly VB = 'Vb';
  static readonly VF = 'Vf';
  static readonly FB = 'Fb';
  static readonly FSC = 'Fsc';
  static readonly QTC = 'Qtc';
  static readonly FH = 'Fh';
  static readonly FRC = 'Frc';
  static readonly FFC = 'Ffc';
  static readonly DRIVERS = 'Drivers';
  static readonly CONNECTION = 'Connection';
  static readonly POWER = 'Power';
  static readonly VOLTS = 'Volts';
  static readonly RS = 'Rs';
  static readonly SUBTYPE = 'Subtype';
  static readonly ORDER = 'Order';
  static readonly Q = 'Q';
  static readonly CUTOFF = 'Cutoff';
  static readonly T = 't';
  static readonly F0 = 'f0';
  static readonly Q0 = 'Q0';
  static readonly FP = 'fp';
  static readonly QP = 'Qp';
  static readonly FC = 'fc';
  static readonly GAIN = 'Gain';
  static readonly GPK = 'Gpk';
  static readonly FPK = 'fpk';
  static readonly BW = 'BW';
}

/** One quick-add chip of the phone Filters tab, in WinISD's Filter Editor order, then the two OpenISD-only shelves. */
export interface PhoneFilterChip {
  readonly type: FilterType;
  /** The short name on the chip after the "+" and in the card header. */
  readonly short: string;
}

export const PHONE_FILTER_CHIPS: readonly PhoneFilterChip[] = Object.freeze([
  {type: 'lowpass', short: 'LP'},
  {type: 'highpass', short: 'HP'},
  {type: 'allpass', short: 'AP'},
  {type: 'linkwitz', short: 'LT'},
  {type: 'peaking', short: 'PEQ'},
  {type: 'peakHighpass', short: 'Peak HP'},
  {type: 'staticGain', short: 'Gain'},
  {type: 'raisedCosine', short: 'DLP'},
  {type: 'lowshelf', short: 'LS'},
  {type: 'highshelf', short: 'HS'},
]);

const VB_HELP = {label: 'Vb (volume, box)', text: 'the space inside the box. A larger box plays lower bass and makes the low-end peak smaller.'};
const CHOOSE_ALIGNMENT = {label: 'Choose alignment', text: 'sets the box volume and tuning from a standard recipe for this driver.'};
const LOSSES = {label: 'Box losses (Qa, Ql, Qp)…', text: 'how much sound the box loses to its lining, to air leaks and in the vent. The defaults suit most boxes.'};
const VENT_ROWS: readonly PhoneHelpRow[] = [
  {label: 'Number of Vents', text: 'how many identical vents the box has. The total area is shared between them.'},
  {label: 'Shape', text: 'round tube or rectangular slot.'},
  {label: 'End Correction', text: 'an allowance for how the vent ends are fitted; it changes the effective length.'},
  {label: 'Vent diameter', text: 'the inside diameter of the vent. A larger vent lowers air speed.'},
  {label: 'Vent length', text: 'the vent length needed for the box tuning frequency.'},
  {label: 'Cross area', text: 'the cross-section area of the vent.'},
  {label: '1st port resonance', text: 'the frequency at which the vent itself resonates. Keep it well above the bass the box is designed to play, or it colours the sound.'},
];

const PASS_ROWS: readonly PhoneHelpRow[] = [
  {label: 'Subtype', text: 'the filter\'s shape: Butterworth is flattest, Linkwitz-Riley sums flat with its partner, Bessel keeps the timing, SOS takes your own Q.'},
  {label: 'Order', text: 'how steeply the filter cuts: 6 dB per octave for each order.'},
  {label: 'Q', text: 'how sharp the filter is around its frequency. Higher is sharper.'},
];

/** The help sheets of the Box, Driver and Signal pages; the words follow the box type where they differ. */
export class PhoneHelp {
  static readonly BOX = new PhoneHelpSection('Box', 'The enclosure type and its diagram.', [
    {label: 'Box type', text: 'the enclosure type: sealed (listed as Closed), vented, passive radiator, 4th or 6th order bandpass, or ABC.'},
  ]);
  static readonly FRONT_CHAMBER = new PhoneHelpSection('Front chamber', 'The space in front of the driver, inside the box.', [
    {label: 'Vf (volume, front)', text: 'the space inside the front chamber.'},
    {label: 'Ffc (frequency, front chamber)', text: 'the frequency at which the front chamber\'s vent reinforces the bass most.'},
    LOSSES,
  ]);
  static readonly VENTS = new PhoneHelpSection('Vents', 'The vents that connect the box to the outside and set its tuning.', [
    {label: 'Fb (frequency, box)', text: 'the frequency at which the vent reinforces the bass most: the box and vent resonate together, so the vent gives the most output and the cone moves the least. Lower tuning reaches lower bass.'},
    ...VENT_ROWS,
  ]);
  static readonly FRONT_VENT = new PhoneHelpSection('Front vent', 'The vent from the front chamber to the outside.', [
    {label: 'Fb (frequency, box)', text: 'the frequency at which the vent reinforces the bass most. Lower tuning reaches lower bass.'},
    ...VENT_ROWS,
  ]);
  static readonly REAR_VENT = new PhoneHelpSection('Rear vent', 'The vent from the rear chamber to the outside.', VENT_ROWS);
  static readonly INTRA_VENT = new PhoneHelpSection('Intra vent', 'The vent between the two chambers. It does not open to the outside.', VENT_ROWS);
  static readonly PASSIVE_RADIATOR = new PhoneHelpSection('Passive radiator', 'A cone with no magnet or coil, moved by the air in the box. It tunes the box in place of a vent.', [
    {label: 'Select PR', text: 'picks a passive radiator from the library.'},
    {label: 'Save to library', text: 'saves this passive radiator to the library.'},
    {label: 'Fs', text: 'the frequency at which the passive radiator vibrates most freely, out of a box.'},
    {label: 'Qms', text: 'how sharply the passive radiator resonates, from its suspension.'},
    {label: 'Vas', text: 'the volume of air that is as easy to compress as the passive radiator\'s suspension is to stretch.'},
    {label: 'Xmax', text: 'how far the passive radiator can move each way before it distorts.'},
  ]);
  static readonly USER_OPTIONS = new PhoneHelpSection('User options', 'The number of passive radiators and any mass added to them.', [
    {label: 'Num. of PRs', text: 'the number of passive radiators.'},
    {label: 'Fp (frequency, passive)', text: 'the tuning you want. The app adds mass to the radiator to reach it.'},
    {label: 'Added mass', text: 'mass added to each passive radiator. More mass lowers the box tuning frequency.'},
    {label: 'Resonance with mass', text: 'the frequency at which the passive radiator vibrates most freely, with the added mass.'},
  ]);
  static readonly CHART = new PhoneHelpSection('Chart', 'Settings for the charts. They do not change the design.', [
    {label: 'Velocity limit', text: 'the air speed above which the charts mark the vent as likely to be noisy.'},
  ]);
  static readonly DRIVER = new PhoneHelpSection('Driver', 'The driver used in this design.', [
    {label: 'Select driver', text: 'picks a driver from the library.'},
    {label: 'Edit', text: 'opens the driver\'s parameters.'},
  ]);
  static readonly DRIVER_ARRAY = new PhoneHelpSection('Drivers', 'How many drivers the box has and how they are wired.', [
    {label: 'Drivers', text: 'the number of drivers in the box.'},
    {label: 'Connection', text: 'parallel or series wiring of the drivers. It sets the load in ohms the amplifier drives.'},
  ]);
  static readonly KEY_FIGURES = new PhoneHelpSection('Key figures', 'The driver\'s main parameters, for reference. Edit the driver to change them.', [
    {label: 'Fs', text: 'the frequency at which the driver vibrates most freely, out of a box. Lower Fs can reach lower bass.'},
    {label: 'Qts', text: 'how sharply the driver resonates, from its motor and suspension together. It shows which box type suits the driver.'},
    {label: 'Vas', text: 'the volume of air that is as easy to compress as the suspension is to stretch. A larger Vas needs a larger box.'},
    {label: 'Re', text: 'the electrical resistance of the voice coil, measured with direct current.'},
    {label: 'Xmax', text: 'how far the cone can move each way before the sound distorts.'},
  ]);
  static readonly DRIVER_SEARCH = new PhoneHelpSection('Search', 'Find a driver by brand or model. Filters opens the type, Fs, Sd, impedance and favourite filters; the number on it says how many are on.', [
    {label: 'Search', text: 'type part of a brand or model name.'},
    {label: 'Type', text: 'show only these driver types. Tap again to hide a type.'},
    {label: 'Fs', text: 'the range of resonance frequencies to show.'},
    {label: 'Sd', text: 'the range of cone areas to show.'},
    {label: 'Z', text: 'show only drivers of this impedance.'},
    {label: 'Show', text: 'which drivers to list: those bundled with the app, your own, or all. ★ shows only your favourites.'},
  ]);
  static readonly DRIVER_LIST_PICK = new PhoneHelpSection('Drivers', 'The drivers that match. Tap one to choose it, then Use driver.', []);
  static readonly DRIVER_LIST_MANAGE = new PhoneHelpSection('Drivers', 'The drivers that match. Tap one to open it in the driver editor.', []);
  static readonly SIGNAL = new PhoneHelpSection('Signal', 'The drive level from the amplifier.', [
    {label: 'Power', text: 'the amplifier power, measured into the driver\'s rated load in ohms.'},
    {label: 'Volts', text: 'the amplifier output voltage. Power and Volts set each other.'},
    {label: 'Rs', text: 'the resistance of the cable and amplifier between the amplifier and the driver.'},
  ]);

  static readonly PROJECT_DETAILS = new PhoneHelpSection('Project details', 'The project name and notes.', [
    {label: 'Name', text: 'the name shown in the project list.'},
    {label: 'Creator', text: 'who made the project.'},
    {label: 'Created', text: 'the day the project was made.'},
    {label: 'Modified', text: 'the day the project was last changed.'},
    {label: 'Description', text: 'free-text notes.'},
  ]);

  /** The rear (or only) chamber: its rows follow the box type. */
  static rearChamber(boxType: BoxType): PhoneHelpSection {
    switch (boxType) {
      case 'sealed':
        return new PhoneHelpSection('Rear chamber', 'The space behind the driver, inside the box.', [
          VB_HELP,
          {label: 'Fsc (frequency, sealed chamber)', text: 'the frequency at which the driver vibrates most freely in the sealed box. Below it the bass falls away.'},
          {label: 'Qtc (Q, total, sealed box)', text: 'how sharply the driver resonates in the sealed box. Lower values give a smooth, gradual bass roll-off; higher values give a peak before it.'},
          CHOOSE_ALIGNMENT, LOSSES,
        ]);
      case 'vented':
        return new PhoneHelpSection('Rear chamber', 'The space behind the driver, inside the box.', [VB_HELP, CHOOSE_ALIGNMENT, LOSSES]);
      case 'box-passive-radiator':
        return new PhoneHelpSection('Rear chamber', 'The space behind the driver, inside the box.', [
          VB_HELP,
          {label: 'Fh (frequency, hybrid)', text: 'the tuning the box and passive radiator give.'},
          LOSSES,
        ]);
      case 'bandpass4':
        return new PhoneHelpSection('Rear chamber', 'The space behind the driver, inside the box.', [
          {label: 'Vb (volume, rear chamber)', text: 'the space inside the rear chamber.'},
          {label: 'Fsc (frequency, sealed chamber)', text: 'the frequency at which the driver vibrates most freely in the sealed rear chamber.'},
          LOSSES,
        ]);
      case 'bandpass6':
      case 'abc':
        return new PhoneHelpSection('Rear chamber', 'The space behind the driver, inside the box.', [
          {label: 'Vb (volume, rear chamber)', text: 'the space inside the rear chamber.'},
          {label: 'Frc (frequency, rear chamber)', text: 'the frequency at which the rear chamber\'s vent reinforces the bass most.'},
          LOSSES,
        ]);
    }
  }

  static readonly ADD_FILTER = new PhoneHelpSection('Add filter', 'Adds a filter to the signal before the driver. LP lowpass, HP highpass, AP allpass, LT Linkwitz transform, PEQ parametric EQ, Peak HP peaking highpass, Gain fixed gain, DLP raised-cosine EQ, LS low shelf, HS high shelf.', []);

  /** The help sheet of one filter card: what the filter does, then one line per row. */
  static filter(type: FilterType): PhoneHelpSection {
    const enabled = {label: 'Tick', text: 'untick to switch the filter off without removing it.'};
    const q = {label: 'Q', text: 'how sharp the filter is around its frequency. Higher is sharper.'};
    const gain = {label: 'Gain', text: 'how much the filter boosts (positive) or cuts (negative).'};
    const fc = {label: 'fc', text: 'the centre frequency.'};
    switch (type) {
      case 'lowpass':
        return new PhoneHelpSection('Lowpass', 'Lets low frequencies through and cuts the highs above the cutoff.', [enabled, ...PASS_ROWS, {label: 'Cutoff', text: 'the frequency where the filter starts to cut.'}]);
      case 'highpass':
        return new PhoneHelpSection('Highpass', 'Lets high frequencies through and cuts the lows below the cutoff. Protects the driver from deep bass it cannot play.', [enabled, ...PASS_ROWS, {label: 'Cutoff', text: 'the frequency where the filter starts to cut.'}]);
      case 'allpass':
        return new PhoneHelpSection('Allpass', 'Changes the phase and delay without changing the level.', [enabled, PASS_ROWS[1], q, {label: 't', text: 'the delay the allpass adds.'}]);
      case 'linkwitz':
        return new PhoneHelpSection('Linkwitz transform', 'Moves the box\'s low-end resonance (f0, Q0) to a new one (fp, Qp), to reach lower or roll off more gently.', [
          enabled,
          {label: 'f0', text: 'the box\'s own low-end resonance.'},
          {label: 'Q0', text: 'the box\'s own Q at f0.'},
          {label: 'fp', text: 'the resonance you want instead.'},
          {label: 'Qp', text: 'the Q you want at fp.'},
        ]);
      case 'peaking':
        return new PhoneHelpSection('Parametric EQ', 'A boost or cut around one frequency.', [enabled, fc, gain, q]);
      case 'peakHighpass':
        return new PhoneHelpSection('Peaking 2nd order highpass', 'A highpass with a peak just above its corner.', [
          enabled,
          {label: 'Gpk', text: 'the height of the peak above the corner.'},
          {label: 'fpk', text: 'the frequency of the peak.'},
        ]);
      case 'staticGain':
        return new PhoneHelpSection('Static gain', 'Raises or lowers the whole response by a fixed amount.', [enabled, gain]);
      case 'raisedCosine':
        return new PhoneHelpSection('DLP Raised Cosine', 'A smooth boost or cut over a band.', [
          enabled, fc, gain, {label: 'BW', text: 'the width of the band, in octaves.'},
        ]);
      case 'lowshelf':
        return new PhoneHelpSection('Low shelf', 'Raises or lowers everything below a frequency.', [enabled, fc, q, gain]);
      case 'highshelf':
        return new PhoneHelpSection('High shelf', 'Raises or lowers everything above a frequency.', [enabled, fc, q, gain]);
    }
  }

  /** The help sheet of one vent section, by the port it draws. */
  static ventSection(port: 'Vent' | 'Front' | 'Rear' | 'Intra'): PhoneHelpSection {
    switch (port) {
      case 'Vent': return PhoneHelp.VENTS;
      case 'Front': return PhoneHelp.FRONT_VENT;
      case 'Rear': return PhoneHelp.REAR_VENT;
      case 'Intra': return PhoneHelp.INTRA_VENT;
    }
  }
}

/** The words of the phone driver list (picker and Manage drivers): the search box and the Filters button. */
export class PhoneDriverListText {
  static readonly SEARCH_PLACEHOLDER = 'Brand or model';
  static readonly FILTERS = 'Filters';
  static readonly HIDE_FILTERS = 'Hide filters';
  static readonly MAKER_PAGE = 'Maker page ↗';

  /** The Filters button: "Filters ▾" shut, "Hide filters ▴" open, with how many filters are on in brackets. */
  static filtersButton(open: boolean, activeCount: number): string {
    const count = activeCount > 0 ? ` (${activeCount})` : '';
    return open ? `${PhoneDriverListText.HIDE_FILTERS}${count} ▴` : `${PhoneDriverListText.FILTERS}${count} ▾`;
  }
}

/** The one line under a passive radiator's name in the phone browser: its three datasheet figures. */
export class PhonePrBrowserText {
  static specsLine(sd: string, mms: string, cms: string): string {
    return `Sd = ${sd} · Mms = ${mms} · Cms = ${cms}`;
  }
}
