/**
 * WinISD `.wpr` project-file serialisation. File-format concerns live here, not in
 * @openisd/engine (ARCHITECTURE.md AD-6). Pure formatter: it takes already-computed
 * primitives (the caller does the physics — chamber tuning, port area) plus the driver's
 * `[Driver]` block (reused verbatim from Driver.toWdr(), which is field-identical to a
 * `.wpr` [Driver] section) and emits the INI text. No engine, store, or Vue imports.
 *
 * Schema + field semantics: WINISD_WPR_FILE_SCHEMA.md (inferred from 50 real WinISD Pro
 * `.wpr` files + the decompiled help). Container: Windows INI, CRLF line endings, no quoting,
 * exactly these 11 sections in this fixed order:
 *   [ProjectInfo] [Driver] [Box] [VentFront] [VentRear] [VentIntra]
 *   [PlotSettings] [SignalSource] [Filters] [PassiveRadiator] [SimulatorOptions]
 *
 * ⚠ Verified only against the one in-repo sample (a passive-radiator project,
 * docs/winisd/sample_project_Epique15_-_pr.wpr). Sealed / vented / bandpass output follows
 * the documented schema but has no in-repo file to byte-diff against — notably sealed
 * [Box].Fr semantics. Default constants below (chamber losses, ambient, thermal, unused
 * vent boilerplate) are copied from that sample; where a value is undocumented, it matches
 * WinISD's own default so a produced file round-trips through WinISD unchanged.
 */

export interface WprVent {
  /** Port diameter, metres (dia1 = dia2, round port). */
  dia?: number;
  /** Physical vent length, metres. */
  len?: number;
  /** End-correction coefficient (WinISD default 0.732 = one flanged + one free). */
  endCorrection?: number;
}

export interface WprBox {
  /** WinISD box-type enum: 0 sealed · 1 vented · 2 4th-order bandpass · 4 passive radiator. */
  bType: number;
  /** Rear (primary) chamber volume, m³, and its tuning frequency, Hz. */
  Vr: number;
  Fr: number;
  /** Front chamber (bandpass only), m³ / Hz. Default 0. */
  Vf?: number;
  Ff?: number;
  /** Primary-chamber loss factors. Default 10 / 100 / 100 (WinISD defaults). */
  Ql?: number;
  Qa?: number;
  Qp?: number;
  /** Port cross-sectional areas, m². Default 0 (closed / PR). */
  SdFront?: number;
  SdRear?: number;
  /** Passive-radiator count — emitted as the last [Box] key ONLY when bType === 4. */
  npr?: number;
}

export interface WprPr {
  Vas: number;
  Qms: number;
  Fs: number;
  Sd: number;
  Xmax: number;
  Me?: number;
}

export interface WprInput {
  project: { description?: string; creator?: string; createDate?: string; modifyDate?: string };
  /** The full `[Driver]` block from Driver.toWdr() — header line through `ParState=…`. */
  driverSection: string;
  box: WprBox;
  ventFront?: WprVent;
  ventRear?: WprVent;
  ventIntra?: WprVent;
  signal: { Rg?: number; P: number };
  plot?: { color?: number; width?: number };
  /** Passive-radiator T/S — written to [PassiveRadiator] only when box.bType === 4. */
  pr?: WprPr | null;
}

/** Format a number the WinISD way: plain decimal, full precision, non-finite → 0. */
function num(x: number | undefined | null): string {
  return x == null || !Number.isFinite(x) ? '0' : String(x);
}

/** One INI section: header line then `Key=Value` lines. */
function section(header: string, kv: Array<[string, string | number]>): string {
  return [header, ...kv.map(([k, v]) => `${k}=${v}`)].join('\n');
}

/** Unused/boilerplate vent section — WinISD writes all three even when a box doesn't use them. */
function ventSection(header: string, v: WprVent | undefined): string {
  const dia = v?.dia;
  return section(header, [
    ['Num', 1],
    ['Shape', 1], // 1 = round port (only shape in the corpus)
    ['Fb', 0], // always 0 in corpus — tuning lives in [Box].Fr
    ['Vb', 0],
    ['dia1', dia == null ? 0.102 : num(dia)], // 0.102 = WinISD default port diameter
    ['dia2', dia == null ? 0.102 : num(dia)],
    ['carea', 0],
    ['len', num(v?.len)],
    ['endcorrection', v?.endCorrection == null ? 0.732 : num(v.endCorrection)],
    ['crosscalc', 1],
  ]);
}

