import type {BoxType, EbpSuitability} from '../engine/index.js';
import {type PhoneHelpRow, PhoneHelpSection} from './phoneText.js';

/** The recommendation badge on the wizard's EBP row: its words and which of the three colours it takes. */
export interface EbpBadge {
  readonly label: string;
  readonly tone: EbpSuitability;
}

/** A popup the wizard's ⓘ buttons open: a title, paragraphs, and an optional grey note. */
export interface WizardInfoCard {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly note: string | null;
}

/** The words of the phone New project wizard (PHONE_CLASSIC_BUILD_SPEC screen 25, `QO267/wizard-live.html`). */
export class PhoneWizardText {
  static readonly TITLE = 'New project';
  static readonly BACK = '◀ Back';
  static readonly NEXT = 'Next ▸';
  static readonly CREATE = 'Create Project';
  static readonly CANCEL = 'Cancel';

  static readonly PLACEMENT_LABEL = 'Placement';
  static readonly PLACEMENT_STANDARD = 'Standard';
  static readonly PLACEMENT_ISOBARIK = 'Iso-Barik';
  static readonly ISOBARIK_NOT_MODELLED = 'Iso-Barik is not modelled yet';

  static readonly BOX_TYPE_LABEL = 'Box type';
  static readonly EBP_LABEL = 'EBP';
  static readonly EBP_FORMULA = 'Fs / Qes';

  static readonly ALIGNMENT_LABEL = 'Alignment';
  static readonly BOX_VOLUME_LABEL = 'Box volume';
  static readonly TUNING_FREQUENCY_LABEL = 'Tuning frequency';
  static readonly CALCULATED_QTC_LABEL = 'Calculated Qtc';
  static readonly BOX_RESONANCE_LABEL = 'Box resonance';
  static readonly STARTING_VOLUME_LABEL = 'Starting volume';
  static readonly VOLUME_LABEL = 'Volume';
  static readonly TUNING_LABEL = 'Tuning';
  static readonly SELECT_PR = 'Select PR ▸';

  static readonly PROJECT_NAME_LABEL = 'Project name';
  static readonly DESCRIPTION_LABEL = 'Description';
  static readonly DESCRIPTION_PLACEHOLDER = 'Optional project notes, enclosure dimensions, design goals…';
  static readonly PROJECT_HINT = 'Optional label and notes; can refine later on Project tab.';

  /** The section band names of the wizard pages. */
  static readonly BAND_DRIVER_ARRAY = 'Driver Array';
  static readonly BAND_ENCLOSURE = 'Enclosure';
  static readonly BAND_ALIGNMENT = 'Alignment';
  static readonly BAND_KEY_FIGURES = 'Key Figures';
  static readonly BAND_BOX = 'Box';
  static readonly BAND_RADIATOR = 'Radiator';
  static readonly BAND_REAR_CHAMBER = 'Rear Chamber';
  static readonly BAND_FRONT_CHAMBER = 'Front Chamber';
  static readonly BAND_PROJECT_DETAILS = 'Project Details';

  static readonly HELP_BUTTON = 'Help for this step';
  static readonly CLOSE = 'Close';

  /** The badge for the driver's EBP: the engine's own thresholds, in the mock's words. Null with no driver. */
  static ebpBadge(suitability: EbpSuitability | null): EbpBadge | null {
    switch (suitability) {
      case 'sealed': return {label: 'Sealed', tone: 'sealed'};
      case 'vented': return {label: 'Vented', tone: 'vented'};
      case 'either': return {label: 'Sealed or vented', tone: 'either'};
      case null: return null;
    }
  }

  /** The second banner line on step 2: the driver's main figures, each as "Fs 45 Hz". */
  static driverFigures(lines: readonly string[]): string {
    return lines.map(line => line.replace(': ', ' ')).join(' · ');
  }

  /** The second banner line on step 3: "EBP 84.9 · Sealed or vented". */
  static ebpLine(ebpText: string, badge: EbpBadge | null): string {
    return badge === null ? `${PhoneWizardText.EBP_LABEL} ${ebpText}` : `${PhoneWizardText.EBP_LABEL} ${ebpText} · ${badge.label}`;
  }

  /** The second banner line on steps 4 and 5: "Vented · 1 driver". */
  static boxAndDrivers(boxLabel: string, nDrivers: number): string {
    return `${boxLabel} · ${nDrivers} ${nDrivers === 1 ? 'driver' : 'drivers'}`;
  }

  /** The ⓘ popup beside Placement. */
  static readonly PLACEMENT_INFO: WizardInfoCard = {
    title: 'Driver placement',
    paragraphs: [
      'Standard: each driver sits in its own place on the baffle, and they all share the box volume.',
      'Iso-Barik: two drivers coupled face to face in a short tunnel. The pair acts as one driver with half the Vas, so the box can be half the size.',
    ],
    note: 'Iso-Barik is not modelled yet in OpenISD.',
  };

  /** The ⓘ popup on the EBP row, with the chosen driver's value. */
  static ebpInfo(ebpText: string): WizardInfoCard {
    return {
      title: PhoneWizardText.EBP_LABEL,
      paragraphs: ['EBP is the efficiency bandwidth product, Fs divided by Qes. It is a rough guide to the box type. Below 50: sealed. Above 100: vented. Between the two: either works.'],
      note: `Your driver: EBP ${ebpText}.`,
    };
  }
}

