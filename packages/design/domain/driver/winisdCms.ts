import type { Air, SolverField } from '../../engine/index.js';
import { computedSlot } from './computedSlot.js';
import { OpenIsdDriverSpec } from './openIsdDriverSpec.js';
import { positive } from './positive.js';

/** `Cms = Vas/(ρ·c²·Sd²)` — the compliance WinISD's own circuit acts on, which it takes from Vas
 *  rather than from an entered Cms (debugger capture, winisd_research 4d818e2). `spec`'s entered
 *  field where the air is unresolved, or Vas or Sd is not a positive number. */
export function winisdCms_m_per_N(spec: OpenIsdDriverSpec, air: Air | null): SolverField<number> {
    const Vas = spec.Vas_m3.value, Sd = spec.Sd_m2.value;
    if (air === null || !positive(Vas) || !positive(Sd)) return spec.Cms_m_per_N;
    const Cms = Vas / (air.rho * air.c * air.c * Sd * Sd);
    return positive(Cms) ? computedSlot(Cms) : spec.Cms_m_per_N;
}
