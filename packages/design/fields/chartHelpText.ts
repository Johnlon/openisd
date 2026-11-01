import type {ChartId} from '../engine/index.js';
import {PhoneHelpSection, type HelpLink} from './phoneText.js';

/** Third-party teaching pages, each checked to answer 200 on 1 Nov 2026. */
const REF = {
  TS: {title: 'Wikipedia: Thiele/Small parameters', url: 'https://en.wikipedia.org/wiki/Thiele/Small_parameters'},
  ENC: {title: 'Wikipedia: Loudspeaker enclosure', url: 'https://en.wikipedia.org/wiki/Loudspeaker_enclosure'},
  BR: {title: 'Wikipedia: Bass reflex', url: 'https://en.wikipedia.org/wiki/Bass_reflex'},
  GD: {title: 'Wikipedia: Group delay and phase delay', url: 'https://en.wikipedia.org/wiki/Group_delay_and_phase_delay'},
  IMP: {title: 'Wikipedia: Electrical impedance', url: 'https://en.wikipedia.org/wiki/Electrical_impedance'},
  SPL: {title: 'Wikipedia: Sound pressure', url: 'https://en.wikipedia.org/wiki/Sound_pressure'},
  BODE: {title: 'Wikipedia: Bode plot', url: 'https://en.wikipedia.org/wiki/Bode_plot'},
  TF: {title: 'Wikipedia: Transfer function', url: 'https://en.wikipedia.org/wiki/Transfer_function'},
  PH: {title: 'Wikipedia: Phase (waves)', url: 'https://en.wikipedia.org/wiki/Phase_(waves)'},
  BUT: {title: 'Wikipedia: Butterworth filter', url: 'https://en.wikipedia.org/wiki/Butterworth_filter'},
  EQ: {title: 'Wikipedia: Equalization (audio)', url: 'https://en.wikipedia.org/wiki/Equalization_(audio)'},
  VA: {title: 'Wikipedia: Apparent power', url: 'https://en.wikipedia.org/wiki/Apparent_power'},
  LS: {title: 'Wikipedia: Loudspeaker', url: 'https://en.wikipedia.org/wiki/Loudspeaker'},
  ESPI: {title: 'Rod Elliott (ESP): Impedance, and how it affects audio equipment', url: 'https://sound-au.com/impedance.htm'},
  ESPE: {title: 'Rod Elliott (ESP): Loudspeaker Enclosure Design Guidelines', url: 'https://sound-au.com/articles/enclosures.htm'},
  ESPB: {title: 'Rod Elliott (ESP): Speaker Box Project, Part 1', url: 'https://sound-au.com/sp-boxes.htm'},
  ESPF: {title: 'Rod Elliott (ESP): Speaker Failure Analysis', url: 'https://sound-au.com/articles/speaker-failure.html'},
  LW: {title: 'Linkwitz Lab: Active filters', url: 'https://www.linkwitzlab.com/filters.htm'},
  LWF: {title: 'Linkwitz Lab: Frontiers of loudspeaker design', url: 'https://www.linkwitzlab.com/frontiers.htm'},
} as const satisfies Record<string, HelpLink>;

/**
 * The help of every chart on the phone Graph page: one plain sentence, the axes, what good looks like,
 * what the common faults look like, and teaching links. `Record<ChartId, ...>` makes a chart without
 * help a compile error. Each title equals the chart's name in `TAB_META` (a test checks it).
 */
