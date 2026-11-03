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
  THIELE: {title: 'A. N. Thiele: Loudspeakers in Vented Boxes (JAES 1971)', url: 'https://diyaudioprojects.com/Technical/Papers/Loudspeakers-in-Vented-Boxes-Part-I.pdf'},
  SMALL_DR: {title: 'Richard H. Small: Direct Radiator Loudspeaker System Analysis (JAES 1972)', url: 'https://diyaudioprojects.com/Technical/Papers/Direct-Radiator-Loudspeaker-System-Analysis.pdf'},
  SMALL_VB: {title: 'Richard H. Small: Vented-Box Loudspeaker Systems (JAES 1973)', url: 'https://diyaudioprojects.com/Technical/Papers/Vented-Box-Loudspeaker-Systems-Part-I.pdf'},
  LW: {title: 'Linkwitz Lab: Active filters', url: 'https://www.linkwitzlab.com/filters.htm'},
  LWF: {title: 'Linkwitz Lab: Frontiers of loudspeaker design', url: 'https://www.linkwitzlab.com/frontiers.htm'},
} as const satisfies Record<string, HelpLink>;

/**
 * The help of every chart on the phone Graph page: one plain sentence, the axes, what good looks like,
 * what the common faults look like, and teaching links. `Record<ChartId, ...>` makes a chart without
 * help a compile error. Each title equals the chart's name in `TAB_META` (a test checks it).
 */
