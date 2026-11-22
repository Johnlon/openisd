import {computed, ref, type ComputedRef, type Ref, type WritableComputedRef} from 'vue';
import type {OpenISDProject, SimpleField} from '@openisd/design';
import {dateStampFrom, formatDateStamp} from '@openisd/design/fields';

export interface MobileProjectTabDeps {
  readonly project: ComputedRef<OpenISDProject>;
  readonly changed: Ref<number>;
}

export interface MobileProjectTabAPI {
  readonly name: WritableComputedRef<string>;
  readonly creator: WritableComputedRef<string>;
  readonly created: WritableComputedRef<string>;
  readonly modified: WritableComputedRef<string>;
  readonly description: WritableComputedRef<string>;
  readonly dateCommits: Ref<number>;
}

/**
 * The Project tab's logic: name/creator/created/modified/description, the same thin get/set
 * bridge onto `OpenISDProject`'s `SimpleField<string>`s that `OriginalShell-hooks.ts`'s own
 * `metaField` uses — no domain/engine involvement, so no engine area is injected here.
 */
export class MobileProjectTab implements MobileProjectTabAPI {
  readonly name: WritableComputedRef<string>;
  readonly creator: WritableComputedRef<string>;
  readonly created: WritableComputedRef<string>;
  readonly modified: WritableComputedRef<string>;
  readonly description: WritableComputedRef<string>;
  /** Counts the date boxes' commits. The boxes are keyed on it, so each commit redraws them in the shown
   *  form, even one that stores the same day ("2026-10-16" typed over 16 Oct 2026 changes no value). */
  readonly dateCommits = ref(0);

  constructor(private readonly project: ComputedRef<OpenISDProject>, private readonly changed: Ref<number>) {
    this.name = this.metaField(() => this.project.value.name.value, v => this.project.value.name.set(v));
    this.creator = this.metaField(() => this.project.value.creator.value, v => this.project.value.creator.set(v));
    this.created = this.dateField(() => this.project.value.created);
    this.modified = this.dateField(() => this.project.value.modified);
    this.description = this.metaField(() => this.project.value.description.value, v => this.project.value.description.set(v));
  }



  private dateField(field: () => SimpleField<string>): WritableComputedRef<string> {
    return computed<string>({
      get: () => { void this.changed.value; return formatDateStamp(field().value); },
      set: v => { field().set(dateStampFrom(v, field().value)); this.dateCommits.value++; },
    });
  }

  private metaField(read: () => string, write: (v: string) => void): WritableComputedRef<string> {
    return computed<string>({
      get: () => { void this.changed.value; return read(); },
      set: write,
    });
  }
}

export function useMobileProjectTab(deps: MobileProjectTabDeps): MobileProjectTabAPI {
  return new MobileProjectTab(deps.project, deps.changed);
}
