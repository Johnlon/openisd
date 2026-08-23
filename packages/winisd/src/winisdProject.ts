/**
 * The `.wpr` FILE FORMAT — the project-level sibling of `winisdDriver.ts`'s `.wdr`. It holds no
 * live state, derives nothing itself, and names no other package. Callers reach IN; this module
 * never reaches out, and knows nothing of whatever domain model produced the values it is handed.
 *
 * Two directions, both driven from OUTSIDE:
 *
 *  - EXPORT — `toWpr`. A caller reads its own model's getters, computes the physics its own way
 *    (chamber tuning, port area), and hands the finished primitives over as a `WprInput`. The
 *    `[Driver]` block is reused verbatim from the `.wdr` writer, since a `.wpr`'s `[Driver]`
 *    section is field-identical to a `.wdr`.
 *  - IMPORT — `parseWprRaw`. `.wpr` text yields exactly what the file states — no derivation, no
 *    recompute, and a key the file does not carry reads as `undefined`, never a fabricated 0.
 *
 * DRIVER provenance survives a `.wpr` intact: the embedded `[Driver]` block is a full `.wdr`
 * block, `ParState` included, and `parseWprRaw` hands it on verbatim as `driverWdrText` for the
 * `.wdr` reader to parse. There is no second driver parser (QO67).
 *
 * PROJECT-level values are where the two formats genuinely differ: `.wpr` states no E/C/N for
 * `[Box]`, the vents or the filters, so there is nothing for a project-level `diffAgainst` to
 * compare against. That is a property of the format, not a gap in this module.
 *
 * The write shape (`WprInput`) and the read shape (`WprRawParse`) are different types, because
 * the writer is handed finished primitives while the reader yields only what the file states.
 * Unifying them behind one class would put two shapes in one object.
 *
 * Schema + field semantics: WINISD_WPR_FILE_SCHEMA.md (inferred from 50 real WinISD Pro `.wpr`
 * files + the decompiled help). Container: Windows INI, CRLF line endings, no quoting, exactly
 * these 11 sections in this fixed order:
 *   [ProjectInfo] [Driver] [Box] [VentFront] [VentRear] [VentIntra]
 *   [PlotSettings] [SignalSource] [Filters] [PassiveRadiator] [SimulatorOptions]
 *
 * Verified against 15 WinISD Pro-written goldens under
 * packages/winisd/test/fixtures/winisd-parity/goldens/, covering sealed, vented, bandpass, and
 * passive-radiator projects (test/winisdProject.test.ts). Default constants below (chamber
 * losses, ambient, thermal, unused-vent boilerplate) match WinISD's own defaults so a produced
 * file round-trips through WinISD unchanged.
 */
