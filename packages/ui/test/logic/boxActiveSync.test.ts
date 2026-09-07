/**
 * `OpenISDProject.box` (`@openisd/design`) holds every box type's own fields at once, dormant
 * unless `boxType` names it active — the dormant-data rule expressed in the type itself
 * (`Box` interface header, `packages/design/domain/openisdDomain.ts`). There is no shared `Vb`/`ventD`/
 * `Fb` storage to synchronise between box types, so switching `boxType` cannot clobber another
 * type's fields: each type's fields live in its own named slot on the box record.
 *
 * `applyLoadedProject()` (`appState.ts`) replaces the whole focused project with a freshly
 * loaded `OpenISDProject` — there is no per-field restore to get the ordering of wrong.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { requireFocusedProject, applyLoadedProject, openBlankProject, openProjects } from '../../src/logic/appState.js';
import { OpenISDProject, OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';

function blankDriverRecord(): unknown {
  const bookkeeping = { value: '' };
  return {
    uuid: { value: crypto.randomUUID() },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: '' }, brand: { value: '' }, model: { value: '' },
    sku: { value: '', grounds: [{ origin: 'entered', reading: '' }] },
    driver_type: { value: '' },
    data_sources: bookkeeping,
    authoritative: bookkeeping,
    specs: {},
  };
}

describe('OpenISDProject.box — each box type keeps its own fields independently of which is active', () => {
  it('switching boxType does not clobber the volume left behind in the other box type', () => {
    openBlankProject();
    const p = requireFocusedProject();

    p.box.boxType.set('vented');
    p.box.vented.volume_m3.set(0.041);
    p.box.boxType.set('sealed');
    p.box.sealed.volume_m3.set(0.019);

    assert.equal(p.box.vented.volume_m3.get().value, 0.041,
      'the vented volume typed in before switching away must survive');
    assert.equal(p.box.sealed.volume_m3.get(), 0.019);

    p.box.boxType.set('vented');
    assert.equal(p.box.vented.volume_m3.get().value, 0.041, 'switching back reads the SAME field it read before');

    removeCleanup(p);
  });

  function removeCleanup(_p: unknown): void { /* no registry cleanup needed: openBlankProject leaves the tab open for later tests to reuse the registry state */ }
});

describe('applyLoadedProject — the loaded project replaces the focused one wholesale', () => {
  it('a loaded project\'s active box type and fields both take effect on the focused tab', () => {
    openBlankProject();
    const engine = new Engine();
    const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
    if (Array.isArray(driver)) throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
    const loaded = OpenISDProject.builder(driver, engine).sealed().volume_m3(0.0275).build();

    applyLoadedProject(loaded);

    assert.equal(requireFocusedProject(), loaded, 'the focused tab now IS the loaded project');
    assert.equal(requireFocusedProject().box.boxType.get(), 'sealed');
    assert.equal(requireFocusedProject().box.sealed.volume_m3.get(), 0.0275);
    void openProjects;
  });
});
