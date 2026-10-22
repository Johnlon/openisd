// Groups pictures that show the same change. A pair's change is the union bounding box of all its changed boxes,
// before and after together, with each edge rounded to GRID px: small shifts and a few extra small boxes
// (a row that moved a pixel, a label that moved up a few pixels) do not split a group.
export const GRID = 32;

/** The group key of a pair's boxes {before: [[x,y,w,h]…], after: […]}; null when it has no box. */
export function groupKey(box) {
  if (!box) return null;
  const all = [...box.before, ...box.after];
  if (all.length === 0) return null;
  const left = Math.min(...all.map(([x]) => x));
  const top = Math.min(...all.map(([, y]) => y));
  const right = Math.max(...all.map(([x, , w]) => x + w));
  const bottom = Math.max(...all.map(([, y, , h]) => y + h));
  return [left, top, right, bottom].map(v => Math.round(v / GRID)).join(',');
}

const boxCount = box => box.before.length + box.after.length;

/**
 * Per entry, the index of its group's leader. Entries are {name, box}. A group's leader is its clearest picture:
 * the one with the fewest changed boxes, ties by name. An entry with no box leads its own group.
 */
export function groupLeaders(entries) {
  const byKey = new Map();
  entries.forEach((e, i) => {
    const key = groupKey(e.box);
    if (key === null) return;
    byKey.set(key, [...(byKey.get(key) ?? []), i]);
  });
  const leaders = entries.map((_, i) => i);
  for (const members of byKey.values()) {
    const lead = members.reduce((a, b) => {
      const d = boxCount(entries[a].box) - boxCount(entries[b].box);
      return d !== 0 ? (d < 0 ? a : b) : (entries[a].name <= entries[b].name ? a : b);
    });
    for (const i of members) leaders[i] = lead;
  }
  return leaders;
}
