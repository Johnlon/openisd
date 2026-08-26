// Four distinct loss shapes, live-confirmed against real WinISD across all 6 box types
// (BUG_20260824) — no port -> no Qp; no coupling to another chamber -> no Qicl. Every one is a
// RAW field (no solve relation, no provenance), so each is a `RawField` handle — the same SHAPE
// every other stored field in this domain has, differing only in what it can do.

import type { RawField } from './cell.js';

export interface SealedLosses {
  readonly Ql: RawField<number>;
  readonly Qa: RawField<number>;
}

export interface VentedLosses {
  readonly Ql: RawField<number>;
  readonly Qa: RawField<number>;
  readonly Qp: RawField<number>;
}

export interface CoupledSealedLosses {
  readonly Ql: RawField<number>;
  readonly Qa: RawField<number>;
  readonly Qicl: RawField<number>;
}

export interface CoupledVentedLosses {
  readonly Ql: RawField<number>;
  readonly Qa: RawField<number>;
  readonly Qp: RawField<number>;
  readonly Qicl: RawField<number>;
}
