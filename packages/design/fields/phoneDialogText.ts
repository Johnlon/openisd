import {formatDay, parseBasicUtc} from './format.js';
import {PhoneHelpSection} from './phoneText.js';
import type {WinisdDifferenceTone} from './winisdDifferenceSection.js';

/** The two ways to import a file, in John's words (19 Oct 2026), each with the line under it. */
export class ImportChoiceText {
  static readonly LEAD = 'When importing:';
  static readonly ADD_LABEL = 'Add the settings in the file to the app\'s state';
  static readonly ADD_LINE = 'Any settings in the imported file will be added to the app\'s settings, so this is an update & append operation.';
  static readonly REPLACE_LABEL = 'Replace all';
  static readonly REPLACE_LINE = 'The imported file completely replaces the app\'s settings. A backup is made first.';
}

/**
 * The words of the phone's app dialogs (PHONE_CLASSIC_BUILD_SPEC rows 20-24 and 37): what each band's ? says,
 * one line per row. Plain short English for a person new to speaker design.
 */
export class PhoneDialogHelp {
  static readonly OPTIONS_USER = new PhoneHelpSection('User', 'Your name. OpenISD writes it into each new project you make, so you can see later who made it.', [
    {label: 'Username', text: 'your name, as it should appear on your projects.'},
  ]);
  static readonly OPTIONS_ENVIRONMENT = new PhoneHelpSection('Environment',
    'The air your speaker plays into: its temperature, humidity and pressure. They change the speed of sound and the weight of the air, which moves the results a little. Every project uses these unless its own Advanced tab sets other air. The defaults (20 °C, 30 %, sea level) suit most rooms.', [
      {label: 'Temperature', text: 'the air temperature in kelvin (K). Add 273.15 to the °C value: 20 °C is 293.15 K.'},
      {label: 'Relative humidity', text: 'how damp the air is, in percent. It hardly changes the result.'},
      {label: 'Air pressure', text: 'the air pressure in pascals (Pa). 101325 Pa is sea level; it is lower up a mountain.'},
      {label: 'Sound velocity', text: 'how fast sound travels in this air. It is worked out from the three values above.'},
      {label: 'Air density', text: 'how heavy this air is. It is worked out from the three values above.'},
      {label: 'Reset to defaults', text: 'puts this section back to how it was when you first opened OpenISD.'},
    ]);
  static readonly OPTIONS_VENTED_LIMITS = new PhoneHelpSection('Vented design limits',
    'A safety net for vented (ported) boxes. A design whose box size or tuning is outside these ranges gets a warning mark, because it is probably a mistake. OpenISD never changes your numbers.', [
      {label: 'Min box volume', text: 'a box smaller than this gets a warning mark.'},
      {label: 'Max box volume', text: 'a box bigger than this gets a warning mark.'},
      {label: 'Min tuning', text: 'a vent tuned lower than this gets a warning mark. The tuning (Fb) is the note the vent resonates at.'},
      {label: 'Max tuning', text: 'a vent tuned higher than this gets a warning mark.'},
      {label: 'Reset to defaults', text: 'puts this section back to how it was when you first opened OpenISD.'},
    ]);
  static readonly OPTIONS_WINISD_DIFFERENCES = new PhoneHelpSection('WinISD differences',
    'OpenISD works like WinISD, an older program many speaker builders know. In a few places it works differently. With this on, a ≠W mark sits by each of those controls; tap the mark to read what is different.', [
      {label: 'Show WinISD difference markers (≠W)', text: 'ticked: a ≠W mark shows by each control that works differently from WinISD. Unticked: the marks are hidden.'},
    ]);
  static readonly OPTIONS_UNITS = new PhoneHelpSection('Units',
    'Every value is shown in a unit, such as litres or cubic feet. Tap the unit beside a value to change it. The button here puts every value back to metric.', [
      {label: 'Reset to Metric (l, mm, …)', text: 'shows every value in metric units again: litres, millimetres, hertz.'},
    ]);
  static readonly OPTIONS_COLORS = new PhoneHelpSection('Colors',
    'The colours the charts are drawn in. Tap a colour to change it; ↺ puts that one back. Each project\'s curve colour is not here: it is the coloured square by the project in the ☰ menu.', [
      {label: '0 dB line', text: 'the flat line at 0 dB on the response charts: the speaker\'s normal loudness.'},
      {label: '-3dB line', text: 'the line 3 dB below that. Where a curve crosses it is the usual measure of how low a speaker plays (F3).'},
      {label: 'Background', text: 'the colour behind the charts.'},
      {label: 'Other lines', text: 'the grid lines and the chart edges.'},
      {label: 'Labels', text: 'the numbers and words along the chart edges.'},
      {label: 'Xmax limit', text: 'the line on the cone movement chart that marks how far the cone can safely move (Xmax). Above it the sound distorts or the speaker is damaged.'},
      {label: 'Cursor lines', text: 'the lines that follow your finger on a chart, to read off a value.'},
      {label: 'Air speed limit', text: 'the line on the vent air speed charts. Above it the vent starts to make a rushing noise (chuffing).'},
      {label: 'Selected range', text: 'the shading over a range of frequencies you pick on a chart.'},
    ]);
  static readonly OPTIONS_LIMITS = new PhoneHelpSection('Limits',
    'How far each chart reaches: the lowest and highest value it shows. Change one if a curve runs off its chart; ↺ puts it back.', [
      {label: 'Frequency range', text: 'the lowest and highest frequency every chart shows, in hertz. People hear from about 20 to 20000 Hz.'},
      {label: 'Transfer func. magn.', text: 'the range of the Transfer function chart: how loud the speaker plays at each frequency, against its normal loudness.'},
      {label: 'EQ transfer func mag', text: 'the range of the EQ chart: how much your filters boost or cut each frequency.'},
      {label: 'Transfer func. phase', text: 'the range of the phase chart: how far the sound lags at each frequency.'},
      {label: 'SPL', text: 'the range of the SPL chart: how loud the speaker plays, in dB, at the power you set.'},
      {label: 'Cone excursion', text: 'the range of the cone movement chart, in millimetres.'},
      {label: 'Impedance', text: 'the range of the impedance chart: the load the speaker puts on the amplifier, in ohms.'},
      {label: 'Impedance phase', text: 'the range of the impedance phase chart, in degrees.'},
      {label: 'Group delay', text: 'the range of the group delay chart: how late each frequency arrives, in milliseconds.'},
      {label: 'Maximum power', text: 'the range of the maximum power chart: the most power, in watts, the speaker can take at each frequency before the cone moves too far.'},
      {label: 'Rear port - Air velocity', text: 'the range of the chart of how fast air moves in the rear vent.'},
      {label: 'Front port - Air velocity', text: 'the range of the chart of how fast air moves in the front vent.'},
    ]);
  static readonly OPTIONS_STORAGE = new PhoneHelpSection('Storage',
    'OpenISD keeps your projects and drivers inside this browser, on this device, not on a server. This shows how much room they take.', [
      {label: 'Empty Bin', text: 'deletes for good the projects you put in the Bin. This cannot be undone.'},
      {label: 'Delete all backups', text: 'deletes every safety copy in this browser, to free room.'},
    ]);
  static readonly OPTIONS_BACKUPS = new PhoneHelpSection('Backups',
    'Safety copies of everything OpenISD keeps in this browser. One is made by itself before anything is restored, repaired or deleted, so a mistake can be undone.', [
      {label: 'Back up now', text: 'makes a safety copy of everything now.'},
    ]);
  static readonly OPTIONS_EXPORT_IMPORT = new PhoneHelpSection('Export / Import',
    'Export puts everything OpenISD keeps in this browser into one file. Keep the file safe, or Import it in another browser or device to carry your work over.', [
      {label: 'Export everything', text: 'saves everything OpenISD keeps in this browser into one file on your device.'},
      {label: 'Import file…', text: 'loads a file you saved with Export everything.'},
      {label: ImportChoiceText.ADD_LABEL, text: 'any settings in the imported file will be added to the app\'s settings, so this is an update and append operation.'},
      {label: ImportChoiceText.REPLACE_LABEL, text: 'the imported file completely replaces the app\'s settings. A backup is made first.'},
    ]);
  static readonly SYNC_GOOGLE_DRIVE = new PhoneHelpSection('Google Drive',
    'Keeps a copy of your work in your own Google Drive, so it follows you to your other devices.', [
      {label: 'Connect Google Drive', text: 'signs in to Google and turns cloud sync on.'},
      {label: 'Disconnect', text: 'turns cloud sync off. The copy in your Drive stays.'},
    ]);
  static readonly DIAGNOSTICS_CLOUD_SYNC = new PhoneHelpSection('Cloud sync',
    'Whether cloud sync is connected, how many changes wait to go up, and the last attempt and error.', []);
  static readonly DIAGNOSTICS_BROWSER_STORAGE = new PhoneHelpSection('Browser storage',
    'Whether the browser has agreed to keep OpenISD\'s data when it runs short of space. Refused means it may clear it.', []);

  /** The help sheet of the activity list of the Cloud sync dialog, under the heading the dialog states. */
  static syncActivity(heading: string): PhoneHelpSection {
    return new PhoneHelpSection(heading, 'The latest things cloud sync did, newest last.', []);
  }

  /** The help sheet of the conflicts list of the Cloud sync dialog, under the heading the dialog states. */
  static syncConflicts(heading: string): PhoneHelpSection {
    return new PhoneHelpSection(heading, 'Items changed here and in your Drive since the last sync. Open one to choose which copy to keep.', []);
  }

  /** The help sheet of one section of the differences page, by how the section looks. */
  static differenceSection(heading: string, tone: WinisdDifferenceTone): PhoneHelpSection {
    switch (tone) {
      case 'bug':
        return new PhoneHelpSection(heading, 'Mistakes in WinISD\'s maths. OpenISD gets them right; a yellow switch on the Advanced tab brings WinISD\'s result back.', []);
      case 'option':
        return new PhoneHelpSection(heading, 'Places where WinISD calculates in its own way. OpenISD copies it; a switch on the Advanced tab gives the other form.', []);
      case 'fixed':
        return new PhoneHelpSection(heading, 'Places where WinISD ignores an input, fails to update, crashes or loses data. OpenISD just does the right thing.', []);
    }
  }
}

/** The words of the About page's new first line: the version, the day, and the change log. */
export class AboutText {
  static readonly CHANGE_LOG_LABEL = 'Change log';
  /** Every release with what it changed: the project's GitHub releases. */
  static readonly CHANGE_LOG_URL = 'https://github.com/Johnlon/openisd/releases';

  /** "Version 7.0.952 · 16 Oct 2026" for a build named by its stamp ("20261016T0900Z"); a build with
   *  no public number says "Build" and its day. */
  static versionLine(version: string, stamp: string): string {
    const when = parseBasicUtc(stamp);
    const day = when === null ? stamp : formatDay(when);
    return version === '' ? `Build · ${day}` : `Version ${version} · ${day}`;
  }
}
