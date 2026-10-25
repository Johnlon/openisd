import type {ComputedRef, InjectionKey} from 'vue';

/** A view-scoped switch for fields that should spin without accepting ordinary text edits. */
export interface FieldEditMode {
  readonly enabled: ComputedRef<boolean>;
  disabledAttempt(): void;
}

export const FIELD_EDIT_MODE: InjectionKey<FieldEditMode> = Symbol('openisd.fieldEditMode');
