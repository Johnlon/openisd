import type {BundledPassiveRadiatorRepo} from '@openisd/persistence';
import type {Telemetry} from './telemetry.js';

/** Records `radiator_pick` for a passive radiator the user chose, in the New Project wizard or on the box page. */
export interface RadiatorPicks {
  /** A catalogue radiator: its id, and its catalogue name when the catalogue can be read. */
  bundled(uuid: string): void;
  /** A radiator from My passive radiators: not named, its name is the user's. */
  saved(): void;
}

export function radiatorPickRecorder(telemetry: Telemetry, catalogue: BundledPassiveRadiatorRepo): RadiatorPicks {
  return {
    bundled(uuid) {
      void catalogue.index().then(rows => {
        telemetry.record({kind: 'radiator_pick', source: 'bundled', id: uuid, name: rows.find(r => r.uuid === uuid)?.name ?? ''});
      }, () => {
        telemetry.record({kind: 'radiator_pick', source: 'bundled', id: uuid, name: ''});
      });
    },
    saved() {
      telemetry.record({kind: 'radiator_pick', source: 'mine', id: '', name: ''});
    },
  };
}
