/** Checks the cursor's ordinary phase against the actual value glyph it must expose.
 * Field provenance itself needs independent scenario expectations; this does not infer it. */
export function measureCursorOrdinaryInk(element: Element) {
  if (!(element instanceof HTMLInputElement)) throw new Error('A numeric cursor requires its native input');
  const issues: string[] = [];
  const wrapper = element.closest('.num-input-wrap');
  if (wrapper === null) throw new Error('A numeric cursor requires the complete numeric wrapper');
  const markers = wrapper.querySelectorAll<HTMLElement>('.num-mark-underline');
  if (markers.length !== 1) return {markers: markers.length, issues: ['expected one selected digit']};
  const marker = markers[0];
  if (marker === undefined) throw new Error('Expected the selected digit');
  const animation = marker.getAnimations()[0];
  if (animation === undefined) return {markers: 1, issues: ['missing decided cursor animation']};
  const timing = animation.effect?.getTiming();
  if (timing?.duration !== 1000) issues.push('cursor cycle duration differs from the decided one second');
  if (timing?.iterations !== Infinity) issues.push('cursor must keep blinking while selected');
  animation.pause();
  animation.currentTime = 750;
  const view = element.ownerDocument.defaultView;
  if (view === null) throw new Error('Cursor paint requires a live document');
  const valueStyle = view.getComputedStyle(element);
  const markerStyle = view.getComputedStyle(marker);
  if (valueStyle.opacity !== '1' || !element.checkVisibility({opacityProperty: true, visibilityProperty: true})) issues.push('ordinary value is not fully visible');
  if (markerStyle.color !== 'rgba(0, 0, 0, 0)' && markerStyle.color !== valueStyle.color) issues.push('cursor changes ordinary value ink');
  if (markerStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') issues.push('ordinary cursor phase must reveal the value background');
  if (!/^\d$/.test(marker.textContent ?? '')) issues.push('cursor marks a non-digit');
  if (wrapper.querySelector('.num-mark-overlay')?.textContent !== element.value) issues.push('cursor text differs from the displayed value');
  const canvas = element.ownerDocument.createElement('canvas').getContext('2d');
  if (canvas === null) throw new Error('Cursor geometry requires canvas text measurement');
  canvas.font = valueStyle.font;
  const prefix = wrapper.querySelector('.num-mark-pre')?.textContent ?? '';
  const expectedLeft = element.getBoundingClientRect().left + parseFloat(valueStyle.borderLeftWidth) + parseFloat(valueStyle.paddingLeft) + canvas.measureText(prefix).width - element.scrollLeft;
  if (Math.abs(marker.getBoundingClientRect().left - expectedLeft) > 0.5) issues.push('cursor does not cover the selected value digit');
  return {markers: 1, issues};
}
