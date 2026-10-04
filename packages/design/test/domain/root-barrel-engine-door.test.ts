import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {createEngine as rootCreateEngine} from '../../domain/index.js';

describe('root barrel engine door', () => {
  it('@openisd/design (the root barrel) re-exports createEngine — the same factory the engine door exports', () => {
    // `.` in the design package exports map resolves to `domain/index.ts`, so a consumer that
    // wants to build a project that runs the engine gets ONE import specifier — no need to reach
    // into `@openisd/design/engine` for the factory the domain already takes as a collaborator.
    expect(rootCreateEngine).toBe(createEngine);
    expect(typeof rootCreateEngine).toBe('function');
    expect(rootCreateEngine().simulation.sweep).toBe(createEngine().simulation.sweep);
  });
});