export function toWpr(input: WprInput): string {
  const { project, box, signal, plot, pr } = input;

  const projectInfo = section('[ProjectInfo]', [
    ['Description', project.description ?? ''],
    ['Creator', project.creator ?? ''],
    ['CreateDate', project.createDate ?? ''],
    ['ModifyDate', project.modifyDate ?? ''],
  ]);

  // [Driver] is reused verbatim from Driver.toWdr(): header line + fields + ParState. Trim any
  // trailing blank line so section joining controls the blank-line spacing uniformly.
  const driver = input.driverSection.replace(/\r\n/g, '\n').replace(/\n+$/, '');

  const boxKv: Array<[string, string | number]> = [
    ['BType', box.bType],
    // Front chamber (bandpass only) — 0 for sealed/vented/PR.
    ['Vf', num(box.Vf)], ['Ff', num(box.Ff)], ['Qlf', 10], ['Qaf', 100], ['Qpf', 100],
    // Rear (primary) chamber — the populated one for sealed/vented/PR.
    ['Vr', num(box.Vr)], ['Fr', num(box.Fr)],
    ['Qlr', num(box.Ql ?? 10)], ['Qar', num(box.Qa ?? 100)], ['Qpr', num(box.Qp ?? 100)],
    // Centre chamber — unused across every sampled box type.
    ['Vc', 0], ['Fc', 0], ['Qlc', 0], ['Qac', 0], ['Qpc', 0],
    // Inter-chamber coupling losses (defaults from corpus).
    ['Qiclfr', 100], ['Qiclfc', 0], ['Qiclcr', 0],
    // Ambient + placement + thermal (all WinISD defaults; OpenISD does not vary these).
    ['T', 293.15], ['p', 101325], ['phi', 0.3], ['d', 1], ['Med', 0], ['Nd', 1],
    ['Angle', 0], ['Isobarik', 0], ['alfaVC', 0.0039], ['dTVC', 0],
    ['Sdfport', num(box.SdFront)], ['Sdrport', num(box.SdRear)],
  ];
  if (box.bType === 4) boxKv.push(['Npr', box.npr ?? 1]); // Npr present ONLY for passive radiators
  const boxSection = section('[Box]', boxKv);

  const plotSettings = section('[PlotSettings]', [
    ['Color', plot?.color ?? 16711680], // Win32 COLORREF; default pure blue
    ['Width', plot?.width ?? 1],
  ]);

  const signalSource = section('[SignalSource]', [
    ['Rg', signal.Rg ?? 0.1],
    ['P', num(signal.P)],
  ]);

  // OpenISD does not yet drive WinISD's behavioural filter chain — emit an empty chain.
  const filters = section('[Filters]', [['Count', 0]]);

  // [PassiveRadiator] body only for BType=4; otherwise an empty section header.
  const passiveRadiator = box.bType === 4 && pr
    ? section('[PassiveRadiator]', [
        ['Vas', num(pr.Vas)], ['Qms', num(pr.Qms)], ['Fs', num(pr.Fs)],
        ['Sd', num(pr.Sd)], ['Xmax', num(pr.Xmax)], ['Me', num(pr.Me)],
      ])
    : '[PassiveRadiator]';

  const simulatorOptions = section('[SimulatorOptions]', [
    ['VCInd', 0], ['FlatResponse', 0], ['TLPorts', 0],
  ]);

  const sections = [
    projectInfo, driver, boxSection,
    ventSection('[VentFront]', input.ventFront),
    ventSection('[VentRear]', input.ventRear),
    ventSection('[VentIntra]', input.ventIntra),
    plotSettings, signalSource, filters, passiveRadiator, simulatorOptions,
  ];

  // Blank line between sections; whole file CRLF with a trailing CRLF.
  return sections.join('\n\n').replace(/\n/g, '\r\n') + '\r\n';
}
