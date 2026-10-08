/**
 * Every vent tuning <-> length pair, and which states it can reach. A pair is two cells that
 * state one fact: entering one side writes it as 'E' and removes the other side's entry in one
 * record write (`pairedField`); the solver fills the other side as calculated 'C' and never
 * overwrites an entered cell (`VentEngine.solve`). Pairs covered: vented box, bandpass4 front,
 * bandpass6 rear and front, ABC rear and front. The ABC intra port has a length and no tuning.
 *
 * A state is written "tuning/length": E entered, C calculated, N no value.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import type {FrequencyGrid} from '../../domain/index.js';
import {at, driverFrom, isRecord, whatIfSpec} from '../fixtures/domainBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 1000, N: 50};

interface Cell {
  readonly value: number | null;
  readonly entered: boolean;
  set(v: number): void;
  clear(): void;
}

interface Port {
  readonly name: string;
  readonly build: () => OpenISDProject;
  readonly tuning: (p: OpenISDProject) => Cell;
  readonly length: (p: OpenISDProject) => Cell;
  readonly volume: (p: OpenISDProject) => Cell;
  /** Where the two entries sit in a saved session's `box` record. */
  readonly tuningPath: readonly string[];
  readonly lengthPath: readonly string[];
}

function newProject(): ProjectBuilder {
  const engine = createEngine();
  const driver = driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: whatIfSpec({Fs_hz: 37, Vas_m3: 0.03, Qes: 0.4, Qms: 7, Re_ohm: 5.6}),
  });
  return new ProjectBuilder(driver, engine);
}

const PORTS: readonly Port[] = [
  {
    name: 'vented',
    build: () => newProject().vented().volume_m3(0.05).tuning_goal_hz(35).build(),
    tuning: (p) => p.box.vented.tuning_goal_hz,
    length: (p) => p.box.vented.vent.length_m,
    volume: (p) => p.box.vented.volume_m3,
    tuningPath: ['vented', 'chamber', 'tuning_goal_hz'],
    lengthPath: ['vented', 'vent', 'length_m'],
  },
  {
    name: 'bandpass4 front',
    build: () => newProject().bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(40).build(),
    tuning: (p) => p.box.bandpass4.chambers.front.tuning_goal_hz,
    length: (p) => p.box.bandpass4.vents.front.length_m,
    volume: (p) => p.box.bandpass4.chambers.front.volume_m3,
    tuningPath: ['bandpass4', 'front', 'tuning_goal_hz'],
    lengthPath: ['bandpass4', 'frontVent', 'length_m'],
  },
  {
    name: 'bandpass6 rear',
    build: () => newProject().bandpass6().rearVolume_m3(0.04).rearTuning_hz(38).frontVolume_m3(0.02).frontTuning_hz(27).build(),
    tuning: (p) => p.box.bandpass6.chambers.rear.tuning_goal_hz,
    length: (p) => p.box.bandpass6.vents.rear.length_m,
    volume: (p) => p.box.bandpass6.chambers.rear.volume_m3,
    tuningPath: ['bandpass6', 'rear', 'tuning_goal_hz'],
    lengthPath: ['bandpass6', 'rearVent', 'length_m'],
  },
  {
    name: 'bandpass6 front',
    build: () => newProject().bandpass6().rearVolume_m3(0.04).rearTuning_hz(38).frontVolume_m3(0.02).frontTuning_hz(27).build(),
    tuning: (p) => p.box.bandpass6.chambers.front.tuning_goal_hz,
    length: (p) => p.box.bandpass6.vents.front.length_m,
    volume: (p) => p.box.bandpass6.chambers.front.volume_m3,
    tuningPath: ['bandpass6', 'front', 'tuning_goal_hz'],
    lengthPath: ['bandpass6', 'frontVent', 'length_m'],
  },
  {
    name: 'abc rear',
    build: () => newProject().abc().rearVolume_m3(0.04).rearTuning_hz(38).frontVolume_m3(0.02).frontTuning_hz(27).build(),
    tuning: (p) => p.box.abc.chambers.rear.tuning_goal_hz,
    length: (p) => p.box.abc.vents.rear.length_m,
    volume: (p) => p.box.abc.chambers.rear.volume_m3,
    tuningPath: ['abc', 'rear', 'tuning_goal_hz'],
    lengthPath: ['abc', 'rearVent', 'length_m'],
  },
  {
    name: 'abc front',
    build: () => newProject().abc().rearVolume_m3(0.04).rearTuning_hz(38).frontVolume_m3(0.02).frontTuning_hz(27).build(),
    tuning: (p) => p.box.abc.chambers.front.tuning_goal_hz,
    length: (p) => p.box.abc.vents.front.length_m,
    volume: (p) => p.box.abc.chambers.front.volume_m3,
    tuningPath: ['abc', 'front', 'tuning_goal_hz'],
    lengthPath: ['abc', 'frontVent', 'length_m'],
  },
];

const letter = (c: Cell): 'E' | 'C' | 'N' => (c.value === null ? 'N' : c.entered ? 'E' : 'C');
const state = (port: Port, p: OpenISDProject): string => `${letter(port.tuning(p))}/${letter(port.length(p))}`;
const isVented = (port: Port): boolean => port.name === 'vented';

function near(a: number | null, b: number | null, what: string): void {
  assert.ok(a !== null && b !== null, `${what}: ${a} vs ${b}`);
  assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)), `${what}: ${a} vs ${b}`);
}

/** Puts a project into tuning-entered, length-calculated. */
function tuningEntered(port: Port, hz: number): OpenISDProject {
  const p = port.build();
  port.tuning(p).set(hz);
  return p;
}

for (const port of PORTS) {
  describe(`${port.name}: typed edits`, () => {
    it('a built project starts with exactly one side entered', () => {
      const p = port.build();
      assert.equal(state(port, p), 'E/C');
    });

    it('entering the tuning gives E/C, and the length it solves is the stored one', () => {
      const p = tuningEntered(port, 41);
      assert.equal(state(port, p), 'E/C');
      const len = port.length(p).value;
      assert.ok(len !== null && len > 0, 'a calculated length exists');
      // Enter that length on a fresh project: the tuning it calculates is the one we typed.
      const q = port.build();
      port.length(q).set(len);
      assert.equal(state(port, q), 'C/E');
      near(port.tuning(q).value, 41, 'tuning from the solved length');
    });

    it('entering the length gives C/E, and the tuning it solves is stored', () => {
      const p = port.build();
      port.length(p).set(0.31);
      assert.equal(state(port, p), 'C/E');
      assert.equal(port.length(p).value, 0.31);
      const fb = port.tuning(p).value;
      assert.ok(fb !== null && fb > 0);
      const q = tuningEntered(port, fb);
      near(port.length(q).value, 0.31, 'length from the solved tuning');
    });

    it('tuning then length: the length wins, the tuning goes back to calculated', () => {
      const p = tuningEntered(port, 41);
      port.length(p).set(0.28);
      assert.equal(state(port, p), 'C/E');
    });

    it('length then tuning: the tuning wins, the length goes back to calculated', () => {
      const p = port.build();
      port.length(p).set(0.28);
      port.tuning(p).set(43);
      assert.equal(state(port, p), 'E/C');
      assert.equal(port.tuning(p).value, 43);
    });
  });

  describe(`${port.name}: clears`, () => {
    it('clearing the entered tuning', () => {
      const p = tuningEntered(port, 41);
      const volumeBefore = port.volume(p).value;
      port.tuning(p).clear();
      if (isVented(port)) {
        // The vented box may not stay blank: it falls back to its starting alignment, which
        // enters a tuning (and overwrites the volume).
        assert.equal(state(port, p), 'E/C');
        assert.notEqual(port.volume(p).value, volumeBefore);
      } else {
        assert.equal(state(port, p), 'N/N');
        blockedWithNamedIssue(p);
      }
    });

    it('clearing the entered length', () => {
      const p = port.build();
      port.length(p).set(0.28);
      port.length(p).clear();
      if (isVented(port)) {
        assert.equal(state(port, p), 'E/C');
      } else {
        assert.equal(state(port, p), 'N/N');
        blockedWithNamedIssue(p);
      }
    });

    it('clearing the calculated side changes nothing: the solver puts it straight back', () => {
      const p = tuningEntered(port, 41);
      const len = port.length(p).value;
      port.length(p).clear();
      assert.equal(state(port, p), 'E/C');
      assert.equal(port.tuning(p).value, 41);
      near(port.length(p).value, len, 'length re-solved');
    });

    it('clearing from N/N again is harmless', () => {
      if (isVented(port)) return; // never reaches N/N
      const p = tuningEntered(port, 41);
      port.tuning(p).clear();
      port.tuning(p).clear();
      port.length(p).clear();
      assert.equal(state(port, p), 'N/N');
    });
  });

  describe(`${port.name}: volume change`, () => {
    const NEW_VOLUME = 0.0617;

    it('E/C: the entered tuning stays, the calculated length moves, a repeat is identical', () => {
      const p = tuningEntered(port, 41);
      const lenBefore = port.length(p).value;
      port.volume(p).set(NEW_VOLUME);
      assert.equal(state(port, p), 'E/C');
      assert.equal(port.tuning(p).value, 41);
      assert.notEqual(port.length(p).value, lenBefore);
      const lenAfter = port.length(p).value;
      port.volume(p).set(NEW_VOLUME);
      assert.equal(state(port, p), 'E/C');
      assert.equal(port.tuning(p).value, 41);
      assert.equal(port.length(p).value, lenAfter, 'no drift on the same volume');
      assert.equal(port.length(p).value, lenAfter, 'a second read agrees');
    });

    it('C/E: the entered length stays, the calculated tuning moves, a repeat is identical', () => {
      const p = port.build();
      port.length(p).set(0.29);
      const fbBefore = port.tuning(p).value;
      port.volume(p).set(NEW_VOLUME);
      assert.equal(state(port, p), 'C/E');
      assert.equal(port.length(p).value, 0.29);
      assert.notEqual(port.tuning(p).value, fbBefore);
      const fbAfter = port.tuning(p).value;
      port.volume(p).set(NEW_VOLUME);
      assert.equal(state(port, p), 'C/E');
      assert.equal(port.length(p).value, 0.29);
      assert.equal(port.tuning(p).value, fbAfter, 'no drift on the same volume');
    });

    it('a volume sweep and back returns the same calculated value', () => {
      const p = tuningEntered(port, 41);
      const v0 = port.volume(p).value;
      assert.ok(v0 !== null);
      const len0 = port.length(p).value;
      port.volume(p).set(NEW_VOLUME);
      port.volume(p).set(v0);
      assert.equal(state(port, p), 'E/C');
      near(port.length(p).value, len0, 'length after a round trip of the volume');
    });

    it('N/N: a volume change invents nothing', () => {
      if (isVented(port)) return; // never reaches N/N
      const p = tuningEntered(port, 41);
      port.tuning(p).clear();
      port.volume(p).set(NEW_VOLUME);
      assert.equal(state(port, p), 'N/N');
      blockedWithNamedIssue(p);
    });
  });

  describe(`${port.name}: .owpr`, () => {
    // Both sides claiming E is a defect, not pinned here: see
    // bugs/BUG_20261008_vent-pair-both-entered-after-owpr-edit.md.
    it('both sides absent: loads without a crash, and keeps what the record says', () => {
      const text = editedText(port.build(), port, {tuning: 'remove', length: 'remove'});
      const p = load(text);
      // Read as written, for the vented box too: its fallback runs only on a user retraction.
      assert.equal(state(port, p), 'N/N');
      // Whatever state it loaded in, the project is still usable: a plan is asked for, not thrown.
      p.sweepPlan(GRID);
    });

    it('only the length present (E): the state survives, the tuning is calculated', () => {
      const p0 = port.build();
      port.length(p0).set(0.27);
      const p = load(p0.toOwprText());
      assert.equal(state(port, p), 'C/E');
      assert.equal(port.length(p).value, 0.27);
      // And the same record with the tuning entry stripped by hand.
      const q = load(editedText(p0, port, {tuning: 'remove', length: 'keep'}));
      assert.equal(state(port, q), 'C/E');
      assert.equal(port.length(q).value, 0.27);
    });

    it('only the tuning present (E): the state survives, the length is calculated', () => {
      const p0 = tuningEntered(port, 44);
      const q = load(editedText(p0, port, {tuning: 'keep', length: 'remove'}));
      assert.equal(state(port, q), 'E/C');
      assert.equal(port.tuning(q).value, 44);
    });
  });
}

