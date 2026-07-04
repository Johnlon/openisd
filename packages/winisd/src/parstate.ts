/**
 * WinISD ParState — the fixed 49-slot edit-state table.
 *
 * ParState is always exactly 49 chars mapped to WinISD's internal parameter list, which
 * is NOT the WDR file's key order (e.g. Qts is slot 14 though the WDR writes it first).
 * Positions are probe-confirmed via single-parameter files in drivers/sample/ — see
 * drivers/sample/README.md "Confirmed ParState position map" and scripts/scraper_lib.py.
 *
 * E = the human/source entered the value · C = WinISD computed it · N = not in play.
 */

export const PARSTATE_LEN = 49;

/**
 * Slot → WDR file key (null where the slot has no serialised key: ParState-only slots
 * like Xlim, and the two unidentified always-N slots at 20 and 46).
 */
export const POS_TO_WDRKEY: readonly (string | null)[] = [
  'Znom',   // 0
  'Fs',     // 1
  'Pe',     // 2
  null,     // 3  SPL — computed, not written as a key in the modern format
  'Re',     // 4
  'Le',     // 5
  'fLe',    // 6
  'KLe',    // 7
  'BL',     // 8
  'Xmax',   // 9
  null,     // 10 Xlim — ParState-only, no WDR key
  'Cms',    // 11
  'Qms',    // 12
  'Qes',    // 13
  'Qts',    // 14
  'Rms',    // 15
  'Mms',    // 16
  'Sd',     // 17
  'Vd',     // 18
  'Vas',    // 19
  null,     // 20 unknown — always N
  'Dd',     // 21
  'no',     // 22 η₀
  'numVC',  // 23
  'Hc',     // 24
  'Hg',     // 25
  'SPLmax', // 26
  'SPLmaxLF', // 27
  'USPL',   // 28
  'alfaVC', // 29
  'Rt',     // 30
  'Ct',     // 31
  'gamma',  // 32
  'EBP',    // 33
  'Rme',    // 34
  'Mpow',   // 35
  'Mcost',  // 36
  'Gloss',  // 37
  'Thick',  // 38
  'Depth',  // 39
  'MagDepth', // 40
  'Magnet', // 41
  'Basket', // 42
  'Outer',  // 43
  'Vcd',    // 44
  'DVol',   // 45
  null,     // 46 unknown — always N
  'c',      // 47
  'roo',    // 48
];

/** One field the Driver's E/C/N model owns (enter-able, cell-readable). */
export interface ModeledSlot {
  pos: number;
  /** WDR file key (as written in the .wdr). */
  wdrKey: string;
  /** Internal Driver field name (differs from wdrKey for Znom→Z and BL→Bl). */
  field: string;
}

/**
 * The T/S fields the Driver models directly. Every other ParState slot is either
 * computed by rule (c, roo, gamma…, Vd, Dd, η₀, SPLmax…) or carried passthrough
 * (dimensions, thermal). Only these 15 are read from / written to the model.
 */
export const MODELED_SLOTS: readonly ModeledSlot[] = [
  { pos: 0,  wdrKey: 'Znom', field: 'Z' },
  { pos: 1,  wdrKey: 'Fs',   field: 'Fs' },
  { pos: 2,  wdrKey: 'Pe',   field: 'Pe' },
  { pos: 4,  wdrKey: 'Re',   field: 'Re' },
  { pos: 5,  wdrKey: 'Le',   field: 'Le' },
  { pos: 8,  wdrKey: 'BL',   field: 'Bl' },
  { pos: 9,  wdrKey: 'Xmax', field: 'Xmax' },
  { pos: 11, wdrKey: 'Cms',  field: 'Cms' },
  { pos: 12, wdrKey: 'Qms',  field: 'Qms' },
  { pos: 13, wdrKey: 'Qes',  field: 'Qes' },
  { pos: 14, wdrKey: 'Qts',  field: 'Qts' },
  { pos: 15, wdrKey: 'Rms',  field: 'Rms' },
  { pos: 16, wdrKey: 'Mms',  field: 'Mms' },
  { pos: 17, wdrKey: 'Sd',   field: 'Sd' },
  { pos: 19, wdrKey: 'Vas',  field: 'Vas' },
];

/** WDR key → modeled slot, for overlaying edited values on the carried WDR lines. */
export const MODELED_BY_WDRKEY: Readonly<Record<string, ModeledSlot>> =
  Object.fromEntries(MODELED_SLOTS.map(s => [s.wdrKey, s]));
