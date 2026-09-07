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
 * every section, whether or not anything currently consumes it. Stated precisely: no-drop
 * holds for a FILE-READ instance (toWpr returns the file verbatim) and for unknown keys
 * SUPPLIED to build(); the DOMAIN path narrows to what OpenISD models — an export from
 * `OpenISDProject` is a projection of the model, as WinISD itself rewrites files from its own
 * model. Writing lays the file out from the fixed
 * template below: the eleven sections in WinISD's own order, each key's WinISD default filled
 * in unless the builder supplied a value, and supplied keys the template does not list (for
 * example `Npr`, present only for passive radiators) appended at the end of their section.
 *
 * This class does no physics and no unit conversion. The builder speaks the file's own
 * vocabulary (`Vr`, `phi`, `crosscalc`, …) and has already computed every number — the same
 * contract as `WinISDDriver.build()`, where the caller names WDR keys directly.
 *
 * Verified against 15 WinISD Pro-written goldens under
 * packages/design/test/winisd/fixtures/winisd-parity/goldens/ (test/winisdProject.test.ts). The
 * defaults below match WinISD's own, so a produced file round-trips through WinISD unchanged.
 */
import {parseIni, stringifyIni, type Ini} from '../ini/index.js';

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
  readonly #driverSection: string; // FIXME: why is this here?


  /** The Driver INI section name. There is only a single section in a WDR file and this is it.
   *
   * This struct represents the entire
   * [Driver]
   * P1=V1
   * P2=V2
   *
   * contents of the WDR file*/
  readonly #sections: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Set when this instance was read from a file: `toWpr()` then returns the file unchanged. */
  readonly #sourceText: string | null;  // FIXME: why is this here?

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
    // The `[Driver]` block is a whole `.wdr` embedded verbatim — its `Comment=` can carry
    // newlines and exact padding that a key/value parse would flatten. Cut it out by line
    // range (`[Driver]` header to the next `[Section]` header or EOF) and keep it as text;
    // `parseIni` then handles only the plain `key=value` sections around it.
    const lines = text.split(/\r?\n/);
    const driverStart = lines.findIndex(l => l.trim() === '[Driver]');
    const driverLines: string[] = [];
    const rest: string[] = [];
    if (driverStart === -1) {
      rest.push(...lines);
    } else {
      rest.push(...lines.slice(0, driverStart));
      let i = driverStart;
      driverLines.push(lines[i].trim());
      for (i = driverStart + 1; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t.startsWith('[') && t.endsWith(']')) break;
        driverLines.push(lines[i]);
      }
      rest.push(...lines.slice(i));
    }

    // `parseIni` keeps section and key order and every key the file states, known or not.
    // Values come back verbatim; trim to match what `number()`/`value()` have always returned
    // (WinISD writes no padding, so this is a no-op on a real file — it guards a hand-edited one).
    const sections = new Map<string, Map<string, string>>();
    for (const [name, entries] of Object.entries(parseIni(rest.join('\n')))) {
      if (name === '') continue; // a `.wpr` has no section-less keys
      const m = new Map<string, string>();
      for (const [k, v] of Object.entries(entries)) m.set(k, v.trim());
      sections.set(name, m);
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

    // Build the file as an `Ini` map — the eleven sections in WinISD's own order, each key's
    // WinISD default filled unless the builder supplied a value, and any supplied key the
    // template does not list (e.g. `Npr`, present only for passive radiators) appended after
    // the templated keys of its section. Order is the map's own insertion order.
    const ini: Ini = {};
    for (const [name, keys] of TEMPLATE) {
      const supplied = this.#sections.get(name);
      const entries: Record<string, string> = {};
      for (const [key, def] of keys) {
        const v = supplied?.get(key) ?? def;
        if (v == null) continue; // omit-unless-supplied key, not supplied
        entries[key] = v;
      }
      if (supplied) {
        for (const [key, v] of supplied) {
          if (!(key in entries)) entries[key] = v;
        }
      }
      ini[name] = entries;
    }

    // `stringifyIni` lays the sections out with CRLF throughout, a blank line between each and a
    // single trailing CRLF — the exact container shape WinISD writes. The `[Driver]` block is a
    // whole `.wdr` embedded verbatim between `[ProjectInfo]` and `[Box]`; splice it in as text
    // rather than as a section (its `Comment=` may carry newlines a key/value render would break).
    const body = stringifyIni(ini);
    const driver = this.#driverSection.replace(/\r\n/g, '\n').replace(/\n+$/, '').replace(/\n/g, '\r\n');
    return body.replace('\r\n\r\n[Box]\r\n', `\r\n\r\n${driver}\r\n\r\n[Box]\r\n`);
  }
}
