/**
 * The measurement condition a source prints beside a sensitivity: a reading's `note`.
 *
 * `value` is the driver.json wire string and mirrors winisd_tools' closed vocabulary
 * `record_registries.MeasurementNote` (`scrapers/scrapers/lib/record_registries.py`).
 */
export class MeasurementNote {
  private constructor(readonly value: string) {}

  /** Taken at 2.83 V / 1 m: the 2.83 V sensitivity, USPL. */
  static readonly At283V1m = new MeasurementNote('2.83V/1m');
  /** Taken at 1 W / 1 m: the 1 W sensitivity, SPL. */
  static readonly At1W1m = new MeasurementNote('1W/1m');

  /** Every member. Last in the class body: static fields initialise in source order. */
  static readonly ALL: readonly MeasurementNote[] =
    Object.values(MeasurementNote).filter((v): v is MeasurementNote => v instanceof MeasurementNote);

  /** The member a reading's note names; null for no note, or a note the vocabulary does not hold. */
  static parse(raw: string | undefined): MeasurementNote | null {
    return MeasurementNote.ALL.find(m => m.value === raw) ?? null;
  }

  toString(): string { return this.value; }
}
