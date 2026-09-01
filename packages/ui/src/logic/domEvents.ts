/**
 * Reading a value off a DOM event, WITHOUT asserting what fired it.
 *
 * `e.target` is `EventTarget | null`, so every handler that wants `.value` or `.checked` used to
 * write `(e.target as HTMLInputElement)`. That assertion is the handler telling the compiler to
 * stop checking exactly where it cannot know: a bubbled event, a moved listener or a changed
 * template all deliver a different element, and the assertion turns that into `undefined` flowing
 * onward as a value rather than an error at the point it happened.
 *
 * `instanceof` is a REAL check, so these need no cast at all — the compiler narrows because
 * something proved the type.
 *
 * WHEN THE CHECK FAILS the mismatch is REPORTED, never swallowed: it means a handler is wired to
 * an element it was not written for, which is a bug in the template. `console.error` is
 * deliberate — `packages/ui/test/fixtures.js`'s `browserLog` asserts on console errors, so a
 * mis-wired handler FAILS a browser test instead of quietly reading nothing. The fallback exists
 * so a user is not shown a crash for a defect that is ours; the console entry is what makes it
 * impossible to ignore.
 */

/** What actually fired, for a message a reader can act on. */
function describe(target: EventTarget | null): string {
  if (target === null) return 'null';
  if (target instanceof Element) {
    const type = target instanceof HTMLInputElement ? ` type="${target.type}"` : '';
    return `<${target.tagName.toLowerCase()}${type}>`;
  }
  return target.constructor.name;
}

/** The text in the `<input>` that fired, or `''` if something else did. */
export function inputValue(e: Event): string {
  if (e.target instanceof HTMLInputElement) return e.target.value;
  console.error(`inputValue: expected an <input>, got ${describe(e.target)} — handler is mis-wired.`);
  return '';
}

/** Whether the checkbox that fired is ticked, or `false` if something else fired. */
export function inputChecked(e: Event): boolean {
  if (e.target instanceof HTMLInputElement) return e.target.checked;
  console.error(`inputChecked: expected an <input>, got ${describe(e.target)} — handler is mis-wired.`);
  return false;
}

/** The chosen option of the `<select>` that fired, or `''` if something else did. */
export function selectValue(e: Event): string {
  if (e.target instanceof HTMLSelectElement) return e.target.value;
  console.error(`selectValue: expected a <select>, got ${describe(e.target)} — handler is mis-wired.`);
  return '';
}

/**
 * The element the listener is ATTACHED to — `currentTarget`, not `target`, so it is the one the
 * template names rather than whatever descendant the event started on. Null when the event is no
 * longer being dispatched, which is what `currentTarget` answers outside dispatch.
 */
export function listeningElement(e: Event): HTMLElement | null {
  if (e.currentTarget instanceof HTMLElement) return e.currentTarget;
  console.error(`listeningElement: expected an HTMLElement, got ${describe(e.currentTarget)}.`);
  return null;
}

/**
 * The `<input>` that fired, or null when something else did — for a handler that needs the element
 * itself rather than one value off it (to focus it, blur it, read `selectionStart`, …).
 *
 * A caller checks for null and returns; the mismatch is already reported here, so the caller does
 * not have to decide what to say about a bug in its own template.
 */
export function inputFrom(e: Event): HTMLInputElement | null {
  if (e.target instanceof HTMLInputElement) return e.target;
  console.error(`inputFrom: expected an <input>, got ${describe(e.target)} — handler is mis-wired.`);
  return null;
}

/** The `<input>` or `<textarea>` that fired — the two that carry editable text — or null. */
export function editableFrom(e: Event): HTMLInputElement | HTMLTextAreaElement | null {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return e.target;
  console.error(`editableFrom: expected an <input> or <textarea>, got ${describe(e.target)}.`);
  return null;
}

/** The element that fired, or null when the target is not an element at all. */
export function elementFrom(e: Event): HTMLElement | null {
  if (e.target instanceof HTMLElement) return e.target;
  console.error(`elementFrom: expected an HTMLElement, got ${describe(e.target)}.`);
  return null;
}
