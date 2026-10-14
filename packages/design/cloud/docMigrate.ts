import type { DocId } from './syncDoc.js';

function isRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function wrapDoc(
  storeKey: string,
  id: DocId,
  body: string,
  layout: number,
): Readonly<Record<string, string>> {
  switch (id.kind) {
    case 'project': {
      if (layout === 1) {
        return {
          [storeKey]: JSON.stringify({
            version: 1,
            entries: [{ id: id.uuid, text: body, modified: '' }],
          }),
        };
      }
      return {
        [storeKey]: JSON.stringify({
          entries: [{ id: id.uuid, text: body, modified: '' }],
        }),
      };
    }
    case 'driver':
    case 'pr': {
      const record = parseJsonSafe(body) ?? body;
      if (layout === 1) {
        return {
          [storeKey]: JSON.stringify({
            schema: 1,
            entries: [{ uuid: id.uuid, record }],
          }),
        };
      }
      return {
        [storeKey]: JSON.stringify({
          entries: [{ uuid: id.uuid, record }],
        }),
      };
    }
    // A Bin mark is its own whole record; its form has not changed between layouts.
    case 'projectBin':
    case 'settings':
    case 'favourites': {
      return {
        [storeKey]: body,
      };
    }
  }
}

export function unwrapDoc(
  storeKey: string,
  id: DocId,
  data: Readonly<Record<string, string>>,
): string | null {
  const text = data[storeKey];
  if (text === undefined) return null;
  switch (id.kind) {
    case 'project': {
      const parsed = parseJsonSafe(text);
      if (!isRecord(parsed)) return null;
      const entries = Object.getOwnPropertyDescriptor(parsed, 'entries')?.value;
      if (!Array.isArray(entries)) return null;
      for (const entry of entries) {
        if (!isRecord(entry)) continue;
        const entryId = Object.getOwnPropertyDescriptor(entry, 'id')?.value;
        if (entryId === id.uuid) {
          const entryText = Object.getOwnPropertyDescriptor(entry, 'text')?.value;
          return typeof entryText === 'string' ? entryText : null;
        }
      }
      return null;
    }
    case 'driver':
    case 'pr': {
      const parsed = parseJsonSafe(text);
      if (!isRecord(parsed)) return null;
      const entries = Object.getOwnPropertyDescriptor(parsed, 'entries')?.value;
      if (!Array.isArray(entries)) return null;
      for (const entry of entries) {
        if (!isRecord(entry)) continue;
        const entryUuid = Object.getOwnPropertyDescriptor(entry, 'uuid')?.value;
        if (entryUuid === id.uuid) {
          const record = Object.getOwnPropertyDescriptor(entry, 'record')?.value;
          return typeof record === 'string' ? record : JSON.stringify(record);
        }
      }
      return null;
    }
    case 'projectBin':
    case 'settings':
    case 'favourites': {
      return text;
    }
  }
}