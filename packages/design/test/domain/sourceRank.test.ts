import {describe, expect, it} from 'vitest';
import {sourceRank} from '../../domain/sourceRank.js';

describe('sourceRank (D10) — how authoritative a document role is, lower = more authoritative', () => {
  it('orders the seven named roles manufacturer-datasheet first, manual last', () => {
    const roles = [
      'manual',
      'distributor_listing_page',
      'distributor_product_page',
      'distributor_datasheet',
      'manufacturer_listing_page',
      'manufacturer_product_page',
      'manufacturer_datasheet',
    ];
    const ranked = [...roles].sort((a, b) => sourceRank(a) - sourceRank(b));
    expect(ranked).toEqual([
      'manufacturer_datasheet',
      'manufacturer_product_page',
      'manufacturer_listing_page',
      'distributor_datasheet',
      'distributor_product_page',
      'distributor_listing_page',
      'manual',
    ]);
  });

  it('ranks an unknown role after manual, never silently ahead of a named one', () => {
    expect(sourceRank('openisd')).toBeGreaterThan(sourceRank('manual'));
  });
});
