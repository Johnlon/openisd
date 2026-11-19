/**
 * WinISD 0.7.0.950 plotted chart values (SPL and impedance), logged by debugger, at chosen points of its grid.
 *
 * Source: winisd_research runs/vented-w5-tl0-ql1e6-qp15 and runs/vented-w5-tl0-ql1e6-qp100 (commit 780edb1; write-up
 * runs/vented-w5-tl0-ql1e6-qp15/RESULT.md): W5-1138SMF, 10 L vented, Fb 38 Hz, Ql 1e6 Qa 1e6, Qp 15 or 100, port 50 mm x
 * 369 mm, [SimulatorOptions] TLPorts=0, Rg 0.1 not at driver side, VCInd off, P 1 W. The `.wpr` files are
 * `../winisd/fixtures/vented-w5-tl0-ql1e6-qp{15,100}.wpr`, copies of each run's w5.wpr.
 * Points: the grid points nearest 1, 10, 20, 28.2, 28.3, 30.9, 31.6, 38, 50, 100, 1000 and 10000 Hz (28.2 Hz and 30.9 Hz
 * are where OpenISD's old lossless branch missed WinISD most at Qp 15, 28.3 Hz and 31.6 Hz at Qp 100; 1 Hz is the worst SPL).
 * `i` is the WinISD grid index (the plotted values `v * scale` from each run's gdb.log WPL lines, spl and impedance charts).
 */
export interface VentedCapturePoint { readonly i: number; readonly f: number; readonly spl_dB: number; readonly impedance_ohm: number }

const QP15: readonly VentedCapturePoint[] = [
  {i: 0, f: 1.0, spl_dB: -40.065591701671046, impedance_ohm: 3.403187565737665},
  {i: 485, f: 10.011044675510723, spl_dB: 31.987359872382104, impedance_ohm: 3.7618465552015086},
  {i: 631, f: 20.028786694975416, spl_dB: 57.38181836193697, impedance_ohm: 5.79949506763594},
  {i: 703, f: 28.195475181676358, spl_dB: 71.49059453172475, impedance_ohm: 15.355017108857519},
  {i: 704, f: 28.329718707241728, spl_dB: 71.6983163953174, impedance_ohm: 15.293262854353918},
  {i: 722, f: 30.85840371449002, spl_dB: 75.43287125701424, impedance_ohm: 9.708161726934854},
  {i: 727, f: 31.600043258802454, spl_dB: 76.44540194821458, impedance_ohm: 8.222593756533477},
  {i: 766, f: 38.03107468639404, spl_dB: 82.09191302435708, impedance_ohm: 4.024415907853954},
  {i: 824, f: 50.093751500080344, spl_dB: 81.99796096398626, impedance_ohm: 8.379943282286638},
  {i: 970, f: 100.2210154950716, spl_dB: 80.87841664849675, impedance_ohm: 5.40579222528463},
  {i: 1454, f: 998.5627339581864, spl_dB: 80.55110583703208, impedance_ohm: 3.412706727178175},
  {i: 1939, f: 9996.656140955532, spl_dB: 80.54713975708084, impedance_ohm: 3.4001262840085906},
];
const QP100: readonly VentedCapturePoint[] = [
  {i: 0, f: 1.0, spl_dB: -48.182244630495575, impedance_ohm: 3.4030970229548765},
  {i: 485, f: 10.011044675510723, spl_dB: 31.758283783235473, impedance_ohm: 3.751184698296848},
  {i: 631, f: 20.028786694975416, spl_dB: 57.5132700146465, impedance_ohm: 5.743978918435793},
  {i: 703, f: 28.195475181676358, spl_dB: 72.16821427943137, impedance_ohm: 21.530822164281727},
  {i: 704, f: 28.329718707241728, spl_dB: 72.39165712836291, impedance_ohm: 21.540717688816542},
  {i: 722, f: 30.85840371449002, spl_dB: 76.48124722568639, impedance_ohm: 10.34080043772168},
  {i: 727, f: 31.600043258802454, spl_dB: 77.6155884452649, impedance_ohm: 8.224238974132332},
  {i: 766, f: 38.03107468639404, spl_dB: 83.60603604531474, impedance_ohm: 3.4971590074931442},
  {i: 824, f: 50.093751500080344, spl_dB: 82.25267297740572, impedance_ohm: 8.315454747224853},
  {i: 970, f: 100.2210154950716, spl_dB: 80.88199238886209, impedance_ohm: 5.404857398499756},
  {i: 1454, f: 998.5627339581864, spl_dB: 80.55110591952862, impedance_ohm: 3.4127067263958533},
  {i: 1939, f: 9996.656140955532, spl_dB: 80.54713975709583, impedance_ohm: 3.40012628400859},
];

export const WINISD_VENTED_TL0_LOSSLESS_CAPTURE = Object.freeze({
  /** WinISD's grid: point `i` of each chart is grid point `i`. */
  grid: {fmin: 1.0, fmax: 20095.223453196217, N: 2086},
  qp15: QP15,
  qp100: QP100,
});
