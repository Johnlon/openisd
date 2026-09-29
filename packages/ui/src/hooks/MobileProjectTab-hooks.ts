import {computed, type ComputedRef, type Ref, type WritableComputedRef} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import {formatDateStamp, parseDateStamp} from '../logic/dateDisplay.js';

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

  constructor(private readonly project: ComputedRef<OpenISDProject>, private readonly changed: Ref<number>) {
    this.name = this.metaField(() => this.project.value.name.value, v => this.project.value.name.set(v));
    this.creator = this.metaField(() => this.project.value.creator.value, v => this.project.value.creator.set(v));
    this.created = this.metaField(
      () => formatDateStamp(this.project.value.created.value), v => this.project.value.created.set(parseDateStamp(v)));
    this.modified = this.metaField(
      () => formatDateStamp(this.project.value.modified.value), v => this.project.value.modified.set(parseDateStamp(v)));
    this.description = this.metaField(() => this.project.value.description.value, v => this.project.value.description.set(v));
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
