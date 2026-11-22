/**
 * Makers whose printed label names a different quantity than the field that carries the same name.
 *
 * OpenISD's EBP is the efficiency-bandwidth product Fs/Qes, calculated from Fs and Qes. Purifi's
 * product pages print an "EBP" that equals Fs/Qts instead: 30 of 30 stored Purifi records that
 * print one are within 1% of Fs/Qts and 0 of 30 within 1% of Fs/Qes
 * (winisd_tools/reports/dq/DQ_purifi_20261115.md; the five pages read, ptt5-25m04-naa-05 first:
 * Fs 39 Hz, Qes 0.25, Qts 0.24 print EBP 162.5 Hz = 39/0.24, against 39/0.25 = 156). FaitalPRO (183
 * of 195) and Eminence (36 of 47) print Fs/Qes.
 *
 * Such a reading is a different quantity, not a worse measurement of this one, so the bridge does not
 * enter it as the field's value (the field is left to be calculated and marked so). The reading stays
 * in driver.json, as printed.
 */
export interface PrintedUnderOtherDefinition {
  /** The maker's name as the record's `manufacturer` states it, compared without regard to case. */
  readonly maker: string;
  readonly field: string;
  /** What the maker's printed figure is. */
  readonly printedAs: string;
}

export const PRINTED_UNDER_OTHER_DEFINITION: readonly PrintedUnderOtherDefinition[] = Object.freeze([
  Object.freeze({maker: 'Purifi', field: 'EBP_hz', printedAs: 'Fs/Qts'}),
]);

/** Whether `maker` prints `field` under a definition other than the field's own. */
export function printsUnderOtherDefinition(maker: string | null, field: string): boolean {
  if (maker === null) return false;
  const name = maker.trim().toLowerCase();
  return PRINTED_UNDER_OTHER_DEFINITION.some(p => p.field === field && p.maker.toLowerCase() === name);
}
