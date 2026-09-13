import type { FieldState, SolverField } from '@openisd/design/engine';

export interface Cell<T> {
  readonly name: string;

  readonly value: T | null;
  readonly state: FieldState;
  dq(): readonly string[];
}

export function createCell<T>(
  name: string,
  value: T | null,
  state: FieldState,
  dq?: readonly string[],
): Cell<T> {
  const dqArray = dq ?? [];
  const cell: Cell<T> = {
    name,
    value,
    state,
    dq: () => dqArray,
  };
  Object.defineProperty(cell, 'dq', {
    value: () => dqArray,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  // `name` is an inspection/debugging aid, not part of the cell's value contract.
  // Making it non-enumerable prevents deepEqual(cell, { value, state }) from failing
  // in the hundreds of existing tests that predate this field.
  Object.defineProperty(cell, 'name', {
    value: name,
    writable: false,
    configurable: true,
    enumerable: false,
  });
  return cell;
}

export interface RawField<T> {
  get(): T;
  set(v: T): void;
}

export class Field<T> implements SolverField<T> {
  private isCalculated = false;
  private derivedValue: T | null = null;
  private dqList: string[] = [];

  constructor(
    private readonly readCell: () => Cell<T>,
    private readonly writeValue: (v: T) => void,
    private readonly clearValue: () => void,
  ) {}

  private getEffectiveCell(): Cell<T> {
    const cell = this.readCell();
    if (cell.state === 'entered') {
      if (this.dqList.length > 0) {
        return createCell(cell.name, cell.value, 'entered', this.dqList);
      }
      return cell;
    }
    if (this.isCalculated && this.derivedValue !== null) {
      return createCell(cell.name, this.derivedValue, 'calculated', this.dqList.length > 0 ? this.dqList : undefined);
    }
    // Fall back to the readCell() result (which may already be 'calculated' or 'not-available').
    // This preserves the original Field behaviour for fields that compute their calculated value
    // directly inside their readCell callback (e.g. the air-constant fields).
    return cell;
  }

  get name(): string { return this.readCell().name; }
    get value(): T | null { return this.getEffectiveCell().value; }
  get state(): FieldState { return this.getEffectiveCell().state; }
  get entered(): boolean { return this.state === 'entered'; }
  get calculated(): boolean { return this.state === 'calculated'; }
  get notAvailable(): boolean { return this.state === 'not-available'; }
  get dq(): readonly string[] { return this.dqList; }

  get(): Cell<T> { return this.getEffectiveCell(); }

  clear(): void { this.setNotAvailable(); }
  set(v: T): void {
    this.writeValue(v);
  }

  /** Store a solver-established project value while exposing it as an entered project fact. */
  setProjectEstablished(value: T, dq?: string[]): void {
    this.writeValue(value);
    this.isCalculated = false;
    this.derivedValue = null;
    this.dqList = dq ?? [];
  }

  setNotAvailable(): void {
    this.clearValue();
    this.isCalculated = false;
    this.derivedValue = null;
    this.dqList = [];
  }

  setCalculated(value: T, dq?: string[]): void {
    this.isCalculated = true;
    this.derivedValue = value;
    this.dqList = dq ?? [];
  }

  setDq(dq?: string[]): void {
    this.dqList = dq ?? [];
  }
}

export interface Lens<T> {
  get(): T;
  set(v: T): void;
}

export function focus<P, K extends keyof P>(parent: Lens<P>, key: K): Lens<P[K]> {
  return {
    get: () => parent.get()[key],
    set: (v) => parent.set({ ...parent.get(), [key]: v }),
  };
}

export function nullableField<K extends PropertyKey, T extends Record<K, number | null>>(
  lens: Lens<T>,
  key: K,
  getDq?: (value: number | null) => string | null,
): Field<number> {
  return new Field<number>(
    () => {
      const v = lens.get()[key];
      let dqList: string[] | undefined = undefined;
      if (getDq) {
        const d = getDq(v);
        if (d) dqList = [d];
      }
      return createCell<number>(
        String(key),
        v,
        v === null ? 'not-available' : 'entered',
        dqList,
      );
    },
    (v) => lens.set({ ...lens.get(), [key]: v }),
    () => lens.set({ ...lens.get(), [key]: null }),
  );
}

export function requiredField<K extends PropertyKey, T extends Record<K, number>>(
  lens: Lens<T>,
  key: K,
  label: string,
  getDq?: (value: number) => string | null,
): Field<number> {
  return new Field<number>(
    () => {
      const v = lens.get()[key];
      let dqList: string[] | undefined = undefined;
      if (getDq) {
        const d = getDq(v);
        if (d) dqList = [d];
      }
      return createCell<number>(
        String(key),
        v,
        'entered',
        dqList,
      );
    },
    (v) => lens.set({ ...lens.get(), [key]: v }),
    () => {
      throw new Error(
        `${label} cannot be cleared: it always has a value in this design — there is no ` +
        '"not entered" state for it to return to.',
      );
    },
  );
}

export class ReadOnlyCalculatedField<T> {
  constructor(private readonly readCell: () => Cell<T>) {}

  get name(): string { return this.readCell().name; }
  get value(): T | null { return this.readCell().value; }
  get state(): FieldState { return this.readCell().state; }
  get entered(): boolean { return this.state === 'entered'; }
  get calculated(): boolean { return this.state === 'calculated'; }
  get notAvailable(): boolean { return this.state === 'not-available'; }
  get dq(): readonly string[] { return this.readCell().dq(); }

  get(): Cell<T> { return this.readCell(); }
}
