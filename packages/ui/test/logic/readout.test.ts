import {describe, expect, it} from 'vitest';
import {showReadout, type ReadoutBox} from '../../src/ui/readout.js';

/** A readout box that counts how often its content is rebuilt. */
function box(): ReadoutBox & {writes: number} {
  let html = '';
  const shown = {
    writes: 0,
    style: {display: 'none'},
    get innerHTML(): string { return html; },
    set innerHTML(value: string) { html = value; shown.writes += 1; },
  };
  return shown;
}

describe('showReadout', () => {
  it('shows the text and the box', () => {
    const el = box();
    showReadout(el, '<b>100 Hz</b>');
    expect(el.innerHTML).toBe('<b>100 Hz</b>');
    expect(el.style.display).toBe('block');
  });

  it('does not rebuild the readout when a redraw has the same text', () => {
    const el = box();
    showReadout(el, '<b>100 Hz</b> <span style="color:#fff">-3.0 dB</span>');
    showReadout(el, '<b>100 Hz</b> <span style="color:#fff">-3.0 dB</span>');
    expect(el.writes).toBe(1);
  });

  it('rebuilds it when the text changes', () => {
    const el = box();
    showReadout(el, '<b>100 Hz</b>');
    showReadout(el, '<b>200 Hz</b>');
    expect(el.writes).toBe(2);
    expect(el.innerHTML).toBe('<b>200 Hz</b>');
  });

  it('shows the box again after it was hidden, without rebuilding the same text', () => {
    const el = box();
    showReadout(el, '<b>100 Hz</b>');
    el.style.display = 'none';
    showReadout(el, '<b>100 Hz</b>');
    expect(el.style.display).toBe('block');
    expect(el.writes).toBe(1);
  });
});
