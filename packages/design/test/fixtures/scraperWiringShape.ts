/**
 * The scraper's QO914 shape for a VCCon reading (#514): `read_value` is the wiring's name,
 * "series" or "parallel", and there is no `read_precision`. The vendored driver.json fixtures
 * (driver-snapshot/**, corpus/**) are verbatim copies of records written before that change and
 * still hold the retired 1/2 code; a test that sends one through the bridge applies this
 * transform to its text, until the snapshot is regenerated and re-synced. The fixture files are
 * not edited.
 */
import {parse} from 'yaml';

type PlainRecord = Record<string, unknown>;

function isRecord(v: unknown): v is PlainRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One reading with its retired code as the name: 1 → parallel, 2 → series, precision dropped. */
function namedReading(reading: unknown): unknown {
  if (!isRecord(reading) || typeof reading.read_value !== 'number') return reading;
  const {read_precision: _precision, ...rest} = reading;
  void _precision;
  if (reading.read_value === 1) return {...rest, read_value: 'parallel'};
  if (reading.read_value === 2) return {...rest, read_value: 'series'};
  return reading;
}

function namedSection(section: unknown): unknown {
  if (!isRecord(section) || !isRecord(section.VCCon) || !isRecord(section.VCCon.readings)) return section;
  const readings = Object.fromEntries(Object.entries(section.VCCon.readings).map(([role, r]) => [role, namedReading(r)]));
  return {...section, VCCon: {...section.VCCon, readings}};
}

/** `driverText` (driver.json or driver.yml) with every VCCon reading in the QO914 shape, as JSON text. */
export function withNamedWiringReadings(driverText: string): string {
  const record: unknown = parse(driverText);
  if (!isRecord(record) || !isRecord(record.specs)) return driverText;
  const specs = Object.fromEntries(Object.entries(record.specs).map(([key, section]) => [key, namedSection(section)]));
  return JSON.stringify({...record, specs}, null, 2);
}
