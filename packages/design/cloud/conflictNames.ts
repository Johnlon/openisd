import { formatDay } from '../fields/format.js';
import type { DeviceName } from './deviceName.js';

/** The name a kept conflict copy is saved under, for a project, driver or passive radiator:
 *  "Sub 12 (conflict, 14 Oct 2026, Android phone)". */
export function conflictCopyName(name: string, from: DeviceName, at_ms: number): string {
  return `${name} (conflict, ${formatDay(new Date(at_ms))}, ${from.text})`;
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

export function setProjectNameInBody(body: string, newName: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return body;
    const entries = Object.entries(parsed);
    const updatedEntries = entries.map(([key, val]) => {
      if (key === 'label') return [key, newName];
      if (key === 'saved' && typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const savedEntries = Object.entries(val).map(([sKey, sVal]) => {
          if (sKey === 'meta' && typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal)) {
            const metaEntries = Object.entries(sVal).map(([mKey, mVal]) => {
              if (mKey === 'name') return [mKey, newName];
              return [mKey, mVal];
            });
            return [sKey, Object.fromEntries(metaEntries)];
          }
          return [sKey, sVal];
        });
        return [key, Object.fromEntries(savedEntries)];
      }
      if (key === 'edited' && typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const editedEntries = Object.entries(val).map(([eKey, eVal]) => {
          if (eKey === 'meta' && typeof eVal === 'object' && eVal !== null && !Array.isArray(eVal)) {
            const metaEntries = Object.entries(eVal).map(([mKey, mVal]) => {
              if (mKey === 'name') return [mKey, newName];
              return [mKey, mVal];
            });
            return [eKey, Object.fromEntries(metaEntries)];
          }
          return [eKey, eVal];
        });
        return [key, Object.fromEntries(editedEntries)];
      }
      return [key, val];
    });
    return JSON.stringify(Object.fromEntries(updatedEntries));
  } catch {
    return body;
  }
}