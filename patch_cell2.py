import re

with open("packages/design/domain/cell.ts", "r") as f:
    text = f.read()

# Replace the createCell signature and body
old_create_cell = """export function createCell<T>(
  name: string,
  value: T | null,
  state: FieldState,
  dq?: string | readonly string[] | null | (() => string | readonly string[] | null),
): Cell<T> {
  const getDq = (): readonly string[] => {
    const res = typeof dq === 'function' ? dq() : dq;
    if (!res) return [];
    return typeof res === 'string' ? [res] : res;
  };
  const cell: Cell<T> = {
    name,
    value,
    state,
    dq: getDq,
  };
  Object.defineProperty(cell, 'dq', {
    value: getDq,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return cell;
}"""

new_create_cell = """export function createCell<T>(
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
  return cell;
}"""

text = text.replace(old_create_cell, new_create_cell)

# Update nullableField
old_nullable = """export function nullableField<K extends PropertyKey, T extends Record<K, number | null>>(
  lens: Lens<T>,
  key: K,
  getDq?: (value: number | null) => string | null,
): Field<number> {
  return new Field<number>(
    () => {
      const v = lens.get()[key];
      return createCell<number>(
        String(key),
        v,
        v === null ? 'not-available' : 'entered',
        getDq ? () => getDq(v) : undefined,
      );
    },
    (v) => lens.set({ ...lens.get(), [key]: v }),
    () => lens.set({ ...lens.get(), [key]: null }),
  );
}"""

new_nullable = """export function nullableField<K extends PropertyKey, T extends Record<K, number | null>>(
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
}"""

text = text.replace(old_nullable, new_nullable)

# Update requiredField
old_required = """export function requiredField<K extends PropertyKey, T extends Record<K, number>>(
  lens: Lens<T>,
  key: K,
  label: string,
  getDq?: (value: number) => string | null,
): Field<number> {
  return new Field<number>(
    () => {
      const v = lens.get()[key];
      return createCell<number>(
        String(key),
        v,
        'entered',
        getDq ? () => getDq(v) : undefined,
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
}"""

new_required = """export function requiredField<K extends PropertyKey, T extends Record<K, number>>(
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
}"""

text = text.replace(old_required, new_required)

with open("packages/design/domain/cell.ts", "w") as f:
    f.write(text)
