import { describe, expect, it } from 'vitest';
import type { DocId } from '../../cloud/syncDoc.js';
import {
  unwrapDoc,
  wrapDoc,
} from '../../cloud/docMigrate.js';

describe('docMigrate', () => {
  describe('wrap and unwrap', () => {
    it('wraps and unwraps a layout-2 project', () => {
      const id: DocId = { kind: 'project', uuid: 'p-1' };
      const body = '{"label":"My Sub"}';
      const wrapped = wrapDoc('openisd_projects', id, body, 2);
      expect(wrapped['openisd_projects']).toBeDefined();
      expect(JSON.parse(wrapped['openisd_projects'])).toMatchObject({
        entries: [{ id: 'p-1', text: body }],
      });
      const unwrapped = unwrapDoc('openisd_projects', id, wrapped);
      expect(unwrapped).toBe(body);
    });

    it('wraps a layout-1 project with version: 1', () => {
      const id: DocId = { kind: 'project', uuid: 'p-1' };
      const body = '{"label":"My Sub"}';
      const wrapped = wrapDoc('openisd_projects', id, body, 1);
      expect(JSON.parse(wrapped['openisd_projects'])).toMatchObject({
        version: 1,
        entries: [{ id: 'p-1', text: body }],
      });
    });

    it('wraps and unwraps a layout-2 driver', () => {
      const id: DocId = { kind: 'driver', uuid: 'd-1' };
      const body = '{"brand":"Peerless","model":"XXLS"}';
      const wrapped = wrapDoc('openisd_my_drivers', id, body, 2);
      expect(wrapped['openisd_my_drivers']).toBeDefined();
      expect(JSON.parse(wrapped['openisd_my_drivers'])).toMatchObject({
        entries: [{ uuid: 'd-1', record: { brand: 'Peerless', model: 'XXLS' } }],
      });
      const unwrapped = unwrapDoc('openisd_my_drivers', id, wrapped);
      expect(JSON.parse(unwrapped ?? '')).toEqual({ brand: 'Peerless', model: 'XXLS' });
    });

    it('wraps a layout-1 driver with schema: 1', () => {
      const id: DocId = { kind: 'driver', uuid: 'd-1' };
      const body = '{"brand":"Peerless"}';
      const wrapped = wrapDoc('openisd_my_drivers', id, body, 1);
      expect(JSON.parse(wrapped['openisd_my_drivers'])).toMatchObject({
        schema: 1,
        entries: [{ uuid: 'd-1', record: { brand: 'Peerless' } }],
      });
    });

    it('wraps and unwraps settings', () => {
      const id: DocId = { kind: 'settings' };
      const body = '{"differenceCues":true}';
      const wrapped = wrapDoc('openisd_app_settings', id, body, 2);
      expect(wrapped['openisd_app_settings']).toBe(body);
      const unwrapped = unwrapDoc('openisd_app_settings', id, wrapped);
      expect(unwrapped).toBe(body);
    });
  });
});