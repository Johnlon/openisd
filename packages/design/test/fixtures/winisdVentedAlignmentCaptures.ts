/**
 * WinISD 0.7.0.950 New Project wizard — vented alignment captures.
 *
 * Source: winisd_research/runs/vented_alignments.jsonl (60 wizard runs, Qts 0.15–1.0, one fresh WinISD per
 * run, `.wpr` saved and parsed). Every row: Fs 40 Hz, Vas 0.02 m³, Qms 4.0, Re 6 Ω, project
 * Rg 0.1 Ω, Ql 10, Qa 100, Qp 100. `Vb`/`Fb` are the 15-significant-digit `Box.Vr`/`Box.Fr`
 * WinISD wrote. Reproduction to ~1e-15 by the decompiled designer:
 * winisd_research/GHIDRA_FINDINGS.md "VENTED ALIGNMENT MECHANISM FOUND — 0x46afd0".
 */
import type {VentedAlignment} from '../../engine/index.js';

export interface WinIsdVentedAlignmentCapture {
  readonly alignment: VentedAlignment;
  /** Driver Qes as written to the seed `.wdr` (six decimals); Qms is 4.0 for every row. */
  readonly Qes: number;
  readonly Vb_m3: number;
  readonly Fb_hz: number;
}

export const WINISD_VENTED_CAPTURE_DRIVER = Object.freeze({
  Fs_hz: 40, Vas_m3: 0.02, Qms: 4.0, Re_ohm: 6, Rg_ohm: 0.1, Ql: 10,
});

