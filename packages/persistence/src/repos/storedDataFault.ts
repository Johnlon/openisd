const STORE_NAMES = ['project', 'driver', 'view', 'options'] as const;

/** The stored records a fault can be traced to. */
export type StoreName = typeof STORE_NAMES[number];

/**
 * Stored data that could not be read. A loader raises (or logs) one of these instead of a bare
 * message, so the fault log knows WHICH store is at fault and offers the repair for that store
 * only. A fault that is not one of these is not blamed on stored data.
 */
export interface StoredDataFault extends Error {
  readonly store: StoreName;
}

export function createStoredDataFault(store: StoreName, message: string): StoredDataFault {
  const fault = new Error(message);
  fault.name = 'StoredDataFault';
  return Object.assign(fault, {store});
}

export function isStoredDataFault(thrown: unknown): thrown is StoredDataFault {
  return thrown instanceof Error && thrown.name === 'StoredDataFault'
    && 'store' in thrown && STORE_NAMES.some(name => name === thrown.store);
}
