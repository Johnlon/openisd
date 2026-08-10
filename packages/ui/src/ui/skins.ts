/**
 * UI skins — selectable presentation shells over the same engine, state, and
 * components. Only presentation changes; the physics and store are shared.
 *
 * - `classic`  — the older WinISD 0.7.0.950 desktop recreation.
 * - `original` — the fuller WinISD recreation ported from the `mock/` prototype:
 *   six box types (incl. 6th-order bandpass + ABC), per-type box cut-through
 *   diagrams and dual-chamber layouts.
 * - `modern`   — today's OpenISD layout (side panel + multi-graph grid + stat bar).
 * - `auto`     — the default; resolves to the responsive shell (currently `original`).
 */

export type SkinId = 'auto' | 'classic' | 'original' | 'modern';
export type ShellId = 'classic' | 'original' | 'modern';

export const SKIN_IDS: SkinId[] = ['auto', 'classic', 'original', 'modern'];

/** Human labels for the skin picker. */
export const SKIN_LABELS: Record<SkinId, string> = {
  auto: 'Auto',
  classic: 'Classic (WinISD)',
  original: 'Original (WinISD)',
  modern: 'Modern',
};

/** Resolve a chosen skin to the shell that renders it. */
export function resolveSkin(skin: SkinId): ShellId {
  if (skin === 'classic') return 'classic';   // mothballed, but a persisted pref still renders
  if (skin === 'modern') return 'modern';
  return 'original';
}
