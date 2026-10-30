import { conflictSuffix } from '../fields/projectRows.js';
import type { DeviceName } from './deviceName.js';

/** The name a kept conflict copy is saved under, for a project, driver or passive radiator:
 *  "Sub 12 (conflict, 14 Oct 2026, Android phone)". */
export function conflictCopyName(name: string, from: DeviceName, at_ms: number): string {
  return `${name}${conflictSuffix(from.text, at_ms)}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A device record's field: bare, or in the `{value}` form a saved record writes. */
function fieldText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value['value'] === 'string') return value['value'];
  return null;
}

/** The model of a saved driver or passive radiator record, or its brand when it has no model;
 *  null when the body names neither. */
export function deviceNameOfBody(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return null;
    const model = fieldText(parsed['model']);
    if (model !== null && model.trim() !== '') return model;
    const brand = fieldText(parsed['brand']);
    return brand !== null && brand.trim() !== '' ? brand : null;
  } catch {
    return null;
  }
}

/** The record with its model set to `model`, in the form the record holds it; the body unchanged
 *  when it is not a record. */
export function setDeviceModelInBody(body: string, model: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return body;
    const held = parsed['model'];
    const next = isRecord(held) ? {...held, value: model} : model;
    return JSON.stringify({...parsed, model: next});
  } catch {
    return body;
  }
}

/** The record with every own entry kept, and the entry under `key` replaced by `replace(value)`
 *  when `key` is present. */
function mapEntry(
  record: Readonly<Record<string, unknown>>,
  key: string,
  replace: (value: unknown) => unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) out[k] = k === key ? replace(v) : v;
  return out;
}

/** `value` with its `meta.name` set to `newName` when it is a record holding a `meta` record. */
function renameMeta(value: unknown, newName: string): unknown {
  if (!isRecord(value)) return value;
  return mapEntry(value, 'meta', meta => (isRecord(meta) ? mapEntry(meta, 'name', () => newName) : meta));
}

export function setProjectNameInBody(body: string, newName: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return body;
    const labelled = mapEntry(parsed, 'label', () => newName);
    const saved = mapEntry(labelled, 'saved', value => renameMeta(value, newName));
    return JSON.stringify(mapEntry(saved, 'edited', value => renameMeta(value, newName)));
  } catch {
    return body;
  }
}
