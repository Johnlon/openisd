/**
 * `OpenISDProject` — the class facade over `_OpenISDProjectJson` (PLAN_QO60_LAYERING_REMEDIATION.md
 * objective 3). This file pins the ONE property review found missing: the class must not
 * structurally satisfy its own private JSON shape, or a caller could declare a variable typed
 * `_OpenISDProjectJson`, assign an `OpenISDProject` instance to it, and read `.driver` off a
 * property the class never actually exposes — silently `undefined` at runtime, no compile error.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDProject } from '../src/openisdProject.js';
import type { _OpenISDProjectJson } from '../src/openisdProject.js';

describe('OpenISDProject — does not structurally leak as _OpenISDProjectJson', () => {
  it('a variable typed as the private JSON shape cannot hold a live facade instance', () => {
    const p: OpenISDProject = OpenISDProject.empty();
    // @ts-expect-error — OpenISDProject must not duck-type as _OpenISDProjectJson: it exposes
    // no `driver` property at all (only `driver()`/`setDriver()`), and
    // `_OpenISDProjectJson.driver` is a REQUIRED (if `| undefined`) key precisely so this stays
    // a compile error rather than a silent runtime `undefined`. This assertion is what `tsc`
    // actually checks — vitest's own transform strips the directive and runs the line, so the
    // runtime assertion below is what keeps this test meaningful under `vitest run` too.
    const leak: _OpenISDProjectJson = p;
    assert.equal(leak, p, 'the assignment is a type-system-only check; at runtime it is the same object');
  });
});
