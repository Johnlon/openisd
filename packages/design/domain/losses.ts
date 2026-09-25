// Four distinct loss shapes, live-confirmed against real WinISD across all 6 box types
// (BUG_20260824) — no port -> no Qp; no coupling to another chamber -> no Qicl. Every one is a
// stored value with no solve relation and no provenance, so each is a `SimpleField`.

import type {SimpleField} from './cell.js';

export interface SealedLosses {
  readonly Ql: SimpleField<number>;
  readonly Qa: SimpleField<number>;
}

export interface VentedLosses {
  readonly Ql: SimpleField<number>;
  readonly Qa: SimpleField<number>;
  readonly Qp: SimpleField<number>;
}

export interface CoupledSealedLosses {
  readonly Ql: SimpleField<number>;
  readonly Qa: SimpleField<number>;
  readonly Qicl: SimpleField<number>;
}

export interface CoupledVentedLosses {
  readonly Ql: SimpleField<number>;
  readonly Qa: SimpleField<number>;
  readonly Qp: SimpleField<number>;
  readonly Qicl: SimpleField<number>;
}
