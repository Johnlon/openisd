/**
 * The persisted, manual half of the skin switch. The automatic half is `createViewportWatch`
 * (`logic/viewport.ts`) feeding `presentationState.narrowViewport`; `App.vue`'s `activeSkin`
 * combines the two, override winning when present.
 */
import {describe, it, beforeEach} from 'vitest';
import assert from 'node:assert/strict';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {cycleTraceColor, traceColor, type PresentationState} from '../../src/logic/presentationState.js';

let presentationState: PresentationState;

beforeEach(() => {
  const fixture = createAppStateFixture();
  presentationState = fixture.presentation;
});

describe('setSkinOverride', () => {
  it('has no override by default', () => {
    assert.equal(presentationState.ui.skinOverride, undefined);
  });

  it('sets an explicit override', () => {
    presentationState.setSkinOverride('mobile');
    assert.equal(presentationState.ui.skinOverride, 'mobile');
    presentationState.setSkinOverride('original');
    assert.equal(presentationState.ui.skinOverride, 'original');
  });

  it('null clears the override back to absent, not to a stored null', () => {
    presentationState.setSkinOverride('mobile');
    presentationState.setSkinOverride(null);
    assert.equal(presentationState.ui.skinOverride, undefined);
    assert.equal('skinOverride' in presentationState.ui, false,
      'a cleared override must not round-trip to storage as a literal null');
  });
});

describe('shownSkin', () => {
  it('follows the window width when there is no override', () => {
    presentationState.narrowViewport = false;
    assert.equal(presentationState.shownSkin(), 'original');
    presentationState.narrowViewport = true;
    assert.equal(presentationState.shownSkin(), 'mobile');
  });

  it('is the override when one is set, whatever the window width', () => {
    presentationState.narrowViewport = true;
    presentationState.setSkinOverride('original');
    assert.equal(presentationState.shownSkin(), 'original');
    presentationState.narrowViewport = false;
    presentationState.setSkinOverride('mobile');
    assert.equal(presentationState.shownSkin(), 'mobile');
  });

  it('follows the window width again once the override is cleared', () => {
    presentationState.narrowViewport = true;
    presentationState.setSkinOverride('original');
    presentationState.setSkinOverride(null);
    assert.equal(presentationState.shownSkin(), 'mobile');
  });
});

describe('presentationState.narrowViewport', () => {
  it('defaults to false and is never persisted (it is not part of .ui)', () => {
    assert.equal(presentationState.narrowViewport, false);
  });
});

it('resets every display-unit choice without changing the design', () => {
  presentationState.ui.unitTokens = {BOX_VOLUME_M3: 'ft3', AIR_PRESSURE_PA: 'atm'};
  presentationState.resetUnitTokens();
  assert.deepEqual(presentationState.ui.unitTokens, {});
});

it('uses the palette default before a project receives its own trace colour', () => {
  const project = ProjectBuilder.empty(createEngine());
  assert.equal(traceColor(project), '#c9c92e');
});

it('generates an unused colour when every palette colour is already occupied', () => {
  const colours = ['#c9c92e', '#e34b4b', '#3a7bd5', '#2e8b57', '#c23bc2', '#2ec9c9', '#e08a2e'];
  const projects = colours.map(colour => {
    const project = ProjectBuilder.empty(createEngine());
    project.traceColor.set(colour);
    return project;
  });
  const selected = projects[0]!;
  cycleTraceColor(selected, projects.slice(1));
  assert.equal(colours.includes(selected.traceColor.value ?? ''), false);
});


it('starts charts at 10 Hz to 1 kHz', () => {
  assert.deepEqual(presentationState.sweepRange, {min:10,max:20000});
});
