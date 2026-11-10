import type {BoxType} from '../engine/index.js';
import type {VentShape} from '../domain/vent.js';
import {NumberField} from './field.js';
import {PHONE_FILTER_CHIPS, PhoneHelp, type PhoneHelpRow, PhoneHelpRows, PhoneHelpSection, type PhoneFilterChip} from './phoneText.js';

/** The captions of the desktop skin that no `NumberField` supplies: the words on its buttons, links and selects. */
export class DesktopLabels {
  static readonly ALIGNMENT = 'Alignment';
  static readonly LOSSES_LINK = 'Advanced->';
  static readonly NUM_DRIVERS = 'Num. of drivers';
  static readonly VOICE_COIL_CONNECTION = 'Voice coil connection';
  static readonly ANGLE = 'Angle';
  static readonly VENT_SHAPE = 'Shape';
  static readonly VENT_COUNT = 'Number of ports';
  static readonly VENT_END_CORRECTION = 'End Correction';
  static readonly SELECT_PASSIVE_RADIATOR = 'Select passive radiator';
  static readonly SAVE_PASSIVE_RADIATOR = 'Save to library';

  /** The word on the port shape button for a shape. */
  static ventShapeWord(shape: VentShape): string {
    switch (shape) {
      case 'round': return 'Round';
      case 'slotted': return 'Slotted';
    }
  }

  /** The port shape button's accessible name and tooltip: the shape now, and the shape a press switches to. */
  static ventShapeToggleName(shape: VentShape, next: VentShape): string {
    return `Port shape: ${DesktopLabels.ventShapeWord(shape)}. Press to switch to ${DesktopLabels.ventShapeWord(next)}`;
  }

  /** The Filters tab's quick-add button for a filter type. */
  static addFilter(chip: PhoneFilterChip): string {
    return `+ ${chip.short}`;
  }
}

/** A phone help line under the desktop's own caption for the same row. */
function captioned(row: PhoneHelpRow, caption: string): PhoneHelpRow {
  return {...row, label: caption};
}

const LOSSES = captioned(PhoneHelpRows.LOSSES, DesktopLabels.LOSSES_LINK);
const ALIGNMENT = captioned(PhoneHelpRows.CHOOSE_ALIGNMENT, DesktopLabels.ALIGNMENT);
const VB = captioned(PhoneHelpRows.VB, NumberField.BOX_VB_L.label);
const VB_REAR = captioned(PhoneHelpRows.VB_REAR_CHAMBER, NumberField.BOX_VB_L.label);

/** The vent rows, under the captions the desktop Vents tab shows. */
const VENT_ROWS: readonly PhoneHelpRow[] = [
  captioned(PhoneHelpRows.VENT_COUNT, DesktopLabels.VENT_COUNT),
  captioned(PhoneHelpRows.VENT_SHAPE, DesktopLabels.VENT_SHAPE),
  captioned(PhoneHelpRows.VENT_END_CORRECTION, DesktopLabels.VENT_END_CORRECTION),
  captioned(PhoneHelpRows.VENT_DIAMETER, NumberField.VENT_D_CM.label),
  captioned(PhoneHelpRows.VENT_LENGTH, NumberField.VENT_L_CM.label),
  captioned(PhoneHelpRows.VENT_CROSS_AREA, NumberField.VENT_CROSSAREA_M2.label),
  captioned(PhoneHelpRows.VENT_FIRST_RESONANCE, NumberField.VENT_1STPORTRESONANCE_HZ.label),
];

const FILTER_ROWS: readonly PhoneHelpRow[] = PHONE_FILTER_CHIPS.map(chip => {
  const filter = PhoneHelp.filter(chip.type);
  return {label: DesktopLabels.addFilter(chip), text: `adds the ${filter.title} filter. ${filter.intro}`};
});

/**
 * What the ? on a desktop section band, or on a tab with no bands, opens. Every line's label is the caption
 * the desktop screen shows for that row. The words are the phone's (`PhoneHelpRows`); a row the phone has no
 * line for is written here.
 */
export class DesktopHelp {
  static readonly PLACEMENT = new PhoneHelpSection('Placement', 'How many drivers the box holds and how they are wired.', [
    captioned(PhoneHelpRows.DRIVERS, DesktopLabels.NUM_DRIVERS),
    captioned(PhoneHelpRows.CONNECTION, DesktopLabels.VOICE_COIL_CONNECTION),
  ]);

  static readonly ADVANCED_OPTIONS = new PhoneHelpSection('Advanced options', 'Extra driver settings: how hot the voice coil runs and mass added to the cone.', [
    {label: NumberField.DRIVER_VCTEMPRISE_K.label, text: 'how much hotter the voice coil runs than the air, in kelvin. A hotter coil has more resistance, so the driver plays quieter (power compression). 0 means no heating.'},
    {label: NumberField.DRIVER_ADDEDMASS_G.label, text: 'mass added to the cone, in grams. It raises Mms and lowers Fs.'},
    {label: NumberField.ALFAVC_PER_K.label, text: 'how much the voice coil resistance rises as it heats up.'},
  ]);

  static readonly LISTENING_PLACE = new PhoneHelpSection('Listening place', 'Where the listener sits. Not modelled yet: the charts ignore it.', [
    {label: NumberField.SIGNAL_DISTANCE_M.label, text: 'how far the listener is from the speaker. Not modelled yet: the charts ignore it.'},
    {label: DesktopLabels.ANGLE, text: 'the listener\'s angle off the speaker\'s axis. Not modelled yet: the charts ignore it.'},
  ]);

