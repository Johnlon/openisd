/** Expectations are authored outside the DOM; a row never supplies its own expected state. */
export interface ExpectedFieldPart {
  readonly name: string;
  readonly selector: string;
  readonly count: number;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string | null>>;
}
export interface ExpectedFieldOption {
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
}
export interface ExpectedFieldOccurrence {
  readonly key: string;
  readonly owner: string;
  readonly valueSelector: string;
  readonly editorSelector: string;
  readonly ownerAttributes: Readonly<Record<string, string | null>>;
  readonly valueAttributes?: Readonly<Record<string, string | null>>;
  readonly nativeReadOnly: boolean | null;
  readonly nativeChecked: boolean | null;
  readonly disabled: boolean;
  /** Effective displayed labels and enabled states, in their defined order. */
  readonly options: readonly ExpectedFieldOption[] | null;
  readonly parts: readonly ExpectedFieldPart[];
}

/** Browser-side inventory/semantics. Paint, clipping and interaction have separate oracles. */
export function measureFieldInventory(root: Element, expected: readonly ExpectedFieldOccurrence[]) {
  const issues: string[] = [];
  // Opacity/visibility do not remove a ghost from layout or necessarily from keyboard order.
  const hasLayout = (element: Element) => element.getClientRects().length > 0;
  const visible = (element: Element) => {
    const box = element.getBoundingClientRect();
    return element.checkVisibility({visibilityProperty: true, opacityProperty: true}) && box.width > 0 && box.height > 0;
  };
  const disabled = (element: Element) => element.matches(':disabled') || element.closest('[aria-disabled="true"]') !== null;
  const accessible = (element: Element, label: string) => {
    if (element.closest('[inert],[aria-hidden="true"]') !== null) issues.push(label + ': inaccessible through inert or aria-hidden');
  };
  const owners = new Set<Element>();
  const accounted = new Set<Element>();
  const allParts = new Set<Element>();
  const attributes = (element: Element, required: Readonly<Record<string, string | null>>, label: string) => {
    for (const [name, value] of Object.entries(required)) {
      const actual = element.getAttribute(name);
      if (actual !== value) issues.push(`${label} attribute ${name} ${JSON.stringify(actual)}, expected ${JSON.stringify(value)}`);
    }
  };
  if (expected.length === 0) issues.push('expected field inventory is empty');
  for (const field of expected) {
    const matches = [...root.querySelectorAll(field.owner)].filter(hasLayout);
    if (matches.length !== 1) { issues.push(`${field.key}: occurrence count ${matches.length}, expected 1`); continue; }
    const owner = matches[0];
    if (owner === undefined) throw new Error('One expected field owner must be available');
    if (owners.has(owner)) issues.push(`${field.key}: occurrence claimed by multiple expectations`);
    owners.add(owner);
    accessible(owner, field.key);
    attributes(owner, field.ownerAttributes, field.key);
    if (owner.matches(field.valueSelector)) issues.push(`${field.key}: field owner must contain its value and complete control group`);
    const values = [...owner.querySelectorAll(field.valueSelector)];
    if (values.length !== 1) { issues.push(`${field.key}: value control count ${values.length}, expected 1`); continue; }
    const value = values[0];
    if (value === undefined) throw new Error('One expected value control must be available');
    if (accounted.has(value)) issues.push(`${field.key}: value claimed by multiple expectations`);
    accounted.add(value);
    if (!visible(value)) issues.push(`${field.key}: value control is hidden`);
    accessible(value, field.key + ' value');
    if (!value.matches(field.editorSelector)) issues.push(`${field.key}: wrong editor, expected ${field.editorSelector}`);
    attributes(value, field.valueAttributes ?? {}, field.key + ' value');
    if (value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement) {
      if (field.nativeReadOnly === null) issues.push(`${field.key}: scenario must declare native readonly`);
      else if (value.readOnly !== field.nativeReadOnly) issues.push(`${field.key}: native readonly ${value.readOnly}, expected ${field.nativeReadOnly}`);
    } else if (field.nativeReadOnly !== null) issues.push(`${field.key}: native readonly expectation requires an input or textarea`);
    if (value instanceof HTMLInputElement && value.matches('[type="checkbox"],[type="radio"]')) {
      if (field.nativeChecked === null) issues.push(`${field.key}: scenario must declare checked state`);
      else if (value.checked !== field.nativeChecked) issues.push(`${field.key}: checked ${value.checked}, expected ${field.nativeChecked}`);
    } else if (field.nativeChecked !== null) issues.push(`${field.key}: checked expectation requires a checkbox or radio`);
    if (disabled(value) !== field.disabled) issues.push(`${field.key}: disabled ${disabled(value)}, expected ${field.disabled}`);
    if (value instanceof HTMLSelectElement) {
      const options = [...value.options].map(option => ({value: option.value, label: option.label, disabled: option.matches(':disabled')}));
      if (field.options === null || JSON.stringify(options) !== JSON.stringify(field.options)) issues.push(`${field.key}: options differ from scenario`);
    } else if (field.options !== null) issues.push(`${field.key}: options expectation requires a select`);
    const declaredParts = new Set<Element>();
    for (const part of field.parts) {
      const elements = [...(owner.matches(part.selector) ? [owner] : []), ...owner.querySelectorAll(part.selector)];
      if (elements.length !== part.count) issues.push(`${field.key}: ${part.name} count ${elements.length}, expected ${part.count}`);
      for (const element of elements) {
        declaredParts.add(element);
        allParts.add(element);
        const label = field.key + ': ' + part.name;
        if (visible(element) !== part.visible) issues.push(`${label} visibility ${visible(element)}, expected ${part.visible}`);
        if (part.visible) accessible(element, label);
        if (disabled(element) !== part.disabled) issues.push(`${label} disabled ${disabled(element)}, expected ${part.disabled}`);
        if (part.text !== undefined && element.textContent !== part.text) issues.push(`${label} text ${JSON.stringify(element.textContent)}, expected ${JSON.stringify(part.text)}`);
        attributes(element, part.attributes ?? {}, label);
      }
    }
    for (const control of owner.querySelectorAll('input,select,textarea,button,a[href],[role="button"],[role="checkbox"],[role="switch"],[role="slider"],[tabindex]')) {
      if (!accounted.has(control) && !declaredParts.has(control)) issues.push(`${field.key}: unaccounted field control ${control.tagName} ${control.textContent ?? ''}`);
    }
  }
  const nativeControls = [...root.querySelectorAll('input,select,textarea,meter,.mob-readonly,.catalogue-colour-readout,[role="checkbox"],[role="switch"],[role="spinbutton"],[role="textbox"],[role="combobox"],[role="slider"],[contenteditable="true"]')].filter(hasLayout);
  const controls = [...new Set([...nativeControls, ...accounted])].filter(hasLayout);
  if (controls.length === 0) issues.push('no value controls were audited');
  for (const control of controls) {
    if (!accounted.has(control)) issues.push(`unaccounted value control: ${control.tagName} ${control.id || control.getAttribute('aria-label') || control.className}`);
  }
  for (const part of [...root.querySelectorAll('.ui-field-label,.ui-field-unit,.mob-sheet-unit,.winisd-deviation-cue,.ui-field-dq-btn,.num-stepper-btn')].filter(hasLayout)) {
    if (!allParts.has(part)) issues.push(`unaccounted field part: ${part.className}`);
  }
  for (const row of [...root.querySelectorAll('.ui-field,.mob-sheet-cell')].filter(hasLayout)) {
    if (!owners.has(row)) issues.push(`unaccounted field row: ${row.getAttribute('data-field') ?? row.className}`);
  }
  return {expected: expected.length, matched: owners.size, controls: controls.length, accounted: accounted.size, issues};
}
