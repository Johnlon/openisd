// Four distinct loss shapes, live-confirmed against real WinISD across all 6 box types
// (BUG_20260824) — no port -> no Qp; no coupling to another chamber -> no Qicl. Every one is a
// stored value with no solve relation and no provenance, so each is a `SimpleField` — one a
// person can also clear, which settles it to the WinISD default the box starts with
// (`SimpleField & Clearable`, a cleared value settles to the default).

import type {Clearable, SimpleField} from './cell.js';

export interface SealedLosses {
  readonly Ql: SimpleField<number> & Clearable;
  readonly Qa: SimpleField<number> & Clearable;
}

export interface VentedLosses {
  readonly Ql: SimpleField<number> & Clearable;
  readonly Qa: SimpleField<number> & Clearable;
  readonly Qp: SimpleField<number> & Clearable;
}

export interface CoupledSealedLosses {
  readonly Ql: SimpleField<number> & Clearable;
  readonly Qa: SimpleField<number> & Clearable;
  readonly Qicl: SimpleField<number> & Clearable;
}

export interface CoupledVentedLosses {
  readonly Ql: SimpleField<number> & Clearable;
  readonly Qa: SimpleField<number> & Clearable;
  readonly Qp: SimpleField<number> & Clearable;
  readonly Qicl: SimpleField<number> & Clearable;
}
