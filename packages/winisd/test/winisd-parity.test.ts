/**
 * QO8 — side-by-side WinISD vs openisd parity, over mechanically regenerable goldens.
 *
 * Each golden is a project file WinISD ITSELF wrote, byte for byte, committed under
 * `test/fixtures/winisd-parity/goldens/`. Nothing in this file may produce a golden value:
 * a suite whose expectations came from openisd's own output is a tautology that can only
 * ever pass. `test/fixtures/winisd-parity/README.md` gives the WinISD build, the harness
 * commit and the one command that refreshes them.
 *
 * SCOPE — field calculations only. WinISD exposes no way to get a plotted CURVE out as
 * text (README §"Curve data as text"), and reading a chart off a screenshot is not an
 * acceptable golden, so the chart half of QO8 is out of scope until that changes. The
 * engine's own curve regression lives in `packages/engine/test/golden.test.ts`, which is a
 * different guarantee: it proves openisd has not changed, not that it matches WinISD.
 *
 * The openisd side runs through the APP's own path — `Driver.fromWdr()` + `cell()` — not a
 * re-assembly of the formulas here. A test that reimplemented the derivation would prove
 * only that the test agrees with itself.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ebp, airFor, sealedFscWinisd, sourceLoadedQts } from '@openisd/engine';
import { Driver } from '../src/driver.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'winisd-parity');
const goldensDir = join(fixtures, 'goldens');

/**
 * Agreement required of every compared field: 1e-9 relative, with a 1e-12 absolute floor
 * for values at or near zero.
 *
 * WHY THAT NUMBER, from both ends:
 *
 *  - The FLOOR it must clear. WinISD writes each value as ~15 significant decimal digits,
 *    so the file itself costs up to ~1e-15 relative on the round trip, and each program
 *    evaluates its formula in IEEE-754 doubles (eps 2.2e-16) over at most a few dozen
 *    operations — call it 1e-14 relative of accumulated rounding, generously. 1e-9 sits
 *    five orders ABOVE that, so no amount of ordering or associativity difference between
 *    two implementations of the same formula can trip it.
 *  - The CEILING it must stay under. The smallest difference that actually matters here is
 *    a different FORMULA, and every such difference measured in this codebase is orders of
 *    magnitude bigger: Rme's two candidate routes differ by 3.1e-3 relative on a real
 *    record (engine/src/driver.ts, block 13); WinISD's frozen air versus physically derived
 *    air is 0.077 dB of SPL, 8.6e-4 relative; the 6-significant-figure truncation in
 *    `constants.ts` is 1.8e-6 relative. 1e-9 is three orders below the SMALLEST of those.
 *
 * So the band between "float noise" and "a real difference" is about five orders wide, and
 * 1e-9 sits in the middle of it. A looser tolerance would hide the constant truncation; a
 * tighter one would start reporting decimal round-trip as a defect.
 */
const REL_TOL = 1e-9;
const ABS_TOL = 1e-12;

interface Scenario {
  id: string;
  purpose: string;
  driver: Record<string, number | string>;
  box: Record<string, number>;
  environment: { T: number; p: number; phi: number };
  signal: { Rg: number; P: number };
}

/** One field openisd is known to compute differently from WinISD, on purpose or pending a fix. */
interface KnownDivergence {
  scenario: string;
  field: string;
  /** WinISD's value, from the golden — repeated here so a stale entry is visible. */
  winisd: number | string;
  /** openisd's value at the time the entry was written. */
  openisd: number | string;
  /** Why they differ. A divergence with no mechanism named is an unexplained failure, not a known one. */
  cause: string;
  /** Where the decision or the open question lives. */
  reference: string;
}

const scenarios: Scenario[] =
  JSON.parse(readFileSync(join(fixtures, 'scenarios.json'), 'utf8')).scenarios;
const divergences: KnownDivergence[] =
  JSON.parse(readFileSync(join(fixtures, 'divergences.json'), 'utf8')).divergences;

/** Parse a WinISD `.wpr`/`.wdr`: flat INI, `[Section]` headers, `key=value`, no comments. */
function parseIni(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('[')) { section = line.slice(1, -1); out[section] ??= {}; continue; }
    const i = line.indexOf('=');
    if (i < 0) continue;
    (out[section] ??= {})[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

/** Render a scenario's ENTERED driver fields as `.wdr` text — the same keys the generator wrote. */
function scenarioWdr(s: Scenario): string {
  const lines = ['[Driver]'];
  for (const [k, v] of Object.entries(s.driver)) lines.push(`${k}=${v}`);
  return lines.join('\r\n') + '\r\n';
}

/**
 * WinISD `[Driver]` key → the Driver class's own field name. Only where they differ; every
 * other key is compared under the same name. `Gloss` is `loss`, `Dd` is `Dia`, `BL` is `Bl`
 * — the class's names, not new ones invented here.
 */
const FIELD_ALIASES: Readonly<Record<string, string>> = { BL: 'Bl', Dd: 'Dia', Gloss: 'loss' };

/**
 * The `[Driver]` keys compared on every scenario: the T/S consistency group, the geometry
 * WinISD derives from it, and the whole Advanced-parameters pane. `EBP` is handled
 * separately (the Driver class does not carry it; `ebp()` in the engine does).
 */
const DRIVER_FIELDS = [
  'Fs', 'Qts', 'Qes', 'Qms', 'Cms', 'Mms', 'Rms', 'BL', 'Sd', 'Vas',
  'Dd', 'Vd', 'no', 'SPL', 'USPL', 'SPLmax', 'SPLmaxLF',
  'gamma', 'Rme', 'Mpow', 'Mcost', 'Gloss', 'c', 'roo',
] as const;

function findDivergence(scenario: string, field: string): KnownDivergence | undefined {
  return divergences.find(d => d.scenario === scenario && d.field === field);
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(ABS_TOL, REL_TOL * Math.max(Math.abs(a), Math.abs(b)));
}

function report(field: string, winisd: number, openisd: number): string {
  const rel = winisd === 0 ? NaN : Math.abs(openisd - winisd) / Math.abs(winisd);
  return `${field}: WinISD ${winisd} vs openisd ${openisd} (relative ${rel.toExponential(3)})`;
}

describe('WinISD parity — field calculations against goldens WinISD itself wrote', () => {
  it('every scenario has a golden, and every golden names the scenario it came from', () => {
    const missing = scenarios.filter(s => !existsSync(join(goldensDir, `${s.id}.wpr`)));
    assert.equal(missing.length, 0,
      `no WinISD golden for ${missing.map(s => s.id).join(', ')} — regenerate with the command in ` +
      'test/fixtures/winisd-parity/README.md. A missing golden is a missing measurement, never a skip.');
  });

  it('the recorded provenance names the WinISD build and the harness commit that produced the goldens', () => {
    const p = JSON.parse(readFileSync(join(fixtures, 'provenance.json'), 'utf8'));
    assert.ok(p.winisdVersion, 'provenance.json does not say which WinISD produced these goldens');
    assert.ok(p.harnessCommit, 'provenance.json does not say which harness commit produced these goldens');
    assert.ok(p.winisdExeSha256, 'provenance.json does not fingerprint the winisd.exe that ran');
    assert.equal(p.scenarios.length, scenarios.length,
      'provenance.json does not cover every scenario — some goldens are from a different run than others');
  });

  it('every known divergence still names a scenario and a field that exist', () => {
    for (const d of divergences) {
      assert.ok(scenarios.some(s => s.id === d.scenario), `divergence names unknown scenario ${d.scenario}`);
      assert.ok(d.cause.length > 20, `divergence ${d.scenario}/${d.field} states no mechanism`);
      assert.ok(d.reference.length > 0, `divergence ${d.scenario}/${d.field} cites nothing`);
    }
  });

  for (const s of scenarios) {
    describe(s.id, () => {
      const golden = parseIni(readFileSync(join(goldensDir, `${s.id}.wpr`), 'utf8'));
      const drv = Driver.fromWdr(scenarioWdr(s));

      it('WinISD accepted the scenario and wrote a driver block back', () => {
        assert.ok(golden.Driver, `${s.id}: the golden has no [Driver] section`);
        assert.ok(golden.Box, `${s.id}: the golden has no [Box] section`);
      });

      for (const key of DRIVER_FIELDS) {
        it(`${key}`, () => {
          const raw = golden.Driver?.[key];
          assert.ok(raw != null, `${s.id}: WinISD wrote no ${key} — the golden cannot answer for it`);
          const winisd = parseFloat(raw);
          const cell = drv.cell(FIELD_ALIASES[key] ?? key);
          const known = findDivergence(s.id, key);

          if (cell.value == null || !Number.isFinite(cell.value)) {
            // openisd leaves a field ABSENT where it has no route to it. That is a real
            // answer, not a number, so it is only acceptable when recorded as such.
            assert.ok(known, `${s.id}: openisd produced no ${key} at all, but WinISD wrote ${winisd}. ` +
              'Either openisd is missing a route or this belongs in divergences.json with its cause.');
            return;
          }
          const openisd = cell.value;

          if (known) {
            assert.ok(!close(winisd, openisd),
              `${s.id}: ${key} is recorded in divergences.json as differing (${known.cause}), but the two ` +
              `now AGREE (${openisd}). The entry is stale — delete it, do not loosen the test.`);
            return;
          }
          assert.ok(close(winisd, openisd), `${s.id}: ${report(key, winisd, openisd)}`);
        });
      }

      it('EBP', () => {
        const raw = golden.Driver?.EBP;
        assert.ok(raw != null, `${s.id}: WinISD wrote no EBP`);
        const winisd = parseFloat(raw);
        const fs = drv.cell('Fs').value, qes = drv.cell('Qes').value;
        assert.ok(fs != null && qes != null, `${s.id}: openisd has no Fs/Qes to form EBP from`);
        const openisd = ebp({ Fs: fs, Qes: qes });
        const known = findDivergence(s.id, 'EBP');
        if (known) {
          assert.ok(!close(winisd, openisd), `${s.id}: EBP divergence entry is stale — the two now agree`);
          return;
        }
        assert.ok(close(winisd, openisd), `${s.id}: ${report('EBP', winisd, openisd)}`);
      });

      it('air — openisd in WinISD-compatibility mode against the pair WinISD stored', () => {
        // QO7: the parity suite runs with "Ignore humidity and air pressure (as WinISD does)"
        // ON. With it OFF, openisd derives rho and c from T/RH/p — physically right, and a
        // permanent ~0.07 dB divergence that would teach everyone to ignore this suite.
        const air = airFor({
          tempK: s.environment.T,
          humidityPct: s.environment.phi * 100,   // WinISD stores phi as a FRACTION
          pressurePa: s.environment.p,
          ignoreHumidityAndPressure: true,
        });
        for (const [key, got] of [['c', air.c], ['roo', air.rho]] as const) {
          const winisd = parseFloat(golden.Driver[key]);
          const known = findDivergence(s.id, `air.${key}`);
          if (known) {
            assert.ok(!close(winisd, got), `${s.id}: air.${key} divergence entry is stale`);
            continue;
          }
          assert.ok(close(winisd, got), `${s.id}: ${report(`air.${key}`, winisd, got)}`);
        }
      });

      if (Number(s.box.BType) === 0) {
        it('Box.Fr — the sealed system resonance Fsc WinISD computed', () => {
          // For BType=0 the Box tab's disabled Fsc edit mirrors into [Box].Fr on Save at ~15
          // significant digits (winisd_research/WINE_HARNESS.md). It is the one box-side
          // calculation WinISD commits to file at full precision.
          const winisd = parseFloat(golden.Box.Fr);
          const fs = drv.cell('Fs').value, vas = drv.cell('Vas').value;
          const qts = drv.cell('Qts').value, qms = drv.cell('Qms').value;
          const qes = drv.cell('Qes').value, re = drv.cell('Re').value;
          assert.ok(fs != null && vas != null && qts != null && re != null,
            `${s.id}: openisd cannot form Fsc — Fs/Vas/Qts/Re missing`);
          const openisd = sealedFscWinisd({
            Fs: fs, Vas: vas, Vb: s.box.Vr, Ql: s.box.Qlr, Qa: s.box.Qar,
            // WinISD's readout is Qts recomputed with Re+Rg, not bare Qts (WINE_HARNESS.md).
            Qts: sourceLoadedQts(qms ?? NaN, qes ?? NaN, re, s.signal.Rg, qts),
          });
          const known = findDivergence(s.id, 'Box.Fr');
          if (known) {
            assert.ok(!close(winisd, openisd), `${s.id}: Box.Fr divergence entry is stale`);
            return;
          }
          assert.ok(close(winisd, openisd), `${s.id}: ${report('Box.Fr', winisd, openisd)}`);
        });
      }

      it('ParState — the per-field E/C/N marks WinISD assigned', () => {
        const winisd = golden.Driver.ParState;
        assert.ok(winisd, `${s.id}: the golden carries no ParState`);
        const openisd = parseIni(drv.toWdr()).Driver.ParState;
        assert.ok(openisd, `${s.id}: openisd produced no ParState`);
        assert.equal(openisd.length, winisd.length,
          `${s.id}: ParState length ${openisd.length} vs WinISD's ${winisd.length}`);
        const mismatches: string[] = [];
        for (let i = 0; i < winisd.length; i++) {
          if (winisd[i] === openisd[i]) continue;
          if (findDivergence(s.id, `ParState[${i}]`)) continue;
          mismatches.push(`slot ${i}: WinISD ${winisd[i]} vs openisd ${openisd[i]}`);
        }
        assert.deepEqual(mismatches, [],
          `${s.id}: ParState differs where no divergence is recorded — ${mismatches.join('; ')}`);
      });
    });
  }
});
