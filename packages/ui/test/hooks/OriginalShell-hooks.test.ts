import { describe, it, expect } from 'vitest';
import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import { Engine } from '@openisd/design/engine';
import { OpenISDProject, OpenISDDriver } from '@openisd/design';
import type { BoxType } from '@openisd/design/engine';
import { readBundle } from '@openisd/persistence';
import bundleJson from '../../src/drivers-bundle.json';
import { createSealedReadouts, airFieldDataQuality, airFieldValueOnBlur } from '../../src/hooks/OriginalShell-hooks.js';

// The Tang Band W5-1138SMF driver record — the driver whose stale readout this suite guards
// (the live-wire probe showed the rendered Fsc frozen at 54.81 while the domain computed
// 61.878 at Vb=6 L).
//
// Loaded from the TRUE source: the very drivers-bundle.json the app ships with, through the
// SAME seams the app opens it through (`readBundle` then `OpenISDDriver.fromConformingRecord`
// in driverRepo.ts). No hand-typed duplicate of the record here — a fixture that copies
// driver data would drift from the real file, and this suite exists to test real data.
const W5_BUNDLE_PATH = 'tang-band/w5-1138smf/openisd.yml';

function w5Driver(engine: Engine): OpenISDDriver {
  const loaded = readBundle(bundleJson);
  if ('problems' in loaded) {
    throw new Error(`drivers-bundle.json is not a usable bundle: ${loaded.problems.join('; ')}`);
  }
  for (const source of loaded.bundle.sources) {
    for (const file of source.files) {
      if (file.path === W5_BUNDLE_PATH) {
        const driver = OpenISDDriver.fromConformingRecord(file.record, engine);
        if (Array.isArray(driver)) {
          throw new Error(`W5 bundle record is not a conforming driver: ${driver.join('; ')}`);
        }
        return driver;
      }
    }
  }
  throw new Error(`W5 record not in drivers-bundle.json: ${W5_BUNDLE_PATH}`);
}

function sealedProjectW5(volume_m3: number): OpenISDProject {
  const engine = new Engine();
  return OpenISDProject.builder(w5Driver(engine), engine).sealed().volume_m3(volume_m3).build();
}

function sealedReadoutHarness(projectValue: OpenISDProject) {
  const project = computed(() => projectValue);
  const selectedBox = ref<BoxType>('sealed') as Ref<BoxType>;
  const projectChanged = ref(0);
  const api = createSealedReadouts({ project, selectedBox, projectChanged });
  return { project, selectedBox, projectChanged, api };
}

describe('createSealedReadouts — the readouts recompute when the project mutation tick fires', () => {
  it('rearResonance stays cached until the mutation tick fires, then reflects the new volume', () => {
    const projectValue = sealedProjectW5(0.006);
    const { projectChanged, api } = sealedReadoutHarness(projectValue);

    const at6L = api.rearResonance.value;
    expect(at6L).not.toBeNull();

    // Mutating the project alone does not invalidate the computed — the app pushes domain
    // mutations through the `changeTicks`-driven `projectChanged` ref. Before the tick fires,
    // the readout is legitimately the cached value:
    projectValue.box.sealed.volume_m3.set(0.02);
    expect(api.rearResonance.value).toBe(at6L);

    // THE BUG THIS GUARDS: `rearResonance` read only `project.value` (an unchanged object), so
    // even after the mutation tick the cached value won. The DOMAIN at 20 L is a different
    // frequency — the readout must become it.
    projectChanged.value++;
    expect(api.rearResonance.value).not.toBe(at6L);
    expect(api.rearResonance.value!).toBeLessThan(at6L!);
  });

  it('rearQtc and boxResonance also track the tick (same stale-free contract)', () => {
    const projectValue = sealedProjectW5(0.006);
    const { projectChanged, api } = sealedReadoutHarness(projectValue);

    const qAt6L = api.rearQtc.value;
    expect(qAt6L).not.toBeNull();
    expect(api.boxResonance.value).toBe(api.rearResonance.value); // sealed: Fh falls back to Fsc

    projectValue.box.sealed.volume_m3.set(0.02);
    projectChanged.value++;
    expect(api.rearQtc.value).not.toBeNull();
    expect(api.rearQtc.value).not.toBe(qAt6L);
    expect(api.boxResonance.value).toBe(api.rearResonance.value);
  });

  it('a PR box reports the PR system tuning, not the sealed resonance', () => {
    const projectValue = sealedProjectW5(0.006);
    const { selectedBox, projectChanged, api } = sealedReadoutHarness(projectValue);
    selectedBox.value = 'box-passive-radiator';
    projectChanged.value++;
    expect(api.rearQtc.value).toBeNull();
    expect(api.prSystemTuning.value).toBeDefined();
  });
});

describe('Advanced air fields', () => {
  it('uses the app value when an empty project field leaves focus', () => {
    expect(airFieldValueOnBlur(null, 111111)).toBe(111111);
    expect(airFieldValueOnBlur(222222, 111111)).toBe(222222);
  });

  it('flags out-of-range values consistently for temperature, humidity, and pressure', () => {
    expect(airFieldDataQuality('temperature', -1)).not.toEqual([]);
    expect(airFieldDataQuality('humidity', 101)).not.toEqual([]);
    expect(airFieldDataQuality('pressure', 999999)).not.toEqual([]);
    expect(airFieldDataQuality('temperature', 293.15)).toEqual([]);
  });
});
