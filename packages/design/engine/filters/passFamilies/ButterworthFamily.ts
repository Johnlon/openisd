import {cInv, cMul, cSub, cx} from '../../complex.js';
import type {Complex} from '../../types.js';
import type {PassFamilyModel} from './PassFamilyModel.js';

/** GHIDRA_FINDINGS.md "EQ/Filter chain": Bn = Π(s − pk), pk = exp(jπ(2k+n+1)/(2n)). */
function butterworthPoles(n: number): Complex[] {
  const poles: Complex[] = [];
  for (let k = 0; k < n; k++) {
    const theta = Math.PI * (2 * k + n + 1) / (2 * n);
    poles.push(cx(Math.cos(theta), Math.sin(theta)));
  }
  return poles;
}

function polyFromRoots(s: Complex, roots: readonly Complex[]): Complex {
  let acc = cx(1, 0);
  for (const r of roots) acc = cMul(acc, cSub(s, r));
  return acc;
}

/** WinISD's Butterworth pass family, order n. Also the family `LinkwitzRileyFamily` squares. */
export class ButterworthFamily implements PassFamilyModel {
  readonly label = 'Butterworth';
  constructor(private readonly order: number) {}

  /** LP, at normalised s = j·x (x = f/fc): H = 1/Bn(s). */
  lowpass(x: number): Complex {
    return cInv(polyFromRoots(cx(0, x), butterworthPoles(this.order)));
  }

  /** HP: H = 1/Bn(1/s) — the mirror, via 1/s, not a reflected pole set. */
  highpass(x: number): Complex {
    return cInv(polyFromRoots(cInv(cx(0, x)), butterworthPoles(this.order)));
  }
}
