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
 * The openisd side runs through the APP's own path — `Driver.fromWdrIni()` + `cell()` — not a
 * re-assembly of the formulas here. A test that reimplemented the derivation would prove
 * only that the test agrees with itself.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ebp, airFor, sealedFscWinisd, sourceLoadedQts } from '@openisd/engine';
import { OpenISDDriver } from '@openisd/model';
import { WinISDDriver } from '../src/winisdDriver.js';
import { POS_TO_WDRKEY } from '../src/parstate.js';

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

/**
 * One field openisd is known to compute differently from WinISD, on purpose or pending a fix.
 *
 * A recorded divergence is not an exemption — it is a BOUND. The field must still differ (or
 * the entry is stale and the test says so) and must not differ by MORE than `maxRelative`, so
 * a known 1.8e-6 constant truncation cannot quietly grow into a 3 % formula error under cover
 * of its own entry.
 */
interface KnownDivergence {
  /** A scenario id, or `*` for a difference that is a property of the code rather than the case. */
  scenario: string;
  field: string;
  /** Largest relative difference this cause can account for. Omitted for non-numeric fields (ParState slots). */
  maxRelative?: number;
  /** Why they differ. A divergence with no mechanism named is an unexplained failure, not a known one. */
  cause: string;
  /** Where the decision or the open question lives. */
  reference: string;
}

const scenarios: Scenario[] =
  JSON.parse(readFileSync(join(fixtures, 'scenarios.json'), 'utf8')).scenarios;
const divergences: KnownDivergence[] =
  JSON.parse(readFileSync(join(fixtures, 'divergences.json'), 'utf8')).divergences;

/**
 * Scenario ids with no golden and none obtainable — confirmed by a bug record documenting an
 * unrecoverable WinISD/Wine crash, not merely "nobody ran the regenerate command yet". Every
 * OTHER missing golden still fails loudly via the guard test below; this list is the one
 * sanctioned exception, and the second guard test keeps it honest if a golden ever does land.
 */
const UNCAPTURABLE: { id: string; reference: string }[] = [
  {
    id: 'solve-from-mms-cms',
    reference: 'bugs/BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md',
  },
];
const uncapturableIds = new Set(UNCAPTURABLE.map(u => u.id));

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
 * A WinISD `[Driver]` key whose value openisd reaches through the SOLVED engine bag rather
 * than through a stated record field. `Vd`, `no`, `USPL`, `SPLmax`, `gamma`, `Rme`, `Mpow`,
 * `Mcost` and `Gloss` have no `_SpecEntry` of their own — nothing in openisd.yml asserts them
 * — so the record cannot answer for them and the derivation must.
 */
const ENGINE_ONLY: Readonly<Record<string, string>> = {
  Dd: 'Dia',
};

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

/**
 * A cell's value when it is a finite NUMBER. `cell()` answers for metadata strings too, and
 * `null` here is a real answer — openisd leaves a field absent where it has no route to it.
 */
function num(drv: OpenISDDriver, field: string): number | null {
  // A field the record can state is read through cell(), so its E/C/N provenance is exercised
  // exactly as the app sees it. Everything else is read from the solved engine bag, which is
  // the only place it exists.
  const cell = drv.cell(field as Parameters<OpenISDDriver['cell']>[0]);
  if (cell.state !== 'N') {
    return typeof cell.value === 'number' && Number.isFinite(cell.value) ? cell.value : null;
  }
  const solved = drv.toDriver() as Record<string, number> | null;
  const v = solved?.[ENGINE_ONLY[field] ?? field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function findDivergence(scenario: string, field: string): KnownDivergence | undefined {
  return divergences.find(d => (d.scenario === scenario || d.scenario === '*') && d.field === field);
}

/**
 * A golden's `[Driver]` block is NOT all WinISD's arithmetic. It also echoes the input back and
 * writes 0 for a key the input omitted, and its own ParState says which is which: `C` is a value
 * WinISD calculated, `E` a value it was given or defaulted to.
 *
 * So a field is one WinISD DECLINED to calculate when its slot reads `E` and the scenario never
 * entered the key — WinISD had no answer and wrote its unset default. `Mcost` is the case:
 * `Rme·(1 + Xmax/min(Hc,Hg))` has no value at `Hc = Hg = 0`, the harness (`lib/wdr.py`
 * `write_wpr`) writes only the keys the scenario names, and every such golden marks slot 36 `E`
 * beside `Mcost=0`. `gap-geometry` is the control: with `Hc = 12 mm, Hg = 6 mm` WinISD marks the
 * slot `C` and writes `13.18359375`, which IS compared, and passes.
 *
 * The slot map is `packages/winisd/src/parstate.ts`, fixed by WinISD's own single-parameter
 * probes in `drivers/sample/winisd/s-*.wdr` and pinned by `wdr-round-trip.test.ts` — not by
 * anything this suite computes.
 */
function winisdDeclined(scenario: Scenario, parState: string | undefined, key: string): boolean {
  if (!parState) return false;
  if (key in scenario.driver) return false;
  const slot = POS_TO_WDRKEY.indexOf(key);
  return slot >= 0 && parState[slot] === 'E';
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(ABS_TOL, REL_TOL * Math.max(Math.abs(a), Math.abs(b)));
}

function relative(winisd: number, openisd: number): number {
  return winisd === 0 ? Math.abs(openisd) : Math.abs(openisd - winisd) / Math.abs(winisd);
}

function report(field: string, winisd: number, openisd: number): string {
  return `${field}: WinISD ${winisd} vs openisd ${openisd} `
       + `(relative ${relative(winisd, openisd).toExponential(3)})`;
}

/**
 * Compare one field. A field with no recorded divergence must AGREE; a field with one must
 * still differ, and by no more than the cause can account for.
 */
function compare(scenarioId: string, field: string, winisd: number, openisd: number): void {
  const known = findDivergence(scenarioId, field);
  if (!known) {
    assert.ok(close(winisd, openisd), `${scenarioId}: ${report(field, winisd, openisd)}`);
    return;
  }
  assert.ok(!close(winisd, openisd),
    `${scenarioId}: ${field} is recorded in divergences.json as differing (${known.cause}), but the ` +
    `two now AGREE (${openisd}). The entry is stale — delete it, do not loosen the test.`);
  assert.ok(known.maxRelative != null,
    `${scenarioId}: the divergence entry for ${field} states no maxRelative, so it bounds nothing`);
  const rel = relative(winisd, openisd);
  assert.ok(rel <= known.maxRelative,
    `${scenarioId}: ${report(field, winisd, openisd)} — recorded cause "${known.cause}" accounts for ` +
    `at most ${known.maxRelative.toExponential(3)}. The difference has GROWN beyond its explanation.`);
}

describe('WinISD parity — field calculations against goldens WinISD itself wrote', () => {
  it('every scenario has a golden, and every golden names the scenario it came from', () => {
    const missing = scenarios
      .filter(s => !uncapturableIds.has(s.id))
      .filter(s => !existsSync(join(goldensDir, `${s.id}.wpr`)));
    assert.equal(missing.length, 0,
      `no WinISD golden for ${missing.map(s => s.id).join(', ')} — regenerate with the command in ` +
      'test/fixtures/winisd-parity/README.md. A missing golden is a missing measurement, never a skip.');
  });

  it('every UNCAPTURABLE entry is still actually missing its golden', () => {
    const stale = UNCAPTURABLE.filter(u => existsSync(join(goldensDir, `${u.id}.wpr`)));
    assert.deepEqual(stale, [],
      `${stale.map(u => u.id).join(', ')} now HAS a golden on disk — remove it from UNCAPTURABLE ` +
      'in this file and let it run as a normal scenario.');
  });

  it('the recorded provenance names the WinISD build and the harness commit that produced the goldens', () => {
    const p = JSON.parse(readFileSync(join(fixtures, 'provenance.json'), 'utf8'));
    assert.ok(p.winisdVersion, 'provenance.json does not say which WinISD produced these goldens');
    assert.ok(p.harnessCommit, 'provenance.json does not say which harness commit produced these goldens');
    assert.ok(p.winisdExeSha256, 'provenance.json does not fingerprint the winisd.exe that ran');
    const capturedCount = scenarios.length - UNCAPTURABLE.length;
    assert.equal(p.scenarios.length, capturedCount,
      `provenance.json names ${p.scenarios.length} scenarios but ${capturedCount} have goldens ` +
      `(${scenarios.length} total minus ${UNCAPTURABLE.length} UNCAPTURABLE) — some goldens are ` +
      'from a different run than others, or UNCAPTURABLE is out of date');
  });

  it('every known divergence still names a scenario and a field that exist', () => {
    for (const d of divergences) {
      assert.ok(d.scenario === '*' || scenarios.some(s => s.id === d.scenario),
        `divergence names unknown scenario ${d.scenario}`);
      assert.ok(d.cause.length > 20, `divergence ${d.scenario}/${d.field} states no mechanism`);
      assert.ok(d.reference.length > 0, `divergence ${d.scenario}/${d.field} cites nothing`);
    }
  });

  for (const s of scenarios) {
    const uncapturable = UNCAPTURABLE.find(u => u.id === s.id);
    if (uncapturable) {
      describe(s.id, () => {
        it(`has no golden and none is obtainable — ${uncapturable.reference}`, () => {
          assert.ok(!existsSync(join(goldensDir, `${s.id}.wpr`)),
            `${s.id} now has a golden on disk — remove it from UNCAPTURABLE, this assertion is stale`);
          assert.ok(existsSync(join(here, '..', '..', '..', uncapturable.reference)),
            `${uncapturable.reference} does not exist — UNCAPTURABLE cites a bug record that is gone`);
        });
      });
      continue;
    }
    describe(s.id, () => {
      // Read lazily: a missing golden must be reported by the guard test above, with the
      // regenerate command, not as a collection crash that hides every other scenario.
      const path = join(goldensDir, `${s.id}.wpr`);
      const golden = existsSync(path)
        ? parseIni(readFileSync(path, 'utf8'))
        : ({} as Record<string, Record<string, string>>);
      const asRead = WinISDDriver.fromWdrIni(scenarioWdr(s));
      const drv = OpenISDDriver.fromWinISDDriver(asRead);

      it('WinISD accepted the scenario and wrote a driver block back', () => {
        assert.ok(golden.Driver, `${s.id}: the golden has no [Driver] section`);
        assert.ok(golden.Box, `${s.id}: the golden has no [Box] section`);
      });

      for (const key of DRIVER_FIELDS) {
        it(`${key}`, () => {
          const raw = golden.Driver?.[key];
          assert.ok(raw != null, `${s.id}: WinISD wrote no ${key} — the golden cannot answer for it`);
          const winisd = parseFloat(raw);
          const openisd = num(drv, key);

          if (openisd === null) {
            // openisd leaves a field ABSENT where it has no route to it. That is a real
            // answer, not a number, so it is only acceptable when WinISD had no route either
            // (its ParState slot says the value was echoed, not calculated) or when the
            // difference is recorded as deliberate.
            if (winisdDeclined(s, golden.Driver?.ParState, key)) return;
            assert.ok(findDivergence(s.id, key),
              `${s.id}: openisd produced no ${key} at all, but WinISD wrote ${winisd}. ` +
              'Either openisd is missing a route or this belongs in divergences.json with its cause.');
            return;
          }
          compare(s.id, key, winisd, openisd);
        });
      }

      it('EBP', () => {
        const raw = golden.Driver?.EBP;
        assert.ok(raw != null, `${s.id}: WinISD wrote no EBP`);
        const winisd = parseFloat(raw);
        const fs = num(drv, 'Fs'), qes = num(drv, 'Qes');
        assert.ok(fs !== null && qes !== null, `${s.id}: openisd has no Fs/Qes to form EBP from`);
        compare(s.id, 'EBP', winisd, ebp({ Fs: fs, Qes: qes }));
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
          compare(s.id, `air.${key}`, parseFloat(golden.Driver[key]), got);
        }
      });

      if (Number(s.box.BType) === 0) {
        it('Box.Fr — the sealed system resonance Fsc WinISD computed', () => {
          // For BType=0 the Box tab's disabled Fsc edit mirrors into [Box].Fr on Save at ~15
          // significant digits (winisd_research/WINE_HARNESS.md). It is the one box-side
          // calculation WinISD commits to file at full precision.
          const winisd = parseFloat(golden.Box.Fr);
          const fs = num(drv, 'Fs'), vas = num(drv, 'Vas');
          const qts = num(drv, 'Qts'), qms = num(drv, 'Qms');
          const qes = num(drv, 'Qes'), re = num(drv, 'Re');
          assert.ok(fs !== null && vas !== null && qts !== null && re !== null,
            `${s.id}: openisd cannot form Fsc — Fs/Vas/Qts/Re missing`);
          const openisd = sealedFscWinisd({
            Fs: fs, Vas: vas, Vb: s.box.Vr, Ql: s.box.Qlr, Qa: s.box.Qar,
            // WinISD's readout is Qts recomputed with Re+Rg, not bare Qts (WINE_HARNESS.md).
            Qts: sourceLoadedQts(qms ?? NaN, qes ?? NaN, re, s.signal.Rg, qts),
          });
          compare(s.id, 'Box.Fr', winisd, openisd);
        });
      }

      it('ParState — the per-field E/C/N marks WinISD assigned', () => {
        const winisd = golden.Driver.ParState;
        assert.ok(winisd, `${s.id}: the golden carries no ParState`);
        const { value: written } = drv.toWinISDDriver();
        assert.ok(written, `${s.id}: openisd could not write a .wdr for this driver`);
        const openisd = parseIni(written.toWdr()).Driver.ParState;
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