export interface WprVent {
  /** Port diameter, metres (dia1 = dia2, round port). */
  dia?: number;
  /** Physical vent length, metres. */
  len?: number;
  /** End-correction coefficient (WinISD default 0.6, confirmed across the whole parity corpus). */
  endCorrection?: number;
  /**
   * Owning chamber's `[Box]` tuning/volume — front vent → `Ff`/`Vf`, rear → `Fr`/`Vr`.
   * Confirmed against the whole parity corpus (vented-small, bandpass4, vented-b4 goldens):
   * every populated vent's `Fb`/`Vb` equals its own chamber's `[Box]` tuning/volume, never an
   * independent value. Not derived here — the caller already has the chamber tuning it wrote
   * into `WprBox`, so it passes the SAME number through rather than this writer holding a
   * second source of it. REQUIRED (not defaulted): unlike `endCorrection`, there is no
   * evidenced WinISD default for a real vent's tuning/volume — a caller building a populated
   * vent must supply its own chamber's numbers, or the type error forces the call site to be
   * fixed rather than silently re-zeroing.
   */
  Fb: number;
  Vb: number;
  /**
   * Vent cross-sectional area, m². For a round port this is `π·(dia/2)²`, confirmed against the
   * corpus (0.06 m dia → 0.00282743338823081 m²). Physics derivation stays out of this
   * formatter — the caller computes it once (the same value it may also write to
   * `WprBox.SdFront`/`SdRear`) and supplies it here. REQUIRED for the same reason as `Fb`/`Vb`.
   */
  carea: number;
  /**
   * `crosscalc` — WinISD's own provenance flag for this vent: true when the cross-sectional
   * area is CALCULATED from the diameter, false when the area was entered directly.
   *
   * It must come from the caller's real provenance, not a literal. A round port's area is
   * always derived from its diameter, so this is true for every design OpenISD can currently
   * produce — but a slot vent is entered as W×H, which IS entering the area, and hardcoding
   * true would then write a false provenance flag into a WinISD file with nothing to catch
   * it. Defaults to true only because that is what an absent vent section means.
   */
  crossCalculated?: boolean;
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
  signal: {
    Rg?: number;
    P: number;
    /** How many drivers the system uses — WinISD's `Nd`. Absent ⇒ 1. */
    driverCount?: number;
  };
  /** Voice-coil thermal model — WinISD's `alfaVC` (resistance coefficient, /K) and `dTVC`
   *  (temperature rise, K). Real Advanced-pane state, not boilerplate. Absent ⇒ WinISD's
   *  own 0.0039 / 0. */
  voiceCoil?: { alfaVC?: number; tempRise_K?: number };
  plot?: { color?: number; width?: number };
  /** Passive-radiator T/S — written to [PassiveRadiator] only when box.bType === 4. */
  pr?: WprPr | null;
  /**
   * `[SimulatorOptions]` — WinISD's per-project simulation-fidelity flags. These are real
   * design state, not boilerplate, so they are written from the caller's actual settings.
   * Absent → all three 0 (WinISD's own defaults). WinISD's two OTHER Advanced-pane toggles
   * ("Rg is at driver side", "SPL graph is Xmax limited") have no known key in this format —
   * every `.wpr` in the reference corpus lacks them — so they are deliberately NOT written
   * rather than invented. See WINISD_WPR_FILE_SCHEMA.md §10.
   */
  simulatorOptions?: {
    /** Le included in the acoustic circuit (OpenISD: circuitModel === 'gyrator'). */
    vcInductance?: boolean;
    /** Force flat response (auto-EQ). */
    flatResponse?: boolean;
    /** Transmission-line port model. */
    tlPorts?: boolean;
  };
  /**
   * `[Box]`'s ambient block — real per-project design state, written from the caller's own
   * environment rather than as boilerplate. Absent → WinISD's defaults (293.15 K, 101325 Pa,
   * 30 % RH). WinISD stores all three and reads none of them, but it round-trips them
   * faithfully, so writing the user's actual air is what makes the file honest.
   */
  environment?: {
    /** Temperature, K — the same unit on both sides. */
    tempK?: number;
    /** Static pressure, Pa — the same unit on both sides. */
    pressurePa?: number;
    /**
     * Relative humidity as a PERCENTAGE, which is what OpenISD carries everywhere.
     * WinISD's `phi` is a FRACTION, so this is the ONE place the ÷100 happens.
     */
    humidityPct?: number;
  };
}

/** Format a number the WinISD way: plain decimal, full precision, non-finite → 0. */
function num(x: number | undefined | null): string {
  return x == null || !Number.isFinite(x) ? '0' : String(x);
}

/** One INI section: header line then `Key=Value` lines. */
function section(header: string, kv: Array<[string, string | number]>): string {
  return [header, ...kv.map(([k, v]) => `${k}=${v}`)].join('\n');
}

/**
 * WinISD writes all three vent sections even when a box has no vent of that kind (sealed,
 * bandpass front/rear, passive radiator) — but an unused one is empty (`Num=0`, `dia1=0`,
 * `dia2=0`, `endcorrection=0.6`), not a populated fake vent. `v` absent means the box has no
 * vent there; `v` present means a real port, with `endcorrection` defaulting to WinISD's own
 * 0.6 when the caller doesn't carry a design-specific value.
 */
