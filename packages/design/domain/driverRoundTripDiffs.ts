/**
 * The round-trip/diff tools `winIsdDriverConverter.ts` uses to prove its own writers and
 * readers agree with themselves — split out of that file (moves only, `winIsdDriverConverter.ts`
 * keeps the conversion logic itself: `driverYmlToOpenisdAndWdr`, `winIsdDriverToOpenIsdDriver`,
 * `winIsdDriverConverter`).
 *
 * `wdrRecordRoundTripDiffs` and `roundTripProblems` call back into `winIsdDriverConverter`
 * (still declared in `winIsdDriverConverter.ts`), which creates a two-file IMPORT CYCLE between
 * this module and that one. Both crossing symbols are `export function` declarations — hoisted,
 * so each module's export binding exists before either file's top-level body runs — so the cycle
 * is safe at runtime; it is reported here rather than restructured around, per the split's own
 * brief.
 */
import type {WdrHeader} from "../winisd/winisdDriver.js";
import {WinISDDriver} from "../winisd/winisdDriver.js";
import type {Readable} from "./cell.js";
import {OpenISDDriver} from "./driver/openISDDriver.js";
import type {DriverSpec} from "./openisdSchema.js";
import {type DriverError, type Engine} from "../engine/index.js";
import {winISDDriverToOpenISDDeviceJson} from "./winIsdDriverImport.js";
import {winIsdDriverConverter} from "./winIsdDriverConverter.js";

const WDR_HEADER_FIELDS = [
  "brand",
  "model",
  "manufacturer",
  "providedBy",
  "comment",
  "dateAdded",
] as const satisfies ReadonlyArray<keyof WdrHeader>;

/**
 * A `WinISDDriver`'s full comparable state, printed as one deterministic JSON string: the six
 * header fields, then every `.wdr` row's value and mark, in `.rows()`'s own fixed order — so two
 * snapshots of the same record always print byte-identical, and any difference at all is real
 * (John, 2026-09-21: "a driver differ should just diff the deterministic printed json string").
 *
 * `VCCon`/`Xlim` are `WDR_LOGIC.md`'s two documented one-directional exceptions ("VCCon exception
 * — read on presence, not mark"; "Xlim has no key... discards its value on save") — their marks
 * are expected to move on a round trip, not a coding error, so both rows' marks are overwritten
 * unconditionally before printing rather than compared.
 */
function wdrDriverSnapshotJson(d: WinISDDriver): string {
  const header = Object.fromEntries(
    WDR_HEADER_FIELDS.map((field) => [field, d.headerField(field) ?? ""])
  );
  const rows: Record<string, { value: unknown; state: string }> = Object.fromEntries(
    d.rows().map(([key, cell]) => [key, { value: cell.value, state: cell.state }])
  );
  rows.VCCon.state = "value-only";
  rows.Xlim.state = "value-only";
  return JSON.stringify({ header, rows }, null, 2);
}

/**
 * The one difference that matters between two `WinISDDriver`s: their deterministic snapshots
 * disagree. Empty when they match — which is every real round trip's expected outcome (John,
 * 2026-09-02: "we do not expect any issues, issues are a coding error"); the mismatch arm is
 * exercised directly, with two literal snapshots built to differ, not by forcing a real round
 * trip to fail.
 */
export function wdrDriverDiffs(a: WinISDDriver, b: WinISDDriver): string[] {
  const snapshotA = wdrDriverSnapshotJson(a);
  const snapshotB = wdrDriverSnapshotJson(b);
  return snapshotA === snapshotB
    ? []
    : [`snapshot mismatch:\n--- a ---\n${snapshotA}\n--- b ---\n${snapshotB}`];
}

/**
 * Collapses `entered` and `calculated` into one comparable state, `has-value`; `not-available`
 * stays itself. `WDR_LOGIC.md`'s decision tables promote a field between the two labels on
 * almost every leg of the OID <-> `.wdr` round trip (VCCon's presence read, a non-calculable
 * field's derived value written mark E, `c`/`roo`'s air model) — never touching the VALUE, only
 * which of the two provenance labels it carries. An OID snapshot that told the two labels apart
 * would disagree with itself on every real record for a reason `WDR_LOGIC.md` already documents
 * as expected, not a defect.
 */
function comparableOidState(field: Readable<unknown>): string {
  return field.value === null ? "not-available" : "has-value";
}

/**
 * The SAME 48 fields `wdrCells` writes (`winIsdDriverConverter`), in that order, minus
 * `Xlim_m`: `WDR_LOGIC.md`'s "Xlim discards its value on save" means no `.wdr` row ever carries a
 * value for it, so there is nothing for an OID-vs-OID comparison to compare there — the same
 * reason `wdrDriverSnapshotJson` never treats Xlim's mark as a real difference.
 */
