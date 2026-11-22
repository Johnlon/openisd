/** The layout migrations: one pure step per layout, each taking the store's data as one layout
 *  wrote it and returning it as the next layout reads it. A store is migrated one layout at a
 *  time, never in a jump, so every step is checked against its own golden dump. */
export type StoreData = Readonly<Record<string, string>>;

/** An exported file's top-level object (`.owpr`, `.owdr`), without its `layout` stamp. */
export type FileJson = Readonly<Record<string, unknown>>;

export interface LayoutStep {
  /** The layout this step reads; it writes `from + 1`. */
  readonly from: number;
  /** The store's data as `from` wrote it, as `from + 1` reads it. */
  migrate(data: StoreData): StoreData;
  /** An exported file as `from` wrote it, as `from + 1` reads it. */
  migrateFile(file: FileJson): FileJson;
}

/** The layout a build writes, and the steps that bring an older store up to it. The composition
 *  root builds the app's from `STORAGE_LAYOUT` and `createLayoutSteps`; a test passes its own to prove
 *  the rules without a real next layout. */
export interface LayoutRules {
  readonly layout: number;
  readonly steps: readonly LayoutStep[];
}

export interface LayoutMigrator {
  /** Whether the steps run unbroken from layout 1 to the current layout — the invariant that
   *  makes every older store reachable. */
  covers(): boolean;
  /** `data` migrated from layout `from` up to the current layout, one step at a time; null when
   *  a step is missing. `onStep` hears each layout reached, with its data, before the next step runs. */
  migrate(data: StoreData, from: number, onStep?: (layout: number, data: StoreData) => void): StoreData | null;
  /** An exported file migrated from layout `from` up to the current layout, one step at a time;
   *  null when a step is missing. */
  migrateFile(file: FileJson, from: number): FileJson | null;
}

export function createLayoutMigrator(rules: LayoutRules): LayoutMigrator {
  const stepFrom = (layout: number): LayoutStep | null => rules.steps.find(step => step.from === layout) ?? null;
  return {
    covers() {
      for (let layout = 1; layout < rules.layout; layout++) if (stepFrom(layout) === null) return false;
      return true;
    },
    migrate(data, from, onStep = () => undefined) {
      let current = data;
      for (let layout = from; layout < rules.layout; layout++) {
        const step = stepFrom(layout);
        if (step === null) return null;
        current = step.migrate(current);
        onStep(layout + 1, current);
      }
      return current;
    },
    migrateFile(file, from) {
      let current = file;
      for (let layout = from; layout < rules.layout; layout++) {
        const step = stepFrom(layout);
        if (step === null) return null;
        current = step.migrateFile(current);
      }
      return current;
    },
  };
}
