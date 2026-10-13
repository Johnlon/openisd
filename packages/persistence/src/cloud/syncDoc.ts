import { sha256 } from './sha256.js';

export type DocId =
  | { readonly kind: 'project'; readonly uuid: string }
  | { readonly kind: 'driver'; readonly uuid: string }
  | { readonly kind: 'pr'; readonly uuid: string }
  | { readonly kind: 'settings' }
  | { readonly kind: 'favourites' };

export type DocKind = DocId['kind'];

export class FileId {
  private declare readonly brand: 'FileId';
  private constructor(readonly value: string) {}

  static of(s: string): FileId | null {
    if (s === '') return null;
    return new FileId(s);
  }

  toString(): string {
    return this.value;
  }
}

export class RevisionId {
  private declare readonly brand: 'RevisionId';
  private constructor(readonly value: string) {}

  static of(s: string): RevisionId | null {
    if (s === '') return null;
    return new RevisionId(s);
  }

  toString(): string {
    return this.value;
  }
}

export class ChangeCursor {
  private declare readonly brand: 'ChangeCursor';
  private constructor(readonly value: string) {}

  static of(s: string): ChangeCursor | null {
    return s === '' ? null : new ChangeCursor(s);
  }

  toString(): string {
    return this.value;
  }
}

export class BodyHash {
  private declare readonly brand: 'BodyHash';
  private constructor(readonly value: string) {}

  static of(s: string): BodyHash | null {
    return s === '' ? null : new BodyHash(s);
  }

  toString(): string {
    return this.value;
  }
}

export function field(obj: object, key: string): unknown {
  if (key in obj) {
    return Object.getOwnPropertyDescriptor(obj, key)?.value;
  }
  return undefined;
}

function canonicalValue(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val) ?? 'null';
  }
  if (Array.isArray(val)) {
    return `[${val.map(canonicalValue).join(',')}]`;
  }
  const keys = Object.keys(val).sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${canonicalValue(field(val, k))}`);
  return `{${entries.join(',')}}`;
}

function canonicalize(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return canonicalValue(parsed);
}

export function bodyHashOf(body: string): BodyHash | null {
  const canonical = canonicalize(body);
  if (canonical === null) {
    return null;
  }
  return BodyHash.of(sha256(canonical));
}

export function docFileName(id: DocId): string {
  switch (id.kind) {
    case 'project':
      return `project-${id.uuid}.owpr`;
    case 'driver':
      return `driver-${id.uuid}.json`;
    case 'pr':
      return `pr-${id.uuid}.json`;
    case 'settings':
      return 'settings.json';
    case 'favourites':
      return 'favourites.json';
  }
}

export { sha256 } from './sha256.js';