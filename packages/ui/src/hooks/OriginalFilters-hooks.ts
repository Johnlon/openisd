import {computed, type ComputedRef, type Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {
  AllpassFilter, AllpassPatch, Filter, FilterEngine, FilterType, LinkwitzFilter, LinkwitzPatch, PassOrderEntry,
  ParametricEqFilter, ParametricEqPatch, PassFilter, PassPatch, PeakHighpassFilter, PeakHighpassPatch,
  RaisedCosineFilter, RaisedCosinePatch, ShelfFilter, ShelfPatch, StaticGainFilter, StaticGainPatch,
} from '@openisd/design/engine';
import type {WinisdFilterDeviation} from '@openisd/design/fields';

/** What the Filters tab can do — the vocabulary its components speak. Nothing here names the
 *  engine: an edit is one call that decides the new values and stores them. */
export interface OriginalFiltersAPI {
  readonly filters: ComputedRef<readonly Filter[]>;
  /** Appends the engine's default filter of `type` under a fresh list id; returns that id. */
  add(type: FilterType): string;
  remove(id: string): void;
  /** Bypass or re-enable one filter in place. */
  setEnabled(f: Filter, enabled: boolean): void;
  /** WinISD's Filters-list caption for one filter, exact wording. */
  caption(f: Filter): string;
  // One typed edit per filter class: the engine decides what an editor may write (rounding,
  // clamping to the entry range), and the result replaces `f` in the chain. An editor calls
  // the one matching its own `Filter` variant (bugs/archive/BUG_20260927_filter-editors-hold-domain-logic.md).
  editPass(f: PassFilter, patch: PassPatch): void;
  editAllpass(f: AllpassFilter, patch: AllpassPatch): void;
  editLinkwitz(f: LinkwitzFilter, patch: LinkwitzPatch): void;
  editParametricEq(f: ParametricEqFilter, patch: ParametricEqPatch): void;
  editPeakHighpass(f: PeakHighpassFilter, patch: PeakHighpassPatch): void;
  editStaticGain(f: StaticGainFilter, patch: StaticGainPatch): void;
  editRaisedCosine(f: RaisedCosineFilter, patch: RaisedCosinePatch): void;
  editShelf(f: ShelfFilter, patch: ShelfPatch): void;
  /** `f`'s editor shows `d`'s ≠W cue: `f` is of the kind the WinISD bug concerns and OpenISD
   *  has it fixed (its error switch is off), whatever `f`'s order (`WinisdDeviation` cue rule). */
  deviationShown(d: WinisdFilterDeviation, f: Filter): boolean;
  /** How `f`'s Order box takes entry (range, step, whether editable, tooltip). */
  passOrderEntry(f: PassFilter): PassOrderEntry;
}

/**
 * The Filters tab's logic: the project's filter chain read fresh on every change signal, and
 * edits written straight back to it — no local mirror, no deep watch (the delegate-free
 * pattern `docs/design/REACTIVITY.md` specifies). Constructed once by the composition root
 * with the project, its change signal and the engine's filters area; the list id is this
 * list's row key only.
 */
export class OriginalFilters implements OriginalFiltersAPI {
  readonly filters: ComputedRef<readonly Filter[]>;

  constructor(
    private readonly project: ComputedRef<OpenISDProject>,
    private readonly changed: Ref<number>,
    private readonly engine: FilterEngine,
  ) {
    // Raw reads (`filters.value`) are not Vue-tracked; `project` re-fires only on focus swap,
    // so the change signal must be read too, or a quick-add never re-renders the list.
    this.filters = computed(() => {
      void changed.value;
      return project.value.filters.value;
    });
  }

  add(type: FilterType): string {
    const id = crypto.randomUUID();
    const chain = this.project.value.filters;
    chain.set([...chain.value, {...this.engine.default(type), id}]);
    return id;
  }

  remove(id: string): void {
    const chain = this.project.value.filters;
    chain.set(chain.value.filter(f => f.id !== id));
  }

  setEnabled(f: Filter, enabled: boolean): void {
    this.replace(f, {...f, enabled});
  }

  caption(f: Filter): string {
    return this.engine.caption(f);
  }

  editPass(f: PassFilter, patch: PassPatch): void { this.replace(f, this.engine.editPass(f, patch)); }
  editAllpass(f: AllpassFilter, patch: AllpassPatch): void { this.replace(f, this.engine.editAllpass(f, patch)); }
  editLinkwitz(f: LinkwitzFilter, patch: LinkwitzPatch): void { this.replace(f, this.engine.editLinkwitz(f, patch)); }
  editParametricEq(f: ParametricEqFilter, patch: ParametricEqPatch): void { this.replace(f, this.engine.editParametricEq(f, patch)); }
  editPeakHighpass(f: PeakHighpassFilter, patch: PeakHighpassPatch): void { this.replace(f, this.engine.editPeakHighpass(f, patch)); }
  editStaticGain(f: StaticGainFilter, patch: StaticGainPatch): void { this.replace(f, this.engine.editStaticGain(f, patch)); }
  editRaisedCosine(f: RaisedCosineFilter, patch: RaisedCosinePatch): void { this.replace(f, this.engine.editRaisedCosine(f, patch)); }
  editShelf(f: ShelfFilter, patch: ShelfPatch): void { this.replace(f, this.engine.editShelf(f, patch)); }

  passOrderEntry(f: PassFilter): PassOrderEntry { return this.engine.passOrderEntry(f); }

  deviationShown(d: WinisdFilterDeviation, f: Filter): boolean {
    void this.changed.value;
    return d.cueShownFor(this.project.value.errorSwitches, f);
  }

  /** `next` takes `f`'s place in the chain; every other filter is untouched. A filter with no
   *  list id is not in any list yet and has nothing to replace. An edit that changes no field
   *  writes nothing — an arrow-key spin step fires `input` and `change` with the same value. */
  private replace(f: Filter, next: Filter): void {
    if (f.id === undefined || sameFields(f, next)) return;
    const chain = this.project.value.filters;
    chain.set(chain.value.map(x => (x.id === f.id ? next : x)));
  }
}

/** Every field of `a` and `b` holds the same value (filters are flat records of primitives). */
function sameFields(a: Filter, b: Filter): boolean {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.is(Reflect.get(a, k), Reflect.get(b, k)));
}
