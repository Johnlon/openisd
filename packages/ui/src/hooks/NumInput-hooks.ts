import type { InjectionKey, Ref } from 'vue';
import { ref, computed } from 'vue';
import { unitToken } from '../logic/presentationState.js';
import { toDisplay, fromDisplay, displayPrecision, type UnitGroup } from '../logic/fields/units.js';
import { fieldById } from '../logic/fields/fieldRegistry.js';
import { inputFrom } from '../logic/domEvents.js';

export interface NumInputProps {
  modelValue: number | null | undefined;
  precision?: number;
  step?: string;
  min?: number;
  max?: number;
  group?: UnitGroup;
  field?: string;
  base?: string;
  mandatory?: boolean;
}

export interface NumInputAPI {
  readonly display: Readonly<Ref<string>>;
  readonly focused: Readonly<Ref<boolean>>;
  readonly typing: Readonly<Ref<boolean>>;
  readonly badEntry: Readonly<Ref<boolean>>;
  readonly token: Readonly<Ref<string>>;
  readonly unitized: Readonly<Ref<boolean>>;
  readonly eprec: Readonly<Ref<number>>;

  fmt(v: number | null | undefined): string;
  toDisp(si: number | null): number;
  fromDisp(disp: number): number;
  onFocus(): void;
  onBlur(): void;
  onKeydown(e: KeyboardEvent): void;
  onWheel(): void;
  onMouseDown(): void;
  onInput(e: Event, emit: (event: 'update:modelValue', value: number | null) => void): void;
}

export const NumInputKey: InjectionKey<NumInputAPI> = Symbol('NumInputAPI');

export function useNumInput(props: NumInputProps): NumInputAPI {
  const unitized = computed(() => props.group != null && props.field != null && props.base != null);
  const token = computed(() => (unitized.value ? unitToken(props.field!, props.base!) : ''));

  function toDisp(si: number | null): number {
    if (si == null) return 0;
    return unitized.value ? toDisplay(si, props.group!, token.value) : si;
  }

  function fromDisp(disp: number): number {
    return unitized.value ? fromDisplay(disp, props.group!, token.value) : disp;
  }

  const eprec = computed(() =>
    Math.max(2, unitized.value ? displayPrecision(props.precision ?? 2, props.group!, props.base!, token.value) : (props.precision ?? 2)),
  );

  const focused = ref(false);
  const typing = ref(false);
  const badEntry = ref(false);

  function fmt(v: number | null | undefined): string {
    if (v == null) return '';
    const s = toDisp(v);
    return isFinite(s) ? s.toFixed(eprec.value) : '';
  }

  const display = ref(fmt(props.modelValue));

  function onFocus() {
    focused.value = true;
    typing.value = false;
    badEntry.value = false;
    display.value = fmt(props.modelValue);
  }

  function onBlur() {
    focused.value = false;
    typing.value = false;
    display.value = fmt(props.modelValue);
  }

  function onKeydown(e: KeyboardEvent) {
    typing.value = e.key !== 'ArrowUp' && e.key !== 'ArrowDown';
  }

  function onWheel() {
    typing.value = false;
  }

  function onMouseDown() {
    typing.value = false;
  }

  function onInput(e: Event, emit: (event: 'update:modelValue', value: number | null) => void) {
    const input = inputFrom(e);
    if (!input) return;

    if (!input.validity.valid) {
      badEntry.value = true;
      return;
    }
    badEntry.value = false;

    const raw = input.value.trim();
    if (raw === '') {
      emit('update:modelValue', null);
      return;
    }

    const num = Number(raw);
    if (isNaN(num)) {
      badEntry.value = true;
      return;
    }

    const si = fromDisp(num);
    const regField = props.field ? fieldById(props.field) : undefined;
    const effectiveMin = props.min ?? regField?.min ?? 0;
    const effectiveMax = props.max ?? regField?.max;

    if (si < effectiveMin || (effectiveMax != null && si > effectiveMax)) {
      badEntry.value = true;
      return;
    }

    emit('update:modelValue', si);
  }

  return {
    display,
    focused,
    typing,
    badEntry,
    token,
    unitized,
    eprec,
    fmt,
    toDisp,
    fromDisp,
    onFocus,
    onBlur,
    onKeydown,
    onWheel,
    onMouseDown,
    onInput,
  };
}

export function createMockNumInputAPI(overrides?: Partial<NumInputAPI>): NumInputAPI {
  return {
    display: ref('10.00'),
    focused: ref(false),
    typing: ref(false),
    badEntry: ref(false),
    token: ref(''),
    unitized: ref(false),
    eprec: ref(2),
    fmt: (v) => String(v ?? ''),
    toDisp: (si) => si ?? 0,
    fromDisp: (disp) => disp,
    onFocus: () => {},
    onBlur: () => {},
    onKeydown: () => {},
    onWheel: () => {},
    onMouseDown: () => {},
    onInput: () => {},
    ...overrides,
  };
}
