import { describe, it, expect } from 'vitest';
import {
  bodyHashOf,
  docFileName,
  docIdEquals,
  field,
  FileId,
  RevisionId,
  ChangeCursor,
  BodyHash,
  type DocId
} from '../../cloud/syncDoc.js';
import { sha256 } from '../../cloud/sha256.js';

describe('syncDoc', () => {
  describe('bodyHashOf', () => {
    it('same hash for different key orders', () => {
      const body1 = '{"b":2,"a":1}';
      const body2 = '{"a":1,"b":2}';
      expect(bodyHashOf(body1)).toStrictEqual(bodyHashOf(body2));
    });

    it('same hash for different whitespace', () => {
      const body1 = '{"a":1,"b":2}';
      const body2 = '{\n  "a": 1,\n  "b": 2\n}';
      expect(bodyHashOf(body1)).toStrictEqual(bodyHashOf(body2));
    });

    it('different hash for different content', () => {
      const body1 = '{"a":1}';
      const body2 = '{"a":2}';
      expect(bodyHashOf(body1)).not.toStrictEqual(bodyHashOf(body2));
    });

    it('same hash for nested objects with different key orders', () => {
      const body1 = '{"outer":{"c":3,"b":2}}';
      const body2 = '{"outer":{"b":2,"c":3}}';
      expect(bodyHashOf(body1)).toStrictEqual(bodyHashOf(body2));
    });

    it('change in a nested value changes the hash', () => {
      const body1 = '{"outer":{"a":1}}';
      const body2 = '{"outer":{"a":2}}';
      expect(bodyHashOf(body1)).not.toStrictEqual(bodyHashOf(body2));
    });

    it('same hash for arrays with same elements and nested key orders', () => {
      const body1 = '{"arr":[{"b":2,"a":1}]}';
      const body2 = '{"arr":[{"a":1,"b":2}]}';
      expect(bodyHashOf(body1)).toStrictEqual(bodyHashOf(body2));
    });

    it('change inside an array element changes the hash', () => {
      const body1 = '{"arr":[{"x":1}]}';
      const body2 = '{"arr":[{"x":2}]}';
      expect(bodyHashOf(body1)).not.toStrictEqual(bodyHashOf(body2));
    });

    it('array order is preserved and changes the hash', () => {
      const body1 = '{"arr":[1,2]}';
      const body2 = '{"arr":[2,1]}';
      expect(bodyHashOf(body1)).not.toStrictEqual(bodyHashOf(body2));
    });

    it('returns null on non-object or invalid JSON input instead of throwing', () => {
      expect(bodyHashOf('not json')).toBeNull();
      expect(bodyHashOf('123')).toBeNull();
      expect(bodyHashOf('"string"')).toBeNull();
      expect(bodyHashOf('true')).toBeNull();
      expect(bodyHashOf('null')).toBeNull();
      expect(bodyHashOf('[1,2,3]')).toBeNull();
    });
  });

  describe('sha256', () => {
    it('matches standard vector for empty string', () => {
      expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('hashes non-ASCII text as UTF-8', () => {
      expect(sha256('héllo £ 漢')).toBe('a2360a3d48d67a566f9e2ecc14d627adc81bd9d1c0da78566c598b02f2d6a3be');
    });

    it('matches the two-block standard vector', () => {
      expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    });

    it('matches standard vector for "abc"', () => {
      expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
  });

  describe('docFileName', () => {
    it('project file name', () => {
      const id: DocId = { kind: 'project', uuid: 'abc-123' };
      expect(docFileName(id)).toBe('project-abc-123.owpr');
    });

    it('driver file name', () => {
      const id: DocId = { kind: 'driver', uuid: 'def-456' };
      expect(docFileName(id)).toBe('driver-def-456.json');
    });

    it('pr file name', () => {
      const id: DocId = { kind: 'pr', uuid: 'ghi-789' };
      expect(docFileName(id)).toBe('pr-ghi-789.json');
    });

    it('settings file name', () => {
      const id: DocId = { kind: 'settings' };
      expect(docFileName(id)).toBe('settings.json');
    });

    it('favourites file name', () => {
      const id: DocId = { kind: 'favourites' };
      expect(docFileName(id)).toBe('favourites.json');
    });
  });

  describe('brand classes', () => {
    it('FileId.of creates instance or returns null on empty', () => {
      const id = FileId.of('file-123');
      expect(id).not.toBeNull();
      expect(id?.value).toBe('file-123');
      expect(FileId.of('')).toBeNull();
    });

    it('RevisionId.of creates instance or returns null on empty', () => {
      const id = RevisionId.of('rev-123');
      expect(id).not.toBeNull();
      expect(id?.value).toBe('rev-123');
      expect(RevisionId.of('')).toBeNull();
    });

    it('ChangeCursor.of creates instance or returns null on empty', () => {
      const cursor = ChangeCursor.of('cursor-123');
      expect(cursor).not.toBeNull();
      expect(cursor?.value).toBe('cursor-123');
      const empty = ChangeCursor.of('');
      expect(empty).toBeNull();
    });

    it('BodyHash.of creates instance or returns null on empty', () => {
      const hash = BodyHash.of('hash-123');
      expect(hash).not.toBeNull();
      expect(hash?.value).toBe('hash-123');
      expect(BodyHash.of('')).toBeNull();
    });
  });

  describe('field helper', () => {
    it('extracts own properties', () => {
      expect(field({ a: 1, b: 'two' }, 'a')).toBe(1);
      expect(field({ a: 1, b: 'two' }, 'b')).toBe('two');
    });

    it('returns undefined for missing properties', () => {
      expect(field({ a: 1 }, 'c')).toBeUndefined();
    });
  });

  describe('docIdEquals', () => {
    it('returns true for same settings DocId', () => {
      expect(docIdEquals({ kind: 'settings' }, { kind: 'settings' })).toBe(true);
    });

    it('returns true for same favourites DocId', () => {
      expect(docIdEquals({ kind: 'favourites' }, { kind: 'favourites' })).toBe(true);
    });

    it('returns false for settings vs favourites', () => {
      expect(docIdEquals({ kind: 'settings' }, { kind: 'favourites' })).toBe(false);
    });

    it('returns true for projects with same uuid', () => {
      expect(docIdEquals({ kind: 'project', uuid: 'u1' }, { kind: 'project', uuid: 'u1' })).toBe(true);
    });

    it('returns false for projects with different uuid', () => {
      expect(docIdEquals({ kind: 'project', uuid: 'u1' }, { kind: 'project', uuid: 'u2' })).toBe(false);
    });

    it('returns true for drivers with same uuid', () => {
      expect(docIdEquals({ kind: 'driver', uuid: 'u1' }, { kind: 'driver', uuid: 'u1' })).toBe(true);
    });

    it('returns false for drivers with different uuid', () => {
      expect(docIdEquals({ kind: 'driver', uuid: 'u1' }, { kind: 'driver', uuid: 'u2' })).toBe(false);
    });

    it('returns true for pr with same uuid', () => {
      expect(docIdEquals({ kind: 'pr', uuid: 'u1' }, { kind: 'pr', uuid: 'u1' })).toBe(true);
    });

    it('returns false for pr with different uuid', () => {
      expect(docIdEquals({ kind: 'pr', uuid: 'u1' }, { kind: 'pr', uuid: 'u2' })).toBe(false);
    });

    it('returns false for different kinds with same uuid', () => {
      expect(docIdEquals({ kind: 'project', uuid: 'u1' }, { kind: 'driver', uuid: 'u1' })).toBe(false);
      expect(docIdEquals({ kind: 'project', uuid: 'u1' }, { kind: 'pr', uuid: 'u1' })).toBe(false);
      expect(docIdEquals({ kind: 'driver', uuid: 'u1' }, { kind: 'pr', uuid: 'u1' })).toBe(false);
      expect(docIdEquals({ kind: 'project', uuid: 'u1' }, { kind: 'settings' })).toBe(false);
    });
  });
});