/**
 * The generated pydantic driver model (`scripts/schemagen/out/driver_model.py`) is what the Zod
 * master translates to NOW. A master edit without a rerun of `npx tsx scripts/schemagen/main.ts`
 * (which also proves the two agree) fails here. The translation itself is exercised on the
 * constructs the master uses: a refinement body, the role union, the specs dispatch.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'vitest';
import {OUTPUT, generate} from '../../../../scripts/schemagen/main.js';

describe('the generated pydantic driver model', () => {
    const text = generate();

    it('is what the master translates to now (rerun scripts/schemagen/main.ts after a master edit)', () => {
        assert.equal(readFileSync(OUTPUT, 'utf-8'), text);
    });

    it('carries the master\'s refinements as code, not as prose', () => {
        assert.match(text, /if not \(\(self\.read_value is not None\) or \(self\.read_precision is None\)\):\n\s+raise ValueError\("read_precision needs a read_value"\)/);
        assert.match(text, /if not \(len\(set\(roles\)\) == len\(roles\)\):\n\s+raise ValueError\("a role appears twice"\)/);
    });

    it('reads a bare-string role as a one-role list, as the master\'s union does', () => {
        assert.match(text, /role = out\n\s+return \[role\]/);
    });

    it('dispatches specs on the section key present, as the master\'s transform does', () => {
        assert.match(text, /claims_0 = keyed and "woofer" in v\n\s+claims_1 = keyed and "passive-radiator" in v/);
    });
});