describe('ABC intra port', () => {
  function abc(): OpenISDProject {
    return newProject().abc().rearVolume_m3(0.04).rearTuning_hz(38).frontVolume_m3(0.02).frontTuning_hz(27).build();
  }

  it('has a length and no tuning to pair with', () => {
    const intra = abc().box.abc.vents.intra;
    assert.ok(!('tuning_goal_hz' in intra), 'a port with no tuning field');
    assert.equal(intra.length_m.value, 0.05);
  });

  it('the length is stated at build, and stays so', () => {
    const p = abc();
    assert.equal(p.box.abc.vents.intra.length_m.entered, true);
    p.box.abc.vents.intra.length_m.set(0.123);
    assert.equal(p.box.abc.vents.intra.length_m.entered, true);
  });

  it('a volume change on either chamber leaves it untouched', () => {
    const p = abc();
    p.box.abc.vents.intra.length_m.set(0.123);
    p.box.abc.chambers.rear.volume_m3.set(0.0617);
    p.box.abc.chambers.front.volume_m3.set(0.0333);
    p.box.abc.chambers.rear.volume_m3.set(0.0617);
    assert.equal(p.box.abc.vents.intra.length_m.value, 0.123);
    assert.equal(p.box.abc.vents.intra.length_m.entered, true);
  });

  it('survives .owpr save and load as stated', () => {
    const p = abc();
    p.box.abc.vents.intra.length_m.set(0.123);
    const back = load(p.toOwprText());
    assert.equal(back.box.abc.vents.intra.length_m.value, 0.123);
    assert.equal(back.box.abc.vents.intra.length_m.entered, true);
  });
});