  static readonly SIGNAL_SOURCE = new PhoneHelpSection('Signal source', PhoneHelp.SIGNAL.intro, [
    captioned(PhoneHelpRows.POWER, NumberField.SIGNAL_PIN_W.label),
    captioned(PhoneHelpRows.VOLTS, NumberField.SIGNAL_DRIVEV_V.label),
    captioned(PhoneHelpRows.RS, NumberField.SIGNAL_RS_OHM.label),
  ]);

  /** The Vents tab's Limits band. */
  static readonly LIMITS = new PhoneHelpSection('Limits', PhoneHelp.CHART.intro, [
    captioned(PhoneHelpRows.VELOCITY_LIMIT, NumberField.VENT_PORTVELOCITYLIMIT_M_PER_S.label),
  ]);

  static readonly FRONT_CHAMBER = new PhoneHelpSection(PhoneHelp.FRONT_CHAMBER.title, PhoneHelp.FRONT_CHAMBER.intro, [
    captioned(PhoneHelpRows.VF, NumberField.BOX_VF_L.label),
    captioned(PhoneHelpRows.FFC, NumberField.BOX_FFC_HZ.label),
    LOSSES,
  ]);

  static readonly PASSIVE_RADIATOR = new PhoneHelpSection(PhoneHelp.PASSIVE_RADIATOR.title, PhoneHelp.PASSIVE_RADIATOR.intro, [
    captioned(PhoneHelpRows.SELECT_PR, DesktopLabels.SELECT_PASSIVE_RADIATOR),
    captioned(PhoneHelpRows.SAVE_PR, DesktopLabels.SAVE_PASSIVE_RADIATOR),
    captioned(PhoneHelpRows.PR_FS, NumberField.PR_FS_HZ.label),
    captioned(PhoneHelpRows.PR_QMS, NumberField.PR_QMS.label),
    captioned(PhoneHelpRows.PR_VAS, NumberField.PR_VAS_L.label),
    captioned(PhoneHelpRows.PR_XMAX, NumberField.PR_XMAX_MM.label),
  ]);

  static readonly USER_OPTIONS = new PhoneHelpSection(PhoneHelp.USER_OPTIONS.title, PhoneHelp.USER_OPTIONS.intro, [
    captioned(PhoneHelpRows.PR_COUNT, NumberField.PR_NUM.label),
    captioned(PhoneHelpRows.PR_FP, NumberField.PR_FP_HZ.label),
    captioned(PhoneHelpRows.PR_ADDED_MASS, NumberField.PR_MADD_G.label),
    captioned(PhoneHelpRows.PR_RESONANCE_WITH_MASS, NumberField.PR_FSMASS_HZ.label),
  ]);

  /** The Filters tab has no bands: its ? explains the filters you can add. */
  static readonly FILTERS_TAB: readonly PhoneHelpSection[] = [new PhoneHelpSection(PhoneHelp.ADD_FILTER.title, PhoneHelp.ADD_FILTER.intro, FILTER_ROWS)];
  static readonly ADVANCED_TAB: readonly PhoneHelpSection[] = PhoneHelp.ADVANCED_SECTIONS;
  static readonly PROJECT_TAB: readonly PhoneHelpSection[] = [PhoneHelp.PROJECT_DETAILS];

  /** The rear (or only) chamber band. A vented box's tuning sits in it on the desktop, so it is explained here. */
  static rearChamber(boxType: BoxType): PhoneHelpSection {
    const title = PhoneHelp.rearChamber(boxType).title;
    const intro = PhoneHelp.rearChamber(boxType).intro;
    switch (boxType) {
      case 'sealed':
        return new PhoneHelpSection(title, intro, [
          VB, captioned(PhoneHelpRows.FSC, NumberField.BOX_FSC_HZ.label), captioned(PhoneHelpRows.QTC, NumberField.BOX_QTC_VALUE.label), ALIGNMENT, LOSSES,
        ]);
      case 'vented':
        return new PhoneHelpSection(title, intro, [VB, captioned(PhoneHelpRows.FB_VENT, NumberField.BOX_FB_HZ.label), ALIGNMENT, LOSSES]);
      case 'box-passive-radiator':
        return new PhoneHelpSection(title, intro, [VB, captioned(PhoneHelpRows.FH, NumberField.BOX_FH_HZ.label), LOSSES]);
      case 'bandpass4':
        return new PhoneHelpSection(title, intro, [VB_REAR, captioned(PhoneHelpRows.FSC_REAR_CHAMBER, NumberField.BOX_REARRESONANCE_HZ.label), LOSSES]);
      case 'bandpass6':
      case 'abc':
        return new PhoneHelpSection(title, intro, [VB_REAR, captioned(PhoneHelpRows.FRC, NumberField.BOX_FRC_HZ.label), LOSSES]);
    }
  }

  /** One vent band, by the port it draws; its tuning row is captioned as that port's tuning field is. */
  static ventSection(port: 'Vent' | 'Front' | 'Rear' | 'Intra'): PhoneHelpSection {
    const phone = PhoneHelp.ventSection(port);
    switch (port) {
      case 'Vent': return new PhoneHelpSection(phone.title, phone.intro, [captioned(PhoneHelpRows.FB_VENT, NumberField.BOX_FB_HZ.label), ...VENT_ROWS]);
      case 'Front': return new PhoneHelpSection(phone.title, phone.intro, [captioned(PhoneHelpRows.FB_FRONT_VENT, NumberField.BOX_FFC_HZ.label), ...VENT_ROWS]);
      case 'Rear': return new PhoneHelpSection(phone.title, phone.intro, [captioned(PhoneHelpRows.FRC, NumberField.BOX_FRC_HZ.label), ...VENT_ROWS]);
      case 'Intra': return new PhoneHelpSection(phone.title, phone.intro, VENT_ROWS);
    }
  }
}