function oidComparableCells(
  spec: DriverSpec
): ReadonlyArray<readonly [string, Readable<unknown>]> {
  return [
    ["Qts", spec.Qts],
    ["Znom_ohm", spec.Znom_ohm],
    ["Fs_hz", spec.Fs_hz],
    ["Pe_W", spec.Pe_W],
    ["SPL_dB", spec.SPL_dB],
    ["Re_ohm", spec.Re_ohm],
    ["Le_H", spec.Le_H],
    ["fLe_hz", spec.fLe_hz],
    ["KLe_H_sqrtHz", spec.KLe_H_sqrtHz],
    ["BL_Tm", spec.BL_Tm],
    ["Xmax_m", spec.Xmax_m],
    ["Cms_m_per_N", spec.Cms_m_per_N],
    ["Qms", spec.Qms],
    ["Qes", spec.Qes],
    ["Rms_kg_per_s", spec.Rms_kg_per_s],
    ["Mms_kg", spec.Mms_kg],
    ["Sd_m2", spec.Sd_m2],
    ["Vas_m3", spec.Vas_m3],
    ["Dia_m", spec.Dia_m],
    ["Vd_m3", spec.Vd_m3],
    ["no", spec.no],
    ["Dd_m", spec.Dd_m],
    ["EBP_hz", spec.EBP_hz],
    ["numVC", spec.numVC],
    ["Hc_m", spec.Hc_m],
    ["Hg_m", spec.Hg_m],
    ["SPLmax_dB", spec.SPLmax_dB],
    ["SPLmaxLF_dB", spec.SPLmaxLF_dB],
    ["USPL_dB", spec.USPL_dB],
    ["alfaVC_per_K", spec.alfaVC_per_K],
    ["Rt_K_per_W", spec.Rt_K_per_W],
    ["Ct_J_per_K", spec.Ct_J_per_K],
    ["gamma_m_per_s2_A", spec.gamma_m_per_s2_A],
    ["Rme_kg_per_s", spec.Rme_kg_per_s],
    ["Mpow_N_per_sqrtW", spec.Mpow_N_per_sqrtW],
    ["Mcost_kg_per_s", spec.Mcost_kg_per_s],
    ["Gloss", spec.Gloss],
    ["VCCon", spec.VCCon],
    ["c_m_per_s", spec.c_m_per_s],
    ["roo_kg_per_m3", spec.roo_kg_per_m3],
    ["Thick_m", spec.Thick_m],
    ["Depth_m", spec.Depth_m],
    ["MagDepth_m", spec.MagDepth_m],
    ["Magnet_m", spec.Magnet_m],
    ["Basket_m", spec.Basket_m],
    ["Outer_m", spec.Outer_m],
    ["Vcd_m", spec.Vcd_m],
    ["DVol_m3", spec.DVol_m3],
  ];
}

/**
 * An `OpenISDDriver`'s full comparable state, printed as one deterministic JSON string — the same
 * technique as `wdrDriverSnapshotJson`, one level up: every field `oidComparableCells` lists,
 * each cell's state collapsed by `comparableOidState` so a documented promotion (see there) never
 * reads as a difference.
 */
function oidDriverSnapshotJson(driver: OpenISDDriver): string {
  const spec = driver.specs;
  const rows: Record<string, { value: unknown; state: string }> = Object.fromEntries(
    oidComparableCells(spec).map(([key, cell]) => [
      key,
      { value: cell.value, state: comparableOidState(cell) },
    ])
  );
  return JSON.stringify({ rows }, null, 2);
}

/**
 * The one difference that matters between two `OpenISDDriver`s: their deterministic snapshots
 * disagree. Empty when they match — every real round trip's expected outcome (John, 2026-09-02:
 * "we do not expect any issues, issues are a coding error"); the mismatch arm is exercised
 * directly, with two literal snapshots built to differ, not by forcing a real round trip to
 * fail.
 */
export function oidDriverDiffs(a: OpenISDDriver, b: OpenISDDriver): string[] {
  const snapshotA = oidDriverSnapshotJson(a);
  const snapshotB = oidDriverSnapshotJson(b);
  return snapshotA === snapshotB
    ? []
    : [`snapshot mismatch:\n--- a ---\n${snapshotA}\n--- b ---\n${snapshotB}`];
}

/**
 * One `DriverError` naming `field` with `message` when `a` and `b` are not the same text, none
 * when they are. THE ROUND TRIPS below all reduce to exactly this question ("do the two texts
 * match?"), so the yes/no belongs in ONE small, honestly-tested primitive rather than repeated
 * inline at every call site (John, 2026-09-21: "round tripper logic doesn't need any
 * conditionals... straight thru linear logic"). Its mismatch arm is exercised directly, with two
 * literal strings built to differ — a real round trip is never expected to reach it (John,
 * 2026-09-02: "we do not expect any issues, issues are a coding error").
 */