function ventSection(header: string, v: WprVent | undefined): string {
  if (v == null) {
    return section(header, [
      ['Num', 0], ['Shape', 1], ['Fb', 0], ['Vb', 0],
      ['dia1', 0], ['dia2', 0], ['carea', 0], ['len', 0],
      ['endcorrection', 0.6], ['crosscalc', 1],
    ]);
  }
  const dia = v.dia;
  return section(header, [
    ['Num', 1],
    ['Shape', 1], // 1 = round port (only shape in the corpus)
    ['Fb', num(v.Fb)],
    ['Vb', num(v.Vb)],
    ['dia1', dia == null ? 0 : num(dia)],
    ['dia2', dia == null ? 0 : num(dia)],
    ['carea', num(v.carea)],
    ['len', num(v.len)],
    ['endcorrection', v.endCorrection == null ? 0.6 : num(v.endCorrection)],
    ['crosscalc', v.crossCalculated === false ? 0 : 1],
  ]);
}

export function toWpr(input: WprInput): string {
  const { project, box, signal, plot, pr } = input;
  const env = input.environment ?? {};

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
    // Front chamber (bandpass only) — 0 for sealed/vented/PR. WinISD stores a loss triple per
    // chamber; OpenISD's box carries ONE, describing the enclosure, so both chambers are
    // written from it rather than the front chamber discarding the user's losses.
    ['Vf', num(box.Vf)], ['Ff', num(box.Ff)],
    ['Qlf', num(box.Ql ?? 10)], ['Qaf', num(box.Qa ?? 100)], ['Qpf', num(box.Qp ?? 100)],
    // Rear (primary) chamber — the populated one for sealed/vented/PR.
    ['Vr', num(box.Vr)], ['Fr', num(box.Fr)],
    ['Qlr', num(box.Ql ?? 10)], ['Qar', num(box.Qa ?? 100)], ['Qpr', num(box.Qp ?? 100)],
    // Centre chamber — unused across every sampled box type.
    ['Vc', 0], ['Fc', 0], ['Qlc', 0], ['Qac', 0], ['Qpc', 0],
    // Inter-chamber coupling losses (defaults from corpus).
    ['Qiclfr', 100], ['Qiclfc', 0], ['Qiclcr', 0],
    // Ambient — the project's own. `phi` is WinISD's FRACTION; the ÷100 from OpenISD's
    // percentage happens HERE and nowhere else. Placement + thermal stay WinISD defaults.
    // `d` (listening distance) and `Angle` stay at WinISD's own 1 m / 0 rad: OpenISD's UI
    // collects neither, so there is no design state to write. `Med` and `Isobarik` likewise
    // have no OpenISD equivalent.
    ['T', num(env.tempK ?? 293.15)], ['p', num(env.pressurePa ?? 101325)],
    ['phi', num((env.humidityPct ?? 30) / 100)], ['d', 1], ['Med', 0],
    ['Nd', input.signal.driverCount ?? 1],
    ['Angle', 0], ['Isobarik', 0],
    ['alfaVC', num(input.voiceCoil?.alfaVC ?? 0.0039)],
    ['dTVC', num(input.voiceCoil?.tempRise_K ?? 0)],
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

  const sim = input.simulatorOptions;
  const simulatorOptions = section('[SimulatorOptions]', [
    ['VCInd',        sim?.vcInductance  ? 1 : 0],
    ['FlatResponse', sim?.flatResponse  ? 1 : 0],
    ['TLPorts',      sim?.tlPorts       ? 1 : 0],
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

// ── parseWprRaw — the READ side, raw only ──────────────────────────────────────────────────
//
// `toWpr` above is the WRITE side, taking already-computed primitives. This is the read side:
// section/key/value text into raw values, box-type as WinISD's own un-mapped numeric code. No
// box-type→box-kind mapping and no engine formula runs here — the caller (`@openisd/model`'s
// `OpenISDProject.fromWinISDProject`) does both. A key the file does not carry is `undefined`,
// never a fabricated 0 or empty string.

/** One `.wpr` file's raw project-level values, as read — every number already parsed, no
 *  section's internal shape interpreted beyond that. */
export interface WprRawParse {
  /** `[Box].BType`, un-mapped to any OpenISD box kind. `undefined` when the file states no
   *  `BType` key at all. */
  bType: number | undefined;
  /** The `[Driver]` block, verbatim — its own `.wdr` text, readable by
   *  `OpenISDDriver.fromWdrText()`. Not a second driver parser (QO67). */
  driverWdrText: string;
  box: {
    Vr?: number; Fr?: number; Vf?: number; Ff?: number;
    Ql?: number; Qa?: number; Qp?: number; npr?: number;
  };
  signal: { P?: number; Rg?: number };
  ventFront: { dia?: number; len?: number; endCorrection?: number };
  ventRear: { dia?: number; len?: number; endCorrection?: number };
  simulatorOptions: { vcInductance?: boolean; flatResponse?: boolean; tlPorts?: boolean };
  environment: { tempK?: number; pressurePa?: number; humidityPct?: number };
  passiveRadiator: { Sd?: number; Vas?: number; Fs?: number; Qms?: number; Xmax?: number; Me?: number };
  projectInfo: { description?: string; creator?: string; createDate?: string };
}

/** A key the section does not carry, or carries empty, parses to `undefined` — never a
 *  fabricated number. */
function numOrAbsent(sec: Record<string, string> | undefined, key: string): number | undefined {
  const raw = sec?.[key];
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseWprRaw(text: string): WprRawParse {
  const sections: Record<string, Record<string, string>> = {};
  let currentSection: Record<string, string> | null = null;
  const lines = text.split(/\r?\n/);
  const driverLines: string[] = [];
  let inDriver = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const secName = trimmed.slice(1, -1).trim();
      currentSection = {};
      sections[secName] = currentSection;
      inDriver = secName === 'Driver';
      if (inDriver) driverLines.push(trimmed);
    } else {
      if (inDriver) driverLines.push(line);
      if (currentSection) {
        const idx = line.indexOf('=');
        if (idx !== -1) {
          currentSection[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
    }
  }

  const boxSec = sections['Box'];
  const sigSec = sections['SignalSource'];
  const pSec = sections['ProjectInfo'];
  const simOptSec = sections['SimulatorOptions'];
  const ventFrontSec = sections['VentFront'];
  const ventRearSec = sections['VentRear'];
  const prSec = sections['PassiveRadiator'];

  const bType = numOrAbsent(boxSec, 'BType');

  return {
    bType,
    driverWdrText: driverLines.join('\r\n'),
    box: {
      Vr: numOrAbsent(boxSec, 'Vr'), Fr: numOrAbsent(boxSec, 'Fr'),
      Vf: numOrAbsent(boxSec, 'Vf'), Ff: numOrAbsent(boxSec, 'Ff'),
      Ql: numOrAbsent(boxSec, 'Ql'), Qa: numOrAbsent(boxSec, 'Qa'), Qp: numOrAbsent(boxSec, 'Qp'),
      npr: numOrAbsent(boxSec, 'npr'),
    },
    signal: { P: numOrAbsent(sigSec, 'P'), Rg: numOrAbsent(sigSec, 'Rg') },
    ventFront: {
      dia: numOrAbsent(ventFrontSec, 'dia'), len: numOrAbsent(ventFrontSec, 'len'),
      endCorrection: numOrAbsent(ventFrontSec, 'endCorrection'),
    },
    ventRear: {
      dia: numOrAbsent(ventRearSec, 'dia'), len: numOrAbsent(ventRearSec, 'len'),
      endCorrection: numOrAbsent(ventRearSec, 'endCorrection'),
    },
    simulatorOptions: {
      vcInductance: simOptSec ? simOptSec['VCInd'] === '1' : undefined,
      flatResponse: simOptSec ? simOptSec['FlatResponse'] === '1' : undefined,
      tlPorts: simOptSec ? simOptSec['TLPorts'] === '1' : undefined,
    },
    environment: {
      tempK: numOrAbsent(boxSec, 'T'), pressurePa: numOrAbsent(boxSec, 'p'),
      humidityPct: (() => {
        const phi = numOrAbsent(boxSec, 'phi');
        return phi == null ? undefined : phi * 100;
      })(),
    },
    passiveRadiator: {
      Sd: numOrAbsent(prSec, 'Sd'), Vas: numOrAbsent(prSec, 'Vas'),
      Fs: numOrAbsent(prSec, 'Fs'), Qms: numOrAbsent(prSec, 'Qms'),
      Xmax: numOrAbsent(prSec, 'Xmax'), Me: numOrAbsent(prSec, 'Me'),
    },
    projectInfo: {
      description: pSec?.['Description'], creator: pSec?.['Creator'], createDate: pSec?.['CreateDate'],
    },
  };
}