export const CHART_HELP: Record<ChartId, PhoneHelpSection> = {
  SPL: new PhoneHelpSection('SPL response', 'The absolute sound pressure level the speaker produces at 1 metre for the input power chosen on the Signal page.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: sound pressure level in dB at 1 m.'},
    {label: 'Good', text: 'A smooth, flat curve across your working passband. Raise or lower the Signal page power to see how loud the design plays, and check that its output keeps up with the other drivers in a multi-way system.'},
    {label: 'Faults', text: 'A hump in the upper bass means the box is too small or driver Qts is too high; enlarge the box to flatten it. A steep cliff in deep bass is normal for vented boxes.'},
  ], [REF.SPL, REF.TS, REF.SMALL_DR]),
  TFMag: new PhoneHelpSection('Transfer function magnitude', 'The normalised frequency response of the box, drawn relative to the passband so the flat part sits at 0 dB.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: output in dB relative to the passband; the dashed line marks -3 dB.'},
    {label: 'Good', text: 'Flat at 0 dB across the passband. Read the bass cut-off (F3) at the -3 dB line: sealed boxes roll off at about 12 dB per octave, whereas vented boxes roll off at 24 dB per octave. Vented designs reach deeper but fall fast below the tuning.'},
    {label: 'Faults', text: 'A peak above 0 dB before the roll-off means a boomy, under-damped box; enlarge the box or add damping to smooth it.'},
  ], [REF.TF, REF.BODE, REF.TS]),
  PRTFMag: new PhoneHelpSection('Transfer function magnitude (PR)', 'The response of the passive radiator alone, without the driver cone.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: level in dB.'},
    {label: 'Good', text: 'A single smooth peak near the radiator tuning frequency, where the radiator reproduces deep bass while holding cone movement down.'},
    {label: 'Faults', text: 'A peak far from the intended tuning means incorrect radiator mass; add or remove mass from the radiator to hit the target frequency.'},
  ], [REF.BR, REF.ENC, REF.TS]),
  PRTFPhase: new PhoneHelpSection('Transfer function phase (PR)', 'How far the passive radiator output runs ahead of or behind the input signal across frequency.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: phase in degrees; 180 degrees represents an inverted acoustic wave.'},
    {label: 'Good', text: 'A smooth, gradual phase change through the band. Passive radiator systems turn about 360 degrees through the bass, with the main swing near the radiator tuning.'},
    {label: 'Faults', text: 'Sharp phase changes mean a resonance or poor transient response; adjust radiator tuning mass or box volume to smooth the curve. Jumps of 360 degrees are display wrapping, not a fault.'},
  ], [REF.PH, REF.BODE, REF.BR]),
  Phase: new PhoneHelpSection('Transfer phase', 'How far the speaker acoustic output runs ahead of or behind the electrical input signal across frequency.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: acoustic phase in degrees.'},
    {label: 'Good', text: 'A smooth, gradual change through the band. Sealed boxes turn about 180 degrees through the bass, whereas vented boxes turn about 360 degrees because of their steeper acoustic roll-off.'},
    {label: 'Faults', text: 'Sharp phase changes mean a resonance or poor transient response, causing smeared bass; adjust box volume or tuning to smooth the transition. Jumps of 360 degrees are display wrapping, not a fault.'},
  ], [REF.PH, REF.BODE, REF.LW]),
  GD: new PhoneHelpSection('Group delay', 'How late each frequency arrives in milliseconds, showing the transient response of the enclosure.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: delay in ms.'},
    {label: 'Good', text: 'Low and smooth across the band. Sealed boxes stay nearly flat, while vented boxes peak near tuning. For punchy bass, aim below about 15 to 20 ms at 40 Hz.'},
    {label: 'Faults', text: 'High bass delay sounds slow or muddy; lower the tuning frequency or enlarge the box to pull the delay peak down.'},
  ], [REF.GD, REF.THIELE, REF.LW]),
  MaxPwr: new PhoneHelpSection('Maximum power', 'The most power the speaker can accept at each frequency before hitting thermal or mechanical limits.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: maximum power in watts.'},
    {label: 'Good', text: 'High power capacity across the working band. The curve traces the lower of the voice-coil thermal rating and the cone excursion limit at each frequency.'},
    {label: 'Faults', text: 'Power handling drops steeply at low frequencies; never assume rated power across the band. Fix: add a subsonic high-pass filter below tuning to protect the driver.'},
  ], [REF.TS, REF.SMALL_VB, REF.ENC]),
  MaxSPL: new PhoneHelpSection('Maximum SPL', 'The maximum loudness the speaker can produce before hitting thermal or excursion limits.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: sound pressure level in dB at 1 m.'},
    {label: 'Good', text: 'A high, smooth curve combining box efficiency plus the power limit to show the ceiling of clean acoustic output.'},
    {label: 'Faults', text: 'Gaps against your output target show where the design falls short. Fix: choose a driver with higher sensitivity or greater Xmax, or add a second driver.'},
  ], [REF.SPL, REF.TS, REF.SMALL_DR]),
  VA: new PhoneHelpSection('Amplifier apparent load power', 'The apparent power the amplifier must supply to the speaker load, measured in volt-amps.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: apparent load power in VA.'},
    {label: 'Good', text: 'A modest curve that tracks the real input wattage, showing an easy electrical load for the amplifier.'},
    {label: 'Faults', text: 'Tall spikes in volt-amps at low impedance dips demand heavy reactive current from the amplifier; choose a driver with higher impedance or alter box tuning.'},
  ], [REF.VA, REF.IMP]),
  Excursion: new PhoneHelpSection('Cone excursion', 'How far the driver cone travels at each frequency for the input power chosen on the Signal page.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: peak cone travel in mm; the red line marks Xmax.'},
    {label: 'Good', text: 'The curve must stay under the Xmax line at your chosen power. Vented boxes dip to a minimum at the tuning frequency (Fb), where the port does most of the work.'},
    {label: 'Faults', text: 'Vented excursion rises steeply below tuning, risking mechanical damage. Fix: add a subsonic high-pass filter below tuning, or use less power.'},
  ], [REF.TS, REF.SMALL_VB, REF.BR]),
  PRExcursion: new PhoneHelpSection('Cone excursion (PR)', 'How far the passive radiator diaphragm moves at each frequency for the chosen input power.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: peak displacement in mm; the red line marks the radiator Xmax.'},
    {label: 'Good', text: 'The curve must stay under the Xmax line at the chosen power, peaking near the radiator tuning frequency.'},
    {label: 'Faults', text: 'Excursion rising above Xmax causes bottoming and distortion. Fix: add a subsonic high-pass filter below tuning, use a radiator with greater Xmax, or use less power.'},
  ], [REF.BR, REF.TS, REF.ENC]),
  Zmag: new PhoneHelpSection('Impedance', 'The electrical impedance the speaker presents to the amplifier across frequency, in ohms.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: impedance in ohms.'},
    {label: 'Good', text: 'Sealed boxes show one peak (Fc); vented boxes show two peaks with the dip at Fb. Compare a measured box to the prediction to catch build errors, and check that impedance at the crossover matches the design.'},
    {label: 'Faults', text: 'A low minimum impedance loads the amplifier harder and can trigger protection circuits; raise the impedance or alter tuning to ease amplifier load.'},
  ], [REF.IMP, REF.SMALL_DR, REF.TS]),
  Zph: new PhoneHelpSection('Impedance phase', 'The phase angle between amplifier voltage and current across frequency, showing reactive load behaviour.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: phase in degrees; 0 degrees is purely resistive.'},
    {label: 'Good', text: 'The curve crosses 0 degrees at each impedance peak and dip. Small angles through the passband mean an easy load.'},
    {label: 'Faults', text: 'A large angle where the impedance is also low makes the amplifier supply heavy reactive current and run hot; adjust the box tuning or add an impedance-correction network.'},
  ], [REF.IMP, REF.PH]),
  RearPort: new PhoneHelpSection('Rear port - Air velocity', 'How fast air moves through the rear port at each frequency for the chosen input power.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: air velocity in metres per second; the red line is the air speed limit.'},
    {label: 'Good', text: 'Below 17 m/s any port is quiet, even a plain cut pipe. With properly rounded (flared) port ends, up to 35 m/s can be fine. Keep the curve below the red limit line.'},
    {label: 'Faults', text: 'Speeds above 35 m/s cause port noise and compression. Fix: use a wider port, which needs a longer port for the same tuning.'},
  ], [REF.BR, REF.THIELE, REF.ENC]),
  RearPortGain: new PhoneHelpSection('Rear port - Gain', 'The acoustic output of the rear port alone relative to the passband, normalised so the passband sits at 0 dB.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: port output in dB relative to the passband.'},
    {label: 'Good', text: 'A clean peak reaching near 0 dB at the port tuning frequency (Fb), where the port produces most of the bass output.'},
    {label: 'Faults', text: 'A peak rising well above 0 dB gives boomy, one-note bass; enlarge the box or lower the tuning frequency to tame it.'},
  ], [REF.BR, REF.TF, REF.BODE]),
  FrontPort: new PhoneHelpSection('Front port - Air velocity', 'How fast air moves through the front port at each frequency for the chosen input power.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: air velocity in metres per second; the red line is the air speed limit.'},
    {label: 'Good', text: 'Below 17 m/s any port is quiet, even a plain cut pipe. With properly rounded (flared) port ends, up to 35 m/s can be fine. Keep the curve below the red limit line.'},
    {label: 'Faults', text: 'Speeds above 35 m/s cause port noise and compression. Fix: use a wider port, which needs a longer port for the same tuning.'},
  ], [REF.BR, REF.THIELE, REF.ENC]),
  FrontPortGain: new PhoneHelpSection('Front port - Gain', 'The acoustic output of the front port alone relative to the passband, normalised so the passband sits at 0 dB.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: front port output in dB relative to the passband.'},
    {label: 'Good', text: 'A smooth bell-shaped peak centred at the front port tuning frequency, forming the main acoustic passband of a bandpass box.'},
    {label: 'Faults', text: 'A peak rising well above 0 dB gives boomy bass; enlarge the front chamber or tune the port lower to level the output.'},
  ], [REF.BR, REF.TF, REF.BODE]),
  IntraPort: new PhoneHelpSection('Intra-chamber port - Air velocity', 'How fast air moves through the port between chambers at each frequency for the chosen input power.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: air velocity in metres per second; the red line is the air speed limit.'},
    {label: 'Good', text: 'Below 17 m/s any port is quiet, even a plain cut pipe. With properly rounded (flared) port ends, up to 35 m/s can be fine. Keep the curve below the red limit line.'},
    {label: 'Faults', text: 'Speeds above 35 m/s cause port noise and compression. Fix: use a wider port, which needs a longer port for the same tuning.'},
  ], [REF.BR, REF.ENC, REF.SMALL_VB]),
  FltMag: new PhoneHelpSection('Filter magnitude', 'The effect of the electrical filters alone on signal level across frequency, before the speaker.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: filter gain in dB; 0 dB is no change.'},
    {label: 'Good', text: 'Flat at 0 dB across the passband, rolling off smoothly at the crossover or subsonic filter cut-off frequency.'},
    {label: 'Faults', text: 'A peak above 0 dB near the cut-off frequency means an under-damped, resonant filter; reduce the filter Q to flatten the response.'},
  ], [REF.EQ, REF.BUT, REF.LW]),
  FltPhase: new PhoneHelpSection('Filter phase', 'How far the electrical filters alone turn the signal phase across frequency, as an angle.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: filter phase in degrees.'},
    {label: 'Good', text: 'A smooth, gradual change near filter corner frequencies and flat well away from them, typically shifting 45 degrees per order at the corner.'},
    {label: 'Faults', text: 'Rapid phase swings in the crossover band cause cancellation with paired drivers; invert driver polarity or adjust filter alignment to restore smooth handover.'},
  ], [REF.PH, REF.BUT, REF.LW]),
  FltGD: new PhoneHelpSection('Filter group delay', 'How late each frequency arrives because of the electrical filters alone, in milliseconds.', [
    {label: 'Axes', text: 'Across: frequency in Hz, log scale. Up: filter delay in ms.'},
    {label: 'Good', text: 'Low and smooth across the band. Aim below about 15 to 20 ms at 40 Hz for the combined delay of the filter and the box.'},
    {label: 'Faults', text: 'Tall delay peaks from steep filters smear transients and make bass sound slow or muddy; reduce the filter order or use a gentler alignment (such as Bessel).'},
  ], [REF.GD, REF.BUT, REF.LW]),
};