export function textRoundTripDiff(
  field: string,
  message: string,
  a: string,
  b: string
): DriverError[] {
  return a === b ? [] : [{ level: "error", field, message }];
}


/**
 * openisd.json: text -> record -> text. The record is what a reader gets; the text is what we
 * wrote. If re-serialising the reader's record does not reproduce our text, one of the two is
 * losing something — kept as a live regression check (John, 2026-09-21: "you still need the
 * full RTT") even though nothing in this pipeline is currently known to break it.
 */
export function jsonRoundTripDiffs(openisd: string): DriverError[] {
  try {
    return textRoundTripDiff(
      "json-round-trip",
      "the openisd.json we wrote does not survive being read back and rewritten",
      JSON.stringify(JSON.parse(openisd), null, 2),
      openisd
    );
  } catch (err) {
    return [{
      level: "error",
      field: "json-round-trip",
      message: "the openisd.json we wrote cannot be parsed back: " + String(err),
    }];
  }
}

/** The bundler's round-trip gate: reads back what the converter wrote, with the same engine the
 *  converter used, and reports every difference as a `DriverError`. */
export class DriverRoundTripCheck {
  constructor(private readonly engine: Engine) {}

  /**
   * THE ROUND TRIPS (`drivers.md` Part C step 6). Both texts this function is about to return on
   * are read back and re-written; a difference means our own writer and reader disagree, and the
   * file on disk is then a lossy copy of a record nobody can reconstruct.
   *
   * Reported through `errors`, not thrown: the bridge's contract with its Python caller is
   * never-throws across the V8 boundary, and an exception there is unreadable to it (`openisd_js.py`
   * raises `BridgeFault` and aborts the whole run). A `level:'error'` entry reaches the caller,
   * names the file that failed, and stops that record being written — which is what a coding error
   * on this path deserves. NONE OF THESE IS EXPECTED TO FIRE (John, 2026-09-02: "we do not expect
   * any issues, issues are a coding error").
   */
  roundTripProblems(
    driver1: OpenISDDriver,
    openisd: string,
    wdr: string
  ): DriverError[] {
    const jsonDiffs = jsonRoundTripDiffs(openisd);

    const w2 = WinISDDriver.fromWdrIni(wdr);

    return [
      ...jsonDiffs,
      ...textRoundTripDiff(
        "wdr-round-trip",
        "the .wdr we wrote does not survive being read back and rewritten",
        w2.toWdrIni(),
        wdr
      ),
      ...this.wdrRecordRoundTripDiffs(driver1, w2),
    ];
  }

  /**
   * THE EXTENDED CHAIN (`drivers.md` Part C step 6), all four artefacts (John, 2026-09-22: "oid -
   * wdr - oid - wdr", "4 steps!!!"): `driver1` -> `w2` -> `i3`/`driver3` -> `w3`. `driver1` is the
   * OpenISD driver this whole pipeline built from `driver.yml`; `w2` is the `.wdr` reader's own
   * opinion of what we wrote; `i3`/`driver3` is that opinion projected into a record and then a
   * domain driver; `w3` is what OUR record -> `.wdr` writer makes of `driver3`. If either pair
   * disagrees, two of our own seams disagree about what the SAME record means — a defect the
   * text-only `.wdr` check cannot see, because it stays on one side of the record boundary.
   *
   * Two comparisons, always the SAME representation on each side — comparing an OID to a `.wdr` is
   * not a round trip: `driver1` vs `driver3` (`oidDriverDiffs`) and `w2` vs `w3` (`wdrDriverDiffs`).
   *
   * `oidDriverDiffs` already normalises every documented one-directional promotion `WDR_LOGIC.md`
   * describes (VCCon's presence read, a non-calculable field's derived-value-marked-E write, `c`/
   * `roo`'s air model) — none of them changes a VALUE, only which of `entered`/`calculated` labels
   * it. `Xlim_m`, and every OID field with no `.wdr` row at all, are out of scope for that
   * comparison: nothing in a `.wdr` can carry them, so `driver1` and `driver3` disagreeing there is
   * the format's own limit, not a defect in this code.
   */
  wdrRecordRoundTripDiffs(
    driver1: OpenISDDriver,
    w2: WinISDDriver
  ): DriverError[] {
    const { record: i3 } = winISDDriverToOpenISDDeviceJson(w2);
    const driver3 = OpenISDDriver.fromConformingRecord(i3, this.engine);
    if (Array.isArray(driver3)) {
      return [{
        level: "error",
        field: "wdr-record-round-trip",
        message:
          "the .wdr we wrote reads back as a record the driver seam refuses: " +
          driver3.join("; "),
      }];
    }
    const w3 = winIsdDriverConverter(driver3, []);
    return [
      ...oidDriverDiffs(driver1, driver3),
      ...wdrDriverDiffs(w2, w3),
    ].map((diff) => ({
      level: "error" as const,
      field: "wdr-record-round-trip",
      message: diff,
    }));
  }
}
