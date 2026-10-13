import { formatDateTime } from '../fields/format.js';
import type { DeviceId } from './syncStatus.js';

export function conflictProjectName(name: string, from: DeviceId | string, at_ms: number): string {
  const device = typeof from === 'string' ? from : from.text;
  const time = formatDateTime(new Date(at_ms));
  return `${name} (conflict, ${device}, ${time})`;
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