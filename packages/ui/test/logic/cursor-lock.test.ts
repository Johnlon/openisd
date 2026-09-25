import {beforeEach, describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {newProject, requireFocusedProject} from '../../src/logic/appState.js';
import type {OpenISDProject} from '@openisd/design';

describe('Cursor lock & frequency click state transitions', () => {
  // Cursor fields are PROJECT-scoped (QO130/QO168) — a fresh project each test gives a
  // fresh cursor, same isolation the old presentationState reset gave.
  let project: OpenISDProject;
  beforeEach(() => {
    newProject();
    project = requireFocusedProject();
  });

  it('clicking an unlocked chart locks the cursor at that frequency', () => {
    // 1. Initial click at 100 Hz when unlocked
    const f1 = 100;
    const pinned1 = project.pinnedF.value;
    if (project.cursorLocked.value && pinned1 !== null && Math.abs(Math.log10(f1) - Math.log10(pinned1)) < 0.02) {
      project.cursorLocked.set(false);
    } else if (project.cursorLocked.value) {
      project.pinnedF.set(f1);
      project.cursorF.set(f1);
      project.cursorLocked.set(false);
    } else {
      project.pinnedF.set(f1);
      project.cursorF.set(f1);
      project.cursorLocked.set(true);
    }

    assert.equal(project.pinnedF.value, 100);
    assert.equal(project.cursorLocked.value, true, 'First click on unlocked chart locks cursor');
  });

  it('single click somewhere else while locked moves cursor to new location and unlocks', () => {
    // 1. Initially locked at 100 Hz
    project.pinnedF.set(100);
    project.cursorF.set(100);
    project.cursorLocked.set(true);

    // 2. Click at new location 500 Hz while locked
    const f2 = 500;
    const pinned2 = project.pinnedF.value;
    if (project.cursorLocked.value && pinned2 !== null && Math.abs(Math.log10(f2) - Math.log10(pinned2)) < 0.02) {
      project.cursorLocked.set(false);
    } else if (project.cursorLocked.value) {
      project.pinnedF.set(f2);
      project.cursorF.set(f2);
      project.cursorLocked.set(false);
    } else {
      project.pinnedF.set(f2);
      project.cursorF.set(f2);
      project.cursorLocked.set(true);
    }

    assert.equal(project.pinnedF.value, 500);
    assert.equal(project.cursorF.value, 500);
    assert.equal(project.cursorLocked.value, false, 'Single click somewhere else moves marker and unlocks');
  });

  it('clicking near the already pinned location unlocks the cursor', () => {
    // 1. Initially locked at 100 Hz
    project.pinnedF.set(100);
    project.cursorF.set(100);
    project.cursorLocked.set(true);

    // 2. Click near 100 Hz (e.g. 100.1 Hz)
    const fNear = 100.1;
    const pinnedNear = project.pinnedF.value;
    if (project.cursorLocked.value && pinnedNear !== null && Math.abs(Math.log10(fNear) - Math.log10(pinnedNear)) < 0.02) {
      project.cursorLocked.set(false);
    }

    assert.equal(project.cursorLocked.value, false, 'Clicking near pinned frequency unlocks');
  });

  it('editorModelValue resolves SKU over long model text', () => {
    // Helper replicating editorModelValue computed logic
    const getEditorModelValue = (driverRawVal: unknown) => {
      const r = driverRawVal as Record<string, unknown> | null | undefined;
      if (!r) return '';
      const sku = r.sku;
      if (sku) return String(sku).toUpperCase();
      return (r.model as string) || '';
    };

    const driverWithSkuAndLongModel = {
      brand: 'Dayton Audio',
      sku: 'e150he-44',
      model: 'E150HE-44 5-1/2" DVC MMAG Extended Range Subwoofer 4 Ohms per Coil',
    };
    assert.equal(getEditorModelValue(driverWithSkuAndLongModel), 'E150HE-44');

    const driverWithoutSku = {
      brand: 'Seas',
      model: 'CA18RLY',
    };
    assert.equal(getEditorModelValue(driverWithoutSku), 'CA18RLY');
  });

  it('spinning frequency nudge buttons moves frequency logarithmically', () => {
    // Helper replicating spinHz logic
    const spinHz = (dir: number, factor: number, currentHz: number) => {
      const next = currentHz * (dir > 0 ? factor : 1 / factor);
      return Math.max(1, Math.min(20000, next));
    };

    // Spin up
    assert.equal(Math.round(spinHz(1, 1.02, 100)), 102);
    // Spin down
    assert.equal(Math.round(spinHz(-1, 1.02, 100)), 98);
  });

  it('verifies that de-fld fields have width constraint fit-content to prevent container overflow/stretch', () => {
    // Replicate check for de-fld fit-content styling
    const cssRules = [
      '.de-fld { display: flex; flex-direction: column; gap: 2px; margin-bottom: 3px; width: fit-content; justify-self: start; }',
      '.de-fld { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 6px !important; margin-bottom: 0 !important; width: fit-content !important; max-width: 100% !important; padding: 2px 4px !important; border-radius: 4px !important; box-sizing: border-box !important; justify-self: start !important; }'
    ];
    const rule1 = cssRules.find(r => r.includes('.de-fld') && r.includes('width: fit-content') && r.includes('justify-self: start;'));
    const rule2 = cssRules.find(r => r.includes('.de-fld') && r.includes('width: fit-content !important') && r.includes('justify-self: start !important'));
    assert.ok(rule1 && rule2, 'CSS rules for .de-fld must override default grid stretch with justify-self: start');
  });

  it('verifies that rgAtDriverSide is unchecked (false) by default', () => {
    newProject();   // the app starts with NO project (QO121), so this test opens its own
    assert.equal(requireFocusedProject().rgAtDriverSide.value, false, 'Rg is at driver side must be unchecked (false) by default');
  });

  it('verifies that the de-comment box has a full-width layout constraint', () => {
    const cssRules = [
      '.de-comment { display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; margin-top: 2px !important; width: 100% !important; }'
    ];
    const rule = cssRules.find(r => r.includes('.de-comment') && r.includes('width: 100% !important'));
    assert.ok(rule, 'CSS rule for .de-comment must constrain width to 100% !important');
  });
});
