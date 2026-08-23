/**
 * One WinISD `.wpr` project file — the in/out object for the format, exactly as `WinISDDriver`
 * is for `.wdr`. Build one from values, or read one from file text; either way you hold the
 * same thing and can ask it for its text or for any value it carries.
 *
 * A `.wpr` is INI text: eleven `[Section]` blocks of `key=value` lines, with a whole `.wdr`
 * embedded as the `[Driver]` section. The driver block is carried verbatim — parsing it is
 * `WinISDDriver`'s job, not this class's.
 *
 * Values live in one generic store: section name → key → string. Reading keeps EVERY key of
 * every section, whether or not anything currently consumes it — a key this class cannot name
 * cannot be silently destroyed on a round trip. Writing lays the file out from the fixed
 * template below: the eleven sections in WinISD's own order, each key's WinISD default filled
 * in unless the builder supplied a value, and supplied keys the template does not list (for
 * example `Npr`, present only for passive radiators) appended at the end of their section.
 *
 * This class does no physics and no unit conversion. The builder speaks the file's own
 * vocabulary (`Vr`, `phi`, `crosscalc`, …) and has already computed every number — the same
 * contract as `WinISDDriver.build()`, where the caller names WDR keys directly.
 *
 * Verified against 15 WinISD Pro-written goldens under
 * packages/winisd/test/fixtures/winisd-parity/goldens/ (test/winisdProject.test.ts). The
 * defaults below match WinISD's own, so a produced file round-trips through WinISD unchanged.
 */

/** Every key of every section, in WinISD's own order, with WinISD's own default. A `null`
 *  default means the key is written only when the builder supplies it. */
const TEMPLATE: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string | null]>]> = (() => {
  const vent: ReadonlyArray<readonly [string, string | null]> = [
    ['Num', '0'], ['Shape', '1'], ['Fb', '0'], ['Vb', '0'],
    ['dia1', '0'], ['dia2', '0'], ['carea', '0'], ['len', '0'],
    ['endcorrection', '0.6'], ['crosscalc', '1'],
  ];
  return [
    ['ProjectInfo', [['Description', ''], ['Creator', ''], ['CreateDate', ''], ['ModifyDate', '']]],
    // [Driver] is spliced here, verbatim.
    ['Box', [
      ['BType', '0'],
      // Front chamber (bandpass only). WinISD stores a loss triple per chamber.
      ['Vf', '0'], ['Ff', '0'], ['Qlf', '10'], ['Qaf', '100'], ['Qpf', '100'],
      // Rear (primary) chamber — the populated one for sealed/vented/PR.
      ['Vr', '0'], ['Fr', '0'], ['Qlr', '10'], ['Qar', '100'], ['Qpr', '100'],
      // Centre chamber — unused across every sampled box type.
      ['Vc', '0'], ['Fc', '0'], ['Qlc', '0'], ['Qac', '0'], ['Qpc', '0'],
      // Inter-chamber coupling losses.
      ['Qiclfr', '100'], ['Qiclfc', '0'], ['Qiclcr', '0'],
      // Ambient. `phi` is WinISD's FRACTION — the builder supplies it already converted.
      // `d` (listening distance) and `Angle` stay WinISD's 1 m / 0: OpenISD collects neither.
      ['T', '293.15'], ['p', '101325'], ['phi', '0.3'], ['d', '1'], ['Med', '0'],
      ['Nd', '1'], ['Angle', '0'], ['Isobarik', '0'],
      ['alfaVC', '0.0039'], ['dTVC', '0'],
      ['Sdfport', '0'], ['Sdrport', '0'],
    ]],
    ['VentFront', vent], ['VentRear', vent], ['VentIntra', vent],
    ['PlotSettings', [['Color', '16711680'], ['Width', '1']]], // Win32 COLORREF; default pure blue
    ['SignalSource', [['Rg', '0.1'], ['P', '0']]],
    ['Filters', [['Count', '0']]],
    // Body only when a radiator is supplied; otherwise the bare section header.
    ['PassiveRadiator', [['Vas', null], ['Qms', null], ['Fs', null], ['Sd', null], ['Xmax', null], ['Me', null]]],
    ['SimulatorOptions', [['VCInd', '0'], ['FlatResponse', '0'], ['TLPorts', '0']]],
  ];
})();

