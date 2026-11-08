/** True when focus has left `root`: the element taking focus is outside it, or nothing takes focus. */
export function focusLeft(root: Node | null, next: EventTarget | null): boolean {
  if (root === null) return true;
  return !(next instanceof Node && root.contains(next));
}