const row = (label: string, text: string): PhoneHelpRow => ({label, text});
const ALIGNMENT_ROW = row('Alignment', 'a standard recipe that sets the box volume and tuning.');
const BOX_VOLUME_ROW = row('Box volume', 'the box volume. A larger box plays lower bass.');
const CHAMBER_VOLUME = row('Volume', 'the volume of this chamber.');
const CHAMBER_TUNING = row('Tuning', 'the tuning frequency of this chamber\'s vent.');

/** The help sheet of each wizard step: the ? at the right end of the step bar opens it. A section with no title has no heading. */
export class PhoneWizardHelp {
  static readonly DRIVER: readonly PhoneHelpSection[] = [new PhoneHelpSection('', '', [
    row('Search', 'finds drivers by brand or model.'),
    row('Filters', 'limits the list to subwoofers, woofers, 4 Ω, 8 Ω or favourites.'),
    row('Driver list', 'tap a driver to choose it. Each line shows its main figures; DQ is a score for how complete its data is.'),
  ])];
  static readonly COUNT: readonly PhoneHelpSection[] = [new PhoneHelpSection('Driver Array', 'The number of drivers, how they are mounted and how they are wired.', [
    row('Drivers', 'the number of drivers in the box.'),
    row('Placement', 'Standard: each driver is mounted in the front panel. Iso-Barik: two drivers coupled face to face, which halves the box size needed (not modelled yet).'),
    row('Connection', 'parallel or series wiring of the drivers. It sets the load in ohms the amplifier drives.'),
  ])];
  static readonly BOX_TYPE: readonly PhoneHelpSection[] = [new PhoneHelpSection('Enclosure', 'The enclosure type.', [
    row('Box type', 'the enclosure type: sealed (listed as Closed), vented, passive radiator, 4th or 6th order bandpass, or ABC.'),
    row('EBP (efficiency bandwidth product)', 'Fs (the frequency at which the driver vibrates most freely) divided by Qes (how sharply its motor alone makes it resonate). Below 50 suits a sealed box, above 100 a vented box, between the two either.'),
  ])];
  static readonly PROJECT_INFO: readonly PhoneHelpSection[] = [new PhoneHelpSection('Project Details', 'The project name and notes.', [
    row('Project name', 'the name shown in the project list.'),
    row('Description', 'free-text notes.'),
  ])];

  /** The box details page: its sections follow the box type. */
  static boxDetails(boxType: BoxType): readonly PhoneHelpSection[] {
    const alignment = (rows: readonly PhoneHelpRow[]) =>
      new PhoneHelpSection('Alignment', 'The box volume and tuning, set by hand or from an alignment (a standard recipe for both).', rows);
    switch (boxType) {
      case 'sealed':
        return [
          alignment([ALIGNMENT_ROW, BOX_VOLUME_ROW]),
          new PhoneHelpSection('Key Figures', 'Values calculated from the settings above.', [
            row('Calculated Qtc (Q, total, sealed box)', 'how sharply the driver resonates in the sealed box. Lower values give a smooth bass roll-off; higher values give a peak.'),
            row('Box resonance', 'the frequency at which the driver vibrates most freely in the sealed box. Below it the bass falls away.'),
          ]),
        ];
      case 'vented':
        return [alignment([ALIGNMENT_ROW, BOX_VOLUME_ROW,
          row('Tuning frequency', 'the box tuning frequency: the frequency at which the vent reinforces the bass most. Lower tuning reaches lower bass.')])];
      case 'box-passive-radiator':
        return [
          new PhoneHelpSection('Box', 'The enclosure type and its diagram.', [row('Starting volume', 'the box volume to start from.')]),
          new PhoneHelpSection('Radiator', 'The passive radiator\'s parameters.', [
            row('Select PR', 'picks a passive radiator from the library.'),
            row('Vas (volume, air, equivalent to suspension)', 'the volume of air that is as easy to compress as the passive radiator\'s suspension is to stretch.'),
            row('Qms (Q, mechanical, speaker)', 'how sharply the passive radiator resonates, from its suspension.'),
            row('Fs (frequency, speaker)', 'the frequency at which the passive radiator vibrates most freely, out of a box.'),
            row('Sd (surface, diaphragm)', 'the working area of the passive radiator.'),
            row('Xmax (excursion, maximum)', 'how far the passive radiator can move each way before it distorts.'),
          ]),
        ];
      case 'bandpass4':
        return [
          new PhoneHelpSection('Rear Chamber', 'The space behind the driver, inside the box.', [CHAMBER_VOLUME]),
          new PhoneHelpSection('Front Chamber', 'The space in front of the driver, inside the box.', [CHAMBER_VOLUME, CHAMBER_TUNING]),
        ];
      case 'bandpass6':
      case 'abc':
        return [
          new PhoneHelpSection('Rear Chamber', 'The space behind the driver, inside the box.', [CHAMBER_VOLUME, CHAMBER_TUNING]),
          new PhoneHelpSection('Front Chamber', 'The space in front of the driver, inside the box.', [CHAMBER_VOLUME, CHAMBER_TUNING]),
        ];
    }
  }
}
