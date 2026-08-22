/**
 * Stored-schema versioning and the read-repair chain.
 *
 * APP DEV POLICY (human 2026-08-17, ARCHITECTURE.md §"EVERY STORED PAYLOAD CARRIES THE SCHEMA
 * VERSION IT WAS SERIALISED FROM"): every payload that outlives the session states the MODEL
 * version it was written from, and reading is a REPAIR — a payload at `Vn` reaches the current
 * `Vm` by applying the `m − n` steps in order, one shape change each.
 *
 * **If a step cannot be written, STOP and ask the human.** Do not guess the source version and
 * do not invent a coercion: a "repair" that guesses silently rewrites data nobody can get back.
 *
 * `V0` is everything written before this policy existed — payloads with no `schema` key. The
 * app used to write `v: 2` and never read it, so that number describes nothing and is NOT
 * treated as a version. Human ruling on how to handle V0, taken because the origin shape is
 * genuinely unknowable:
 *
 *     "Treat unversioned as V0, write one structural V0→V1 repair"
 *
 * with the risk accepted explicitly — the V0 step below fixes SHAPE, and cannot know whether a
 * field is absent by design or by loss.
 */

/** The version this build writes. Bump ONLY together with a new step in `STEPS`. */
export const CURRENT_SCHEMA = 2;

/** A stored payload, seen as the untyped thing it actually is on the way in. */
export type StoredBlob = Record<string, unknown>;

/**
 * One upgrade step: takes a blob at version `from`, returns it at `from + 1`.
 *
 * A step does ONE shape change. It never validates unrelated fields, never "tidies", and never
 * touches a version other than its own — so a failure is always attributable to one step.
 */
export interface UpgradeStep {
  from: number;
  /** What this step changes, for the log line the user can read. */
  what: string;
  apply: (blob: StoredBlob) => StoredBlob;
}

export const STEPS: readonly UpgradeStep[] = [
  {
    from: 0,
    what: 'restore structural containers absent from pre-policy payloads',
    apply: (blob) => {
      // The one shape fault observed in V0 data: a driver record with no `specs` container.
      // `OpenISDDriver` dereferences `record.specs` on its first field read, so its absence
      // threw and killed every driver computed in the app.
      //
      // The container is STRUCTURE, not data — an empty `specs` asserts no value about the
      // driver, so restoring it cannot invent one. That is what makes this repair safe to
      // apply blind, and it is the only reason a step may be written for a version whose true
      // shape is unknown.
      const driver = blob.driver;
      if (driver && typeof driver === 'object') {
        const d = driver as Record<string, unknown>;
        if (d.specs == null || typeof d.specs !== 'object') d.specs = { woofer: {} };
      }
      return blob;
    },
  },
  {
    from: 1,
    what: 'driver slot: record object → its own JSON text (QO73 — the UI carries the driver ' +
      'only as the managed layer\'s serialisation, never as the record value)',
    apply: (blob) => {
      if (blob.driver && typeof blob.driver === 'object') blob.driver = JSON.stringify(blob.driver);
      return blob;
    },
  },
];

export interface UpgradeResult {
  blob: StoredBlob;
  /** The version read from the payload — 0 where it carried none. */
  from: number;
  /** One line per step applied, for the console and the diagnostics report. */
  applied: string[];
}

/** The version a payload states, or 0 for pre-policy data. */
export function schemaOf(blob: StoredBlob): number {
  const v = blob.schema;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Bring a stored payload to `CURRENT_SCHEMA`.
 *
 * Throws when a payload states a version this build has no route from — including a version
 * from the FUTURE, which happens when a newer build wrote the state and an older one reads it.
 * Refusing loudly is correct there: an older build silently loading a newer shape is exactly
 * how data gets truncated on the next save.
 */
export function upgrade(blob: StoredBlob): UpgradeResult {
  const from = schemaOf(blob);
  const applied: string[] = [];

  if (from > CURRENT_SCHEMA) {
    throw new Error(
      `saved data is schema V${from}, but this build only understands V${CURRENT_SCHEMA} — ` +
      'it was written by a newer version of OpenISD');
  }

  let current = blob;
  for (let v = from; v < CURRENT_SCHEMA; v++) {
    const step = STEPS.find(s => s.from === v);
    if (!step) {
      throw new Error(`no upgrade step from schema V${v} to V${v + 1}`);
    }
    current = step.apply(current);
    applied.push(`V${v}→V${v + 1}: ${step.what}`);
  }
  current.schema = CURRENT_SCHEMA;
  return { blob: current, from, applied };
}

/** Stamp a payload being written. Every writer calls this — an unstamped payload is a V0 the
 *  next reader has to guess about, which is the situation this policy exists to end. */
export function stamp<T extends object>(payload: T): T & { schema: number } {
  return Object.assign(payload as T & { schema: number }, { schema: CURRENT_SCHEMA });
}