function blockedWithNamedIssue(p: OpenISDProject): void {
  const plan = p.sweepPlan(GRID);
  assert.equal(plan.kind, 'blocked');
  if (plan.kind !== 'blocked') return;
  assert.ok(plan.issues.length > 0, 'a blocked plan names at least one issue');
}

function load(text: string): OpenISDProject {
  const p = OpenISDProject.fromOwprText(text, createEngine());
  if (Array.isArray(p)) throw new Error(p.join('; '));
  return p;
}

type EntryEdit = 'keep' | 'remove' | {readonly state: 'E' | 'C'; readonly value: number};

/** The saved text of `p` with the port's two entries edited by hand, in the saved and edited
 *  halves of the session alike. */
function editedText(p: OpenISDProject, port: Port, edit: {tuning: EntryEdit; length: EntryEdit}): string {
  const session: unknown = JSON.parse(p.toOwprText());
  for (const half of ['saved', 'edited']) {
    if (!isRecord(session) || !isRecord(session[half])) continue;
    for (const [path, how] of [[port.tuningPath, edit.tuning], [port.lengthPath, edit.length]] as const) {
      const parent = at(session, half, 'box', ...path.slice(0, -1));
      if (!isRecord(parent)) throw new Error(`no record at ${path.join('.')}`);
      const key = path[path.length - 1] ?? '';
      if (how === 'remove') delete parent[key];
      else if (how !== 'keep') parent[key] = {state: how.state, value: how.value};
    }
  }
  return JSON.stringify(session);
}
