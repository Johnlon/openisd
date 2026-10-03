/** The stored records a fault can be traced to. */
export type StoreName = 'project' | 'driver' | 'view' | 'options';

/**
 * Stored data that could not be read. A loader raises (or logs) this instead of a bare message,
 * so the fault log knows WHICH store is at fault and offers the repair for that store only. A
 * fault that is not one of these is not blamed on stored data.
 */
export class StoredDataFault extends Error {
  constructor(readonly store: StoreName, message: string) {
    super(message);
    this.name = 'StoredDataFault';
  }
}
