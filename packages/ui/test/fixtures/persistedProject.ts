/**
 * Shared fixtures for the persistence-door tests: a conforming synthetic driver record, a
 * project built through `ProjectBuilder`, and a typed read of a saved project's wire.
 */
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';
import {createEngine} from '@openisd/design/engine';
import type {FileStorage} from '@openisd/persistence';
import {z} from 'zod';

/** The driver record inside a saved project's wire — only the fields these tests read; the
 *  full shape is validated again when the record is handed to `OpenISDDriver.fromConformingRecord`. */
export const driverWireRecordSchema = z.looseObject({
  specs: z.looseObject({
    woofer: z.looseObject({
      Fs_hz: z.looseObject({ readings: z.unknown() }).optional(),
    }).optional(),
  }),
});

/** A project's `.owpr`/share-link wire, as `session.saved` carries it — only the fields these
 *  tests read. `z.looseObject` passes every other key through unvalidated, so `Object.keys()`
 *  over a parsed value still sees the real record. */
export const savedProjectWireSchema = z.looseObject({
  meta: z.looseObject({ name: z.unknown(), creator: z.unknown(), modified: z.unknown() }).optional(),
  box: z.looseObject({ boxType: z.unknown() }).optional(),
  driverEmbedding: z.looseObject({ device: driverWireRecordSchema }).optional(),
});
export type SavedProjectWire = z.infer<typeof savedProjectWireSchema>;

/** `sessionText` is a `{..., saved, ...}` session wrapper (`.owpr` or a decoded share link's
 *  `project` text) — this reads the boundary once and hands back the `saved` project, typed. */
export function parseSavedProject(sessionText: string): SavedProjectWire {
  const parsed: unknown = JSON.parse(sessionText);
  if (typeof parsed !== 'object' || parsed === null || !('saved' in parsed)) {
    throw new Error('the payload must carry a saved project');
  }
  return savedProjectWireSchema.parse(parsed.saved);
}

/** A picker that is never reached — these tests exercise the storage/link/text doors only. */
export const noFilePicker: FileStorage = {
  save: async () => ({ name: null, cancelled: true, written: false }),
  saveAs: async () => ({ name: null, cancelled: true, written: false }),
  openFileName: () => null,
  forget: () => {},
};
/** The project every door takes, built through `OpenISDProject.builder` rather than a second,
 *  hand-rolled construction path. `driverRecord` is REQUIRED: a project cannot exist without a
 *  driver (`docs/design/DRIVER_NON_NULL_INVARIANT.md`). */
export function projectOf(box: BoxType, meta: FixtureMeta,
  driverRecord: unknown): OpenISDProject {
  const driver = OpenISDDriver.fromConformingRecord(driverRecord, createEngine());
  if (Array.isArray(driver)) throw new Error(`fixture record does not conform: ${driver.join('; ')}`);
  
  const builder = new ProjectBuilder(driver, createEngine());
  let project: OpenISDProject;
  // Each box type requires its own volume before `build()`; these tests are about what crosses
  // the wire, so any stated size does.
  if (box === 'vented') project = builder.vented().volume_m3(0.03).tuning_goal_hz(35).build();
  else if (box === 'bandpass4') project = builder.bandpass4().rearVolume_m3(0.03).frontVolume_m3(0.02).build();
  else project = builder.sealed().volume_m3(0.03).build();
  
  project.name.set(meta.name);
  project.creator.set(meta.creator);
  project.created.set(meta.created);
  project.modified.set(meta.modified);
  project.description.set(meta.description);
  // A file/share write serialises the SAVED record, never the edited one
  // (`openisdDomain.ts` `#slot`/`save()`), so the meta set above reaches the wire only once it is
  // committed. That the app itself never commits before writing is
  // bugs/archive/BUG_20260908_saving_a_project_drops_its_name_creator_and_all_metadata.md; these tests
  // commit here so they exercise the WIRE rather than restating that bug.
  project.save();
  return project;
}

/** The project metadata a fixture states — the five fields `projectOf` writes onto a project
 *  before saving it. */
export interface FixtureMeta {
  name: string; creator: string; created: string; modified: string; description: string;
}

/** A conforming driver RECORD — the form a driver takes inside a serialised payload. Every key
 *  the schema requires is present; the values are deliberately synthetic, since these tests are
 *  about what survives the wire, not about any driver's physics. */
export function sampleDriverRecord(): unknown {
  return {
    brand: {value: 'test'}, model: {value: 'test'}, manufacturer: {value: 'test'},
    uuid: {value: '00000000-0000-4000-8000-000000000000'}, driver_type: {value: 'woofer'},
    sku: {value: 'test', grounds: [{origin: 'manual', reading: 'test'}]},
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    data_sources: {value: {}},
    specs: { woofer: {
      Fs_hz:  { state: 'E', value: 30, origin: 'entered', readings: { entered: { read_value: 30 } } },
      Vas_m3: { state: 'E', value: 0.05, origin: 'entered', readings: { entered: { read_value: 0.05 } } },
      Sd_m2:  { state: 'E', value: 0.02, origin: 'entered', readings: { entered: { read_value: 0.02 } } },
    } }
  };
}

