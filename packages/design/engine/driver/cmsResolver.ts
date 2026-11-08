/** Which Cms a datasheet that states both Cms and Vas is solved with (WinISD option "Cms from Vas"). */
export type CmsSource =
    | {readonly kind: 'VasWins'}
    | {readonly kind: 'StatedCmsWins'};

/** The one Cms rule. `stated` is the Cms the driver carries; `fromVas` is the Cms its Vas and Sd work out.
 *  VasWins takes the worked-out value and falls back to the stated one; StatedCmsWins the reverse. */
export function resolveCms(source: CmsSource, stated: number | null, fromVas: number | null): number | null {
    switch (source.kind) {
        case 'VasWins': return fromVas ?? stated;
        case 'StatedCmsWins': return stated ?? fromVas;
    }
}