export class WinISDProject {
  /** The `[Driver]` block, verbatim — its own `.wdr` text, readable by `WinISDDriver`. */
  readonly #driverSection: string;
  /** section name (no brackets) → key → value, as supplied or as read. Nothing dropped. */
  readonly #sections: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Set when this instance was read from a file: `toWpr()` then returns the file unchanged. */
  readonly #sourceText: string | null;

  private constructor(
    driverSection: string,
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    sourceText: string | null,
  ) {
    this.#driverSection = driverSection;
    this.#sections = sections;
    this.#sourceText = sourceText;
  }

  /** Build a file from values the caller has already computed, keyed by the file's own
   *  section and key names. Everything not supplied takes WinISD's own default. */
  static build(
    driverSection: string,
    values: Readonly<Record<string, Readonly<Record<string, string | number>>>>,
  ): WinISDProject {
    const sections = new Map<string, Map<string, string>>();
    for (const [sec, kv] of Object.entries(values)) {
      const m = new Map<string, string>();
      for (const [k, v] of Object.entries(kv)) m.set(k, String(v));
      sections.set(sec, m);
    }
    return new WinISDProject(driverSection, sections, null);
  }

  /** Read a file WinISD (or we) wrote earlier. Every key of every section is kept. */
  static fromWprIni(text: string): WinISDProject {
    const sections = new Map<string, Map<string, string>>();
    const driverLines: string[] = [];
    let current: Map<string, string> | null = null;
    let inDriver = false;

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const name = trimmed.slice(1, -1).trim();
        inDriver = name === 'Driver';
        if (inDriver) { driverLines.push(trimmed); current = null; continue; }
        current = new Map<string, string>();
        sections.set(name, current);
        continue;
      }
      if (inDriver) { driverLines.push(line); continue; }
      if (current) {
        const i = line.indexOf('=');
        if (i !== -1) current.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
      }
    }
    return new WinISDProject(driverLines.join('\r\n'), sections, text);
  }

  /** The `[Driver]` block as its own `.wdr` text; `''` when the file carried none. */
  driverWdrText(): string { return this.#driverSection; }

  /** One value, as the file states it. `undefined` when the section or key is absent. */
  value(section: string, key: string): string | undefined {
    return this.#sections.get(section)?.get(key);
  }

  /** One numeric value. `undefined` when absent, empty, or not a number — never fabricated. */
  number(section: string, key: string): number | undefined {
    const raw = this.value(section, key);
    if (raw == null || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  /** The file as text. An instance read from a file returns that file unchanged; a built one
   *  renders the template with its supplied values. CRLF throughout, trailing CRLF. */
  toWpr(): string {
    if (this.#sourceText != null) return this.#sourceText;

    const rendered: string[] = [];
    for (const [name, keys] of TEMPLATE) {
      const supplied = this.#sections.get(name);
      const lines: string[] = [`[${name}]`];
      const written = new Set<string>();
      for (const [key, def] of keys) {
        const v = supplied?.get(key) ?? def;
        if (v == null) continue; // omit-unless-supplied key, not supplied
        lines.push(`${key}=${v}`);
        written.add(key);
      }
      if (supplied) {
        for (const [key, v] of supplied) {
          if (!written.has(key)) lines.push(`${key}=${v}`);
        }
      }
      rendered.push(lines.join('\n'));
      if (name === 'ProjectInfo') {
        rendered.push(this.#driverSection.replace(/\r\n/g, '\n').replace(/\n+$/, ''));
      }
    }
    return rendered.join('\n\n').replace(/\n/g, '\r\n') + '\r\n';
  }
}
