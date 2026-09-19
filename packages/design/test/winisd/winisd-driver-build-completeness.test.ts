/**
 * `WinISDDriver` holds the `.wdr` rows as an ORDERED fixed structure and serializes them exactly
 * as supplied — there is no key-list to reorder against and no completeness check, because the
 * structure IS the order and the contents. These tests pin that contract: the rows come out in
 * the order they were given.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {WDR_FILE_ROWS} from './wdrFixture.js';

describe('WinISDDriver — the cells are an ordered fixed structure', () => {
  it('serializes the rows in the order they were supplied, not a reordered key list', () => {
    const cells = WDR_FILE_ROWS.map((key, i) =>
      [key, { value: String(100 + i), state: 'entered' as const }] as const);
    const lines = WinISDDriver.build({}, cells).toWdrIni().split(/\r\n/);
    // The 48 rows follow the header block consecutively, in the supplied order.
    const firstRow = lines.findIndex(l => l.startsWith(`${cells[0][0]}=`));
    assert.ok(firstRow > 0, 'the first row line must be present after the header');
    cells.forEach(([key, cell], i) => {
      assert.equal(lines[firstRow + i], `${key}=${cell.value}`);
    });
  });

  it('succeeds when every one of the 48 keys is supplied', () => {
    const cells = WDR_FILE_ROWS.map((key, i) =>
      [key, { value: String(100 + i), state: 'entered' as const }] as const);
    assert.doesNotThrow(() => WinISDDriver.build({}, cells));
  });
});