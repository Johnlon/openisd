/**
 * UI skins — selectable presentation shells over the same engine, state, and
 * components. Only presentation changes; the physics and store are shared.
 *
 * - `original` — the fuller WinISD recreation ported from the `mock/` prototype:
 *   six box types (incl. 6th-order bandpass + ABC), per-type box cut-through
 *   diagrams and dual-chamber layouts. The primary desktop skin. Manual-only.
 * - `modern`   — today's OpenISD layout (side panel + multi-graph grid + stat bar).
 * - `auto`     — the default; resolves to the responsive shell. Today that is `modern`;
 *   when the modern-plus shell ships, `auto` flips to it. `auto` never picks a
 *   desktop-recreation skin (`original`).
 *
 * MOTHBALLED — `classic`: the older WinISD 0.7.0.950 desktop recreation. `original`
 * supersedes it, so Classic is retired from the skin picker and no longer maintained
 * (active work targets Original + Modern only). The shell code and `resolveSkin('classic')`
 * mapping are KEPT so a user who persisted `classic` still renders, and so the code can be
 * un-mothballed by re-adding it to `SKIN_IDS` — but it is not offered to new users and is
 * not in the active test matrix.
 *
 * NOTE — Classic is NOT dead reference code. It is intentionally kept because it may still
 * hold useful implementations worth mining into Original/Modern (layouts, WinISD-fidelity
 * details, control wiring). Do NOT keep it up to date, and do NOT delete it to "tidy up":
 * treat `shells/classic/` as a salvage source — read it for good ideas, port what's useful,
 * but let it drift. See MEMORY: original-supersedes-classic.
 *
 * A `SkinId` is what the user chooses and what we persist; a `ShellId` is the concrete
 * component `App.vue` mounts. `SKIN_IDS` lists only the OFFERED skins, so the picker
 * shows no dead or retired options.
 */
export type SkinId = 'auto' | 'classic' | 'original' | 'modern';
export type ShellId = 'classic' | 'original' | 'modern';

// Classic is intentionally absent — mothballed (see the module comment). It stays in
// SkinId/resolveSkin so a persisted `classic` preference still renders, but the picker
// does not offer it.
export const SKIN_IDS: SkinId[] = ['auto', 'original', 'modern'];

/** Human labels for the skin picker. `classic` keeps a label for the retired-but-persisted case. */
export const SKIN_LABELS: Record<SkinId, string> = {
  auto: 'Auto',
  classic: 'Classic (WinISD, retired)',
  original: 'Original (WinISD)',
  modern: 'Modern',
};

/** Resolve a chosen skin to the shell that renders it. */
export function resolveSkin(skin: SkinId): ShellId {
  if (skin === 'classic') return 'classic';   // mothballed, but a persisted pref still renders
  if (skin === 'original') return 'original';
  return 'modern';
}
