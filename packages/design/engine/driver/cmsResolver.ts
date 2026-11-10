import type {Air} from '../air.js';
import {
    BL_FROM_QES_CMS_ROUTE, CMS_FROM_VAS_SD_ROUTE, MMS_FROM_FS_CMS_ROUTE, RMS_FROM_FS_MMS_QMS_ROUTE,
} from './routes/index.js';
import type {DriverRoute} from './routes/index.js';

/** Which Cms a datasheet that states both Cms and Vas is charted with (WinISD option "Cms from Vas"). */
export type ChartingSource =
    | {readonly kind: 'VasWins'}
    | {readonly kind: 'StatedCmsWins'};

/** The mechanical figures WinISD's chain works out; null where the chain cannot reach one. */
export interface ShownMechanics {
    readonly Cms_m_per_N: number | null;
    readonly Mms_kg: number | null;
    readonly Rms_kg_per_s: number | null;
    readonly BL_terminal_Tm: number | null;
}

/** The figures the chain starts from, SI; null where not stated. `Cms_m_per_N` and `Mms_kg` are the fallbacks used where the chain
 *  cannot work its own out (a Cms from Vas needs Vas and Sd; a Mms needs a Cms). */
export interface CmsResolveInput {
    readonly Fs_hz: number | null;
    readonly Qes: number | null;
    readonly Qms: number | null;
    readonly Vas_m3: number | null;
    readonly Sd_m2: number | null;
    readonly Cms_m_per_N: number | null;
    readonly Mms_kg: number | null;
    readonly Re_terminal_ohm: number | null;
}

const isPositive = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

const routeValue = (route: DriverRoute, working: Parameters<DriverRoute['value']>[0]): number | null => {
    const v = route.value(working);
    return isPositive(v) ? v : null;
};

/** WinISD's chain, the one place it is worked out for the box and the charts alike, driver and radiator: Cms from Vas and Sd
 *  (only when `source` says Vas wins), Mms from Fs and that Cms, Rms from Fs, Mms and Qms, BL from Re, Fs, Qes and that Cms.
 *  Pure; each figure is in `air`'s terms and null where the chain cannot reach it. */
export function resolveCms(source: ChartingSource, input: CmsResolveInput, air: Air): ShownMechanics {
    const {Fs_hz, Qes, Qms, Vas_m3, Sd_m2, Re_terminal_ohm} = input;
    const fromVas = (): number | null => {
        switch (source.kind) {
            case 'VasWins': return isPositive(air.c()) && isPositive(air.rho()) && isPositive(Vas_m3) && isPositive(Sd_m2)
                ? routeValue(CMS_FROM_VAS_SD_ROUTE, {Vas_m3, Sd_m2, c_m_per_s: air.c(), roo_kg_per_m3: air.rho()}) : null;
            case 'StatedCmsWins': return null;
        }
    };
    const Cms = fromVas();
    const Cms_m_per_N = Cms ?? input.Cms_m_per_N;
    const Mms = isPositive(Fs_hz) && isPositive(Cms_m_per_N)
        ? routeValue(MMS_FROM_FS_CMS_ROUTE, {Fs_hz, Cms_m_per_N}) : null;
    const Mms_kg = Mms ?? input.Mms_kg;
    const Rms = isPositive(Fs_hz) && isPositive(Qms) && isPositive(Mms_kg)
        ? routeValue(RMS_FROM_FS_MMS_QMS_ROUTE, {Fs_hz, Qms, Mms_kg}) : null;
    const BL = isPositive(Re_terminal_ohm) && isPositive(Fs_hz) && isPositive(Qes) && isPositive(Cms_m_per_N)
        ? routeValue(BL_FROM_QES_CMS_ROUTE, {Re_ohm: Re_terminal_ohm, Fs_hz, Qes, Cms_m_per_N}) : null;
    return {Cms_m_per_N: Cms, Mms_kg: Mms, Rms_kg_per_s: Rms, BL_terminal_Tm: BL};
}