export const WINISD_VENTED_ALIGNMENT_CAPTURES: readonly WinIsdVentedAlignmentCapture[] = Object.freeze([
  {alignment: 'qb3',  Qes: 0.155844, Vb_m3: 0.00140161141352802,  Fb_hz: 101.14493300757},
  {alignment: 'bb4',  Qes: 0.155844, Vb_m3: 0.00191613342509092,  Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.155844, Vb_m3: 2.6608203522058E-6,   Fb_hz: 64.7775863684653},
  {alignment: 'ebs3', Qes: 0.155844, Vb_m3: 0.00398860470898139,  Fb_hz: 75.7441445135597},
  {alignment: 'ebs6', Qes: 0.155844, Vb_m3: 0.00578896015926764,  Fb_hz: 54.5311511799841},
  {alignment: 'qb3',  Qes: 0.210526, Vb_m3: 0.00268582879359818,  Fb_hz: 76.3759181518676},
  {alignment: 'bb4',  Qes: 0.210526, Vb_m3: 0.00344041386491519,  Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.210526, Vb_m3: 0.00216737748995934,  Fb_hz: 41.0170955302832},
  {alignment: 'ebs3', Qes: 0.210526, Vb_m3: 0.00758638469718008,  Fb_hz: 56.7471876399714},
  {alignment: 'ebs6', Qes: 0.210526, Vb_m3: 0.011279807193055,    Fb_hz: 40.1760555445309},
  {alignment: 'qb3',  Qes: 0.266667, Vb_m3: 0.00451312308287168,  Fb_hz: 61.7083777039091},
  {alignment: 'bb4',  Qes: 0.266667, Vb_m3: 0.00542953173764449,  Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.266667, Vb_m3: 0.00524954073585443,  Fb_hz: 41.6787725324207},
  {alignment: 'ebs3', Qes: 0.266667, Vb_m3: 0.0126010930247188,   Fb_hz: 45.5104067361888},
  {alignment: 'ebs6', Qes: 0.266667, Vb_m3: 0.0181803935641347,   Fb_hz: 32.6238455581257},
  {alignment: 'qb3',  Qes: 0.324324, Vb_m3: 0.00728278743839243,  Fb_hz: 51.956205847558},
  {alignment: 'bb4',  Qes: 0.324324, Vb_m3: 0.00789721641555739,  Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.324324, Vb_m3: 0.00734428503274614,  Fb_hz: 44.2761501461472},
  {alignment: 'ebs3', Qes: 0.324324, Vb_m3: 0.0189430171539515,   Fb_hz: 38.2385897956906},
  {alignment: 'ebs6', Qes: 0.324324, Vb_m3: 0.0255251691778146,   Fb_hz: 28.2537298421556},
  {alignment: 'qb3',  Qes: 0.383562, Vb_m3: 0.0118168656350587,   Fb_hz: 44.9403837174879},
  {alignment: 'bb4',  Qes: 0.383562, Vb_m3: 0.010857807967841,    Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.383562, Vb_m3: 0.0114937983806168,   Fb_hz: 43.4556732146168},
  {alignment: 'ebs3', Qes: 0.383562, Vb_m3: 0.0264155121134899,   Fb_hz: 33.2369234782351},
  {alignment: 'ebs6', Qes: 0.383562, Vb_m3: 0.0325464018325633,   Fb_hz: 25.452660375755},
  {alignment: 'qb3',  Qes: 0.432133, Vb_m3: 0.0174472415421046,   Fb_hz: 40.5668470735291},
  {alignment: 'bb4',  Qes: 0.432133, Vb_m3: 0.0135909203380648,   Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.432133, Vb_m3: 0.0172885792662035,   Fb_hz: 40.6761517251006},
  {alignment: 'ebs3', Qes: 0.432133, Vb_m3: 0.0330327244518772,   Fb_hz: 30.2768310718135},
  {alignment: 'ebs6', Qes: 0.432133, Vb_m3: 0.0376196150654936,   Fb_hz: 23.8186393055339},
  {alignment: 'qb3',  Qes: 0.507042, Vb_m3: 0.0303986112941181,   Fb_hz: 35.365158131113},
  {alignment: 'bb4',  Qes: 0.507042, Vb_m3: 0.0183164975755506,   Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.507042, Vb_m3: 0.0307091354072174,   Fb_hz: 35.4650668183807},
  {alignment: 'ebs3', Qes: 0.507042, Vb_m3: 0.0436778601186315,   Fb_hz: 26.9813139033791},
  {alignment: 'ebs6', Qes: 0.507042, Vb_m3: 0.0441017963318063,   Fb_hz: 21.9049167738629},
  {alignment: 'qb3',  Qes: 0.571429, Vb_m3: 0.0452173163649812,   Fb_hz: 31.8965272102604},
  {alignment: 'bb4',  Qes: 0.571429, Vb_m3: 0.0228453820130935,   Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.571429, Vb_m3: 0.0451734696616595,   Fb_hz: 31.6775175532805},
  {alignment: 'ebs3', Qes: 0.571429, Vb_m3: 0.0528907364415523,   Fb_hz: 24.9608829038394},
  {alignment: 'ebs6', Qes: 0.571429, Vb_m3: 0.0484687183899941,   Fb_hz: 20.5690439273994},
  {alignment: 'qb3',  Qes: 0.705882, Vb_m3: 0.0731469456463288,   Fb_hz: 26.4967973860657},
  {alignment: 'bb4',  Qes: 0.705882, Vb_m3: 0.033582159208005,    Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.705882, Vb_m3: 0.0753171748632468,   Fb_hz: 26.9157282572239},
  {alignment: 'ebs3', Qes: 0.705882, Vb_m3: 0.0711517919620219,   Fb_hz: 22.1875841071701},
  {alignment: 'ebs6', Qes: 0.705882, Vb_m3: 0.054836972101505,    Fb_hz: 18.1664802176786},
  {alignment: 'qb3',  Qes: 0.848485, Vb_m3: 0.0671648664183383,   Fb_hz: 22.4339286549067},
  {alignment: 'bb4',  Qes: 0.848485, Vb_m3: 0.0466707275073306,   Fb_hz: 40},
  {alignment: 'c4',   Qes: 0.848485, Vb_m3: 0.107015248002721,    Fb_hz: 24.1263851661866},
  {alignment: 'ebs3', Qes: 0.848485, Vb_m3: 0.087816344204014,    Fb_hz: 20.4866223039469},
  {alignment: 'ebs6', Qes: 0.848485, Vb_m3: 0.0590137270448866,   Fb_hz: 15.8536883622096},
  {alignment: 'qb3',  Qes: 1, Vb_m3: 0.0319472178851644,   Fb_hz: 19.2343702671579},
  {alignment: 'bb4',  Qes: 1, Vb_m3: 0.062253717148998,    Fb_hz: 40},
  {alignment: 'c4',   Qes: 1, Vb_m3: 0.172611315809028,    Fb_hz: 19.9969093470704},
  {alignment: 'ebs3', Qes: 1, Vb_m3: 0.101777363146729,    Fb_hz: 19.4519993812389},
  {alignment: 'ebs6', Qes: 1, Vb_m3: 0.0620217659527626,   Fb_hz: 13.5642401784958},
  {alignment: 'qb3',  Qes: 1.333333, Vb_m3: 0.000991585132361051, Fb_hz: 14.4821986201961},
  {alignment: 'bb4',  Qes: 1.333333, Vb_m3: 0.101520221030381,    Fb_hz: 40},
  {alignment: 'c4',   Qes: 1.333333, Vb_m3: 1.68448856574925,     Fb_hz: 5.40253768331173},
  {alignment: 'ebs3', Qes: 1.333333, Vb_m3: 0.119852458493368,    Fb_hz: 18.6037508095347},
  {alignment: 'ebs6', Qes: 1.333333, Vb_m3: 0.0672598244063324,   Fb_hz: 9.28325790748366},
]);
