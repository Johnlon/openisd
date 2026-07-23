/**
 * MECHANICAL GATE — no inert user-visible control.
 *
 * Class of faults prevented: a control is rendered, looks live, and is bound to a
 * shell-local `ref` that nothing downstream ever reads — so the user toggles it and
 * nothing happens. Five of WinISD's Advanced-pane checkboxes shipped that way in TWO
 * skins (OriginalShell `advChecks`, ClassicShell `advSimVcInductance` & friends) and
 * survived because nothing could tell a wired checkbox from a decorative one.
 *
 * The contract: every `kind: 'toggle'` field in the registry marked `modeled: true`
 *   1. is bound in the ONE shared component that renders it (AdvancedOptions.vue), to
 *      store state — either `state.P.<id>` or a named store export, and
 *   2. if it binds `state.P.<id>`, that key really exists in the store's parameter
 *      defaults, so it is persisted, share-linked and fingerprinted like every other
 *      design parameter, and
 *   3. is reachable from every skin, because each shell renders that shared component.
 *
 * Adding a modeled toggle without wiring it fails this test. That is the point.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fieldSpecs } from '../src/fields/fieldRegistry.js';

const here = dirname(fileURLToPath(import.meta.url));
const src  = (...p: string[]) => readFileSync(join(here, '..', 'src', ...p), 'utf8');

/** The single component every skin uses for the Advanced-pane toggle column. */
const ADVANCED_OPTIONS = src('components', 'AdvancedOptions.vue');

/**
 * Toggles whose store binding is NOT a `state.P.<id>` key, with the named store export
 * that backs them instead. An entry here is a deliberate decision, not an escape hatch:
 * it must name a real export, and the reason belongs in the field's registry description.
 */
const STORE_BACKED: Record<string, string> = {
  // WinISD's wording for OpenISD's existing circuit-model switch; storing it as a second
  // boolean beside P.circuitModel is exactly how the two would drift apart.
  simVcInductance: 'simVcInductance',
};

/** Every skin shell, and the file that must (directly or via a parent) pull the toggles in. */
const SKIN_SURFACES: Array<{ skin: string; file: string }> = [
  { skin: 'original', file: 'shells/original/OriginalShell.vue' },
  { skin: 'classic',  file: 'shells/classic/ClassicShell.vue' },
  // Modern has no Advanced pane of its own — it composes the shared SidePanel.
  { skin: 'modern',   file: 'components/SidePanel.vue' },
];

const modeledToggles = fieldSpecs.filter(f => f.kind === 'toggle' && f.modeled);

describe('mechanical gate — no inert user-visible control', () => {
  it('every modeled toggle is bound to store state in the shared AdvancedOptions component', () => {
    const unbound = modeledToggles.filter(f => {
      const binding = STORE_BACKED[f.id] ? `v-model="${STORE_BACKED[f.id]}"` : `v-model="state.P.${f.id}"`;
      return !ADVANCED_OPTIONS.includes(binding);
    });
    expect(unbound.map(f => f.id), 'toggles rendered but not bound to store state').toEqual([]);
  });

  it('every store-P-backed toggle is a real key of the store parameter defaults', () => {
    // P_DEFAULTS is the literal that seeds state.P; a toggle missing from it would be
    // undefined at runtime and silently dropped from saves and share links.
    const storeSrc = src('store.ts');
    const defaults = storeSrc.slice(storeSrc.indexOf('const P_DEFAULTS'), storeSrc.indexOf('export const state'));
    const missing = modeledToggles
      .filter(f => !STORE_BACKED[f.id])
      .filter(f => !new RegExp(`\\b${f.id}\\s*:`).test(defaults));
    expect(missing.map(f => f.id), 'toggles absent from P_DEFAULTS').toEqual([]);
  });

  it('every toggle named in STORE_BACKED resolves to a real store export', () => {
    const storeSrc = src('store.ts');
    const missing = Object.values(STORE_BACKED)
      .filter(name => !new RegExp(`export (const|function) ${name}\\b`).test(storeSrc));
    expect(missing, 'STORE_BACKED names that the store does not export').toEqual([]);
  });

  it('every skin reaches the shared toggles — none is left without the Advanced options', () => {
    const missing = SKIN_SURFACES.filter(s => !src(...s.file.split('/')).includes('<AdvancedOptions'));
    expect(missing.map(s => s.skin), 'skins that never render AdvancedOptions').toEqual([]);
  });

  it('no shell keeps a private copy of an Advanced toggle checkbox', () => {
    // A second inline copy would drift from the shared one and could go inert unnoticed —
    // the exact failure this gate exists to prevent. Labels live in AdvancedOptions only.
    const offenders: string[] = [];
    for (const s of SKIN_SURFACES) {
      const text = src(...s.file.split('/'));
      for (const f of modeledToggles)
        if (text.includes(f.label)) offenders.push(`${s.skin}: ${f.id}`);
    }
    expect(offenders, 'shells rendering their own copy of a toggle label').toEqual([]);
  });
});