export const CHART_HELP: Record<ChartId, PhoneHelpSection> = {
  SPL: new PhoneHelpSection('SPL response', 'The loudness the speaker makes at each frequency for the input power on the Signal page.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: sound pressure level in dB, measured at 1 m.'},
    {label: 'Good', text: 'A smooth curve, flat through the band you want, then a gentle roll-off at the bass end. Port tuning sits near the knee.'},
    {label: 'Faults', text: 'A hump just above the tuning means the box is too small or the driver Qts too high. A droop above the bass means too large a box. A sharp bass cliff is normal for vented boxes.'},
  ], [REF.SPL, REF.TS, REF.ESPB]),
  TFMag: new PhoneHelpSection('Transfer function magnitude', 'The SPL response drawn relative to the passband, so the flat part sits at 0 dB.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: level in dB relative to the passband; the dashed line is -3 dB.'},
    {label: 'Good', text: 'Read the -3 dB crossing: that is the bass cut-off (F3). Lower is deeper bass. A flat top before it is a well-aligned box.'},
    {label: 'Faults', text: 'A peak above 0 dB before the roll-off means a boomy, under-damped alignment. A slow slope means a sealed-like, gentle cut-off. Compare F3 between box sizes.'},
  ], [REF.TF, REF.BODE, REF.TS]),
  PRTFMag: new PhoneHelpSection('Transfer function magnitude (PR)', 'The response of the passive radiator alone, without the driver cone.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: level in dB.'},
    {label: 'Good', text: 'A single smooth peak near the radiator tuning, which is where it does most of the work.'},
    {label: 'Faults', text: 'A peak far from the intended tuning means the radiator mass or compliance is wrong. A very sharp peak means little damping, so the radiator may hit its limits.'},
  ], [REF.BR, REF.ENC, REF.TS]),
  PRTFPhase: new PhoneHelpSection('Transfer function phase (PR)', 'How far the passive radiator output runs ahead of or behind its input signal.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: phase in degrees; 180 degrees means the output is turned upside down.'},
    {label: 'Good', text: 'A smooth swing of about 180 degrees through the radiator tuning, then a steady fall. The swing is where the radiator hands over to the driver.'},
    {label: 'Faults', text: 'Sudden jumps of 360 degrees are only wrapping, not a fault. A very steep swing means a sharp, lightly damped resonance.'},
  ], [REF.PH, REF.BODE, REF.BR]),
  Phase: new PhoneHelpSection('Transfer phase', 'How far the speaker output runs ahead of or behind the signal, at each frequency.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: phase in degrees.'},
    {label: 'Good', text: 'A smooth, gradual change. The bass end turns faster for a deeper, steeper cut-off, such as a vented box.'},
    {label: 'Faults', text: 'Jumps of 360 degrees are wrapping, not a fault. A steep change in the passband shows a sharp resonance and matters when you join two drivers with a crossover.'},
  ], [REF.PH, REF.BODE, REF.LW]),
  GD: new PhoneHelpSection('Group delay', 'How late each frequency arrives, in milliseconds. It is the slope of the phase.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: delay in ms.'},
    {label: 'Good', text: 'Low and smooth, rising gently toward the bass end. Sealed boxes rise less than vented boxes.'},
    {label: 'Faults', text: 'A bump near the tuning means ringing: bass notes smear and boom. Values above a few ms in the mid bass can be heard. Smaller bumps are better.'},
  ], [REF.GD, REF.ESPE, REF.LW]),
  MaxPwr: new PhoneHelpSection('Maximum power', 'The most power the speaker can take at each frequency before the cone reaches its limit.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: power in watts.'},
    {label: 'Good', text: 'High across the band you use. The dip near the tuning frequency, then the rise above it, is normal.'},
    {label: 'Faults', text: 'Very low values below the tuning mean the cone hits Xmax long before the amplifier runs out. High-pass filter below tuning to protect the driver.'},
  ], [REF.TS, REF.ESPF, REF.ENC]),
  MaxSPL: new PhoneHelpSection('Maximum SPL', 'The loudest level the speaker can reach at each frequency before a limit is hit.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: level in dB at 1 m.'},
    {label: 'Good', text: 'A high, fairly flat line over the working band, falling at the bass end.'},
    {label: 'Faults', text: 'A deep dip tells you where the cone or the amplifier limit comes first. Compare it with the SPL chart for headroom: a small gap means little loudness in reserve.'},
  ], [REF.SPL, REF.TS, REF.ESPF]),
  VA: new PhoneHelpSection('Amplifier apparent load power', 'The power the amplifier must supply to the speaker as a load, in volt-amps. Part of it comes back, so it is more than the watts that become sound.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: apparent power in VA.'},
    {label: 'Good', text: 'A modest value across the band with no tall spikes.'},
    {label: 'Faults', text: 'Spikes at the impedance dips show the amplifier works hardest there. A low impedance with a big phase angle is hardest on the amplifier.'},
  ], [REF.VA, REF.IMP, REF.ESPI]),
  Excursion: new PhoneHelpSection('Cone excursion', 'How far the cone moves, at each frequency, for the input power.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: peak cone travel in mm.'},
    {label: 'Good', text: 'A line that stays under the red Xmax line over the band. Excursion falls to a minimum at the box tuning, where the port does the work.'},
    {label: 'Faults', text: 'Excursion above Xmax below the tuning gives distortion and can damage the driver. Rising excursion below tuning is normal for vented boxes: use a high-pass filter. Sealed boxes rise gently.'},
  ], [REF.TS, REF.ESPF, REF.BR]),
  PRExcursion: new PhoneHelpSection('Cone excursion (PR)', 'How far the passive radiator cone moves, at each frequency, for the input power.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: peak cone travel in mm.'},
    {label: 'Good', text: 'Under the red limit line, with the largest movement near the radiator tuning.'},
    {label: 'Faults', text: 'Touching the limit gives noise and bottoming. Add mass to the radiator, use a larger radiator, or lower the power.'},
  ], [REF.BR, REF.TS, REF.ENC]),
  Zmag: new PhoneHelpSection('Impedance', 'The electrical load the speaker puts on the amplifier, in ohms, at each frequency.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: impedance in ohms.'},
    {label: 'Good', text: 'A vented box shows two peaks with a dip between them; the tuning frequency is at the dip. A sealed box shows one peak, at the system resonance. The curve stays above the rated minimum.'},
    {label: 'Faults', text: 'Peaks of very different heights show a poorly matched driver and box. A dip well below the rating can overload the amplifier. If the dip is not at the tuning, check the port.'},
  ], [REF.IMP, REF.ESPI, REF.TS]),
  Zph: new PhoneHelpSection('Impedance phase', 'Whether the speaker acts as a coil or a spring on the amplifier. It is the angle between voltage and current.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: phase in degrees; above 0 is coil-like, below 0 is spring-like.'},
    {label: 'Good', text: 'Swings smoothly through zero at each impedance peak. Small angles in the main band mean an easy load.'},
    {label: 'Faults', text: 'A large angle with a low impedance is hard on the amplifier. Angles beyond 60 degrees are demanding.'},
  ], [REF.IMP, REF.ESPI, REF.PH]),
  RearPort: new PhoneHelpSection('Rear port - Air velocity', 'How fast the air moves in the rear port, in metres per second.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: air speed in m/s; the red line is the limit.'},
    {label: 'Good', text: 'Below about 17 m/s, or 5 percent of the speed of sound, up to the power you will play.'},
    {label: 'Faults', text: 'Above the limit, the port chuffs: air noise and distortion. A larger port area, more ports or a lower power fixes it, at the cost of a longer port.'},
  ], [REF.BR, REF.ESPB, REF.ENC]),
  RearPortGain: new PhoneHelpSection('Rear port - Gain', 'The port output compared with the passband, in dB, so the flat part sits at 0 dB.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: level in dB relative to the passband.'},
    {label: 'Good', text: 'A peak near the tuning, which is where the port gives its sound, falling away on both sides.'},
    {label: 'Faults', text: 'A peak above 0 dB or a wide peak means boomy bass. Little output near tuning means the port is not doing its job.'},
  ], [REF.BR, REF.TF, REF.BODE]),
  FrontPort: new PhoneHelpSection('Front port - Air velocity', 'How fast the air moves in the front port, in metres per second.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: air speed in m/s; the red line is the limit.'},
    {label: 'Good', text: 'Below about 17 m/s, or 5 percent of the speed of sound, up to the power you will play.'},
    {label: 'Faults', text: 'Above the limit, the port chuffs: air noise and distortion. A larger port area or a lower power fixes it.'},
  ], [REF.BR, REF.ESPB, REF.ENC]),
  FrontPortGain: new PhoneHelpSection('Front port - Gain', 'The front port output compared with the passband, in dB, so the flat part sits at 0 dB.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: level in dB relative to the passband.'},
    {label: 'Good', text: 'A peak near the front port tuning, falling away on both sides.'},
    {label: 'Faults', text: 'A peak above 0 dB is boomy. Little output near tuning means the port is not doing its job.'},
  ], [REF.BR, REF.TF, REF.BODE]),
  IntraPort: new PhoneHelpSection('Intra-chamber port - Air velocity', 'How fast the air moves in the port between the two chambers, in metres per second.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: air speed in m/s; the red line is the limit.'},
    {label: 'Good', text: 'Below about 17 m/s, or 5 percent of the speed of sound, up to the power you will play.'},
    {label: 'Faults', text: 'Above the limit, the port chuffs. Enlarge the port or lower the power.'},
  ], [REF.BR, REF.ENC, REF.ESPB]),
  FltMag: new PhoneHelpSection('Filter magnitude', 'The effect of the filters alone on the signal level, before the speaker.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: gain in dB; 0 dB is no change.'},
    {label: 'Good', text: 'Flat at 0 dB where you want the signal untouched, with a clean slope where a high-pass or low-pass cuts.'},
    {label: 'Faults', text: 'A bump near the corner means a high-Q filter. Boost above 0 dB takes more cone travel and more power. A stacked high-pass hides bass.'},
  ], [REF.EQ, REF.BUT, REF.LW]),
  FltPhase: new PhoneHelpSection('Filter phase', 'How far the filters alone turn the signal in time, as an angle.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: phase in degrees.'},
    {label: 'Good', text: 'A smooth change near each corner and flat well away from them.'},
    {label: 'Faults', text: 'Large turns in the passband smear the sound. Steeper filters turn the phase more. Wrapping at 360 degrees is not a fault.'},
  ], [REF.PH, REF.BUT, REF.LW]),
  FltGD: new PhoneHelpSection('Filter group delay', 'How late each frequency arrives because of the filters alone, in milliseconds.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: delay in ms.'},
    {label: 'Good', text: 'Low and smooth. Delay grows toward the filter corner.'},
    {label: 'Faults', text: 'Tall peaks near a corner mean ringing, and high-order filters add many ms. Keep the total with the box delay small, because both add up at the same frequencies.'},
  ], [REF.GD, REF.BUT, REF.LW]),
};
