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

/** E/C/N edit-state of one field, WinISD's own vocabulary — the one declaration both
 *  `driver.ts` (the Driver ADT) and `winisdDriver.ts` (the `.wdr` format layer) share. */
export type CellState = 'E' | 'C' | 'N';

/** Named members for `CellState`, so a call site can write `CellState.Entered` instead of a
 *  bare `'E' as const` cast wearing an enum's clothes without an enum's discoverability or
 *  typo-safety. Not a TS `enum` — a `const` object plays the same role without the numeric-enum
 *  footguns, and every member is already the exact string WinISD's own format uses, so no
 *  translation layer sits between this and the `.wdr` bytes. */
export const CellState = { Entered: 'E', Computed: 'C', Absent: 'N' } as const satisfies Record<string, CellState>;

/**
 * Slot → WDR file key. Exactly ONE slot is null: 10 (`Xlim`), which has a live editor field
 * and a mark but no key in the writer's literal pool — WinISD discards its value on save.
 *
 * Slots 20 (`Dia`) and 46 (`VCCon`) are real keys, recovered from `winisd.exe` rather than
 * from probing: the driver editor's field-registration blocks at `0x449e6e` and the stride
 * 38-46 run over `D+0x188`…`D+0x1C8` bind them to the controls `eddia` and `edConMode`.
 * See `winisd_research/PARSTATE_DECOMPILED.md`.
 *
 * Black-box probing could not reach either, and both look inert for a reason that is NOT that
 * the slot is unused:
 *  - slot 20 is `N` in every WinISD-authored file because nothing COMPUTES `Dia` and its field
 *    is off the default tab, so nobody enters one either;
 *  - **no instruction in `.text` writes slot 46 at all**, so it only ever holds the `N` from a
 *    blank driver's `FillChar` or whatever a loaded file supplied.
 *
 * Which is why a hand-authored `E` in either slot round-trips through WinISD untouched —
 * `drivers/sample/winisd/inconsistency-test-saved.wdr` carries `E` in both and WinISD
 * reproduced them exactly.
 */
export const POS_TO_WDRKEY: readonly (string | null)[] = [
  'Znom',   // 0
  'Fs',     // 1
  'Pe',     // 2
  'SPL',    // 3  written as a key — drivers/sample/winisd/john-all-defaults.wdr emits SPL=0
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
  'Dia',    // 20  editor field `eddia`, value at D+0xE8
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
  'VCCon',  // 46  editor combo `edConMode`, value at D+0x1C8
  'c',      // 47
  'roo',    // 48
];

export const PARSTATE_LEN = POS_TO_WDRKEY.length;

/** One field the Driver's E/C/N model owns (enter-able, cell-readable). */
export interface ModeledSlot {
  pos: number;
  /** WDR file key (as written in the .wdr). */
  wdrKey: string;
  /** Internal Driver field name (differs from wdrKey for Znom→Z and BL→Bl). */
  field: string;
}

/**
 * The T/S fields the Driver models directly — the 15 read from and written to the model.
 * Every `.wdr` key has a home in `_SpecSection` (`wdr-model-coverage.test.ts`); this list is
 * narrower, and says only which ones this slot table exposes.
 */
export const MODELED_SLOTS: readonly ModeledSlot[] = [
  { pos: 0,  wdrKey: 'Znom', field: 'Z' },
  { pos: 1,  wdrKey: 'Fs',   field: 'Fs' },
  { pos: 2,  wdrKey: 'Pe',   field: 'Pe' },
  // Reference sensitivity is STATED, never computed by WinISD: `s-spl.wdr` (SPL=123 typed,
  // everything else 0) marks slot 3 E with every derivable slot N, and all 16 parity goldens
  // echo the scenario's own SPL at slot 3 = E beside an INDEPENDENTLY calculated η₀ at slot
  // 22 = C. Omitting it here let openisd overwrite a datasheet figure with its own number.
  { pos: 3,  wdrKey: 'SPL',  field: 'SPL' },
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

/** WDR key → modeled slot, for overlaying edited values on the file's own WDR lines. */
export const MODELED_BY_WDRKEY: Readonly<Record<string, ModeledSlot>> =
  Object.fromEntries(MODELED_SLOTS.map(s => [s.wdrKey, s]));
