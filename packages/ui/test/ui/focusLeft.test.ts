// @vitest-environment jsdom
/* global document */
import {describe, expect, it} from 'vitest';
import {focusLeft} from '../../src/ui/components/focusLeft.js';

describe('focusLeft', () => {
  const root = document.createElement('div');
  const inside = root.appendChild(document.createElement('button'));
  const outside = document.createElement('button');
  it('is false while focus stays inside the menu', () => { expect(focusLeft(root, inside)).toBe(false); });
  it('is true when focus moves to another control', () => { expect(focusLeft(root, outside)).toBe(true); });
  it('is true when nothing takes focus', () => { expect(focusLeft(root, null)).toBe(true); });
  it('is true with no menu element', () => { expect(focusLeft(null, inside)).toBe(true); });
});
