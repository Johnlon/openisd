/**
 * UI skins — selectable presentation shells over the same engine, state, and
 * components. Only presentation changes; the physics and store are shared.
 *
 * - `classic` — a recreation of the WinISD 0.7.0.950 desktop window. Manual-only.
 * - `modern`  — today's OpenISD layout (side panel + multi-graph grid + stat bar).
 * - `auto`    — the default; resolves to the responsive shell. Today that is `modern`;
 *   when the modern-plus shell ships, `auto` flips to it. `auto` never picks `classic`.
 *
 * A `SkinId` is what the user chooses and what we persist; a `ShellId` is the concrete
 * component `App.vue` mounts. `SKIN_IDS` lists only skins whose shell exists, so the
 * picker shows no dead options.
 */
export type SkinId = 'auto' | 'classic' | 'modern';
export type ShellId = 'classic' | 'modern';

export const SKIN_IDS: SkinId[] = ['auto', 'classic', 'modern'];

/** Human labels for the skin picker. */
export const SKIN_LABELS: Record<SkinId, string> = {
  auto: 'Auto',
  classic: 'Classic (WinISD)',
  modern: 'Modern',
};

/** Resolve a chosen skin to the shell that renders it. */
export function resolveSkin(skin: SkinId): ShellId {
  return skin === 'classic' ? 'classic' : 'modern';
}
