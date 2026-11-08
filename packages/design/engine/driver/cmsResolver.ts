/** Which Cms a datasheet that states both Cms and Vas is solved with (WinISD option "Cms from Vas"). */
export type CmsSource =
    | {readonly kind: 'VasWins'}
    | {readonly kind: 'StatedCmsWins'}
    /** No project: a standalone driver shows its stored figures and the engine works nothing out. */
    | {readonly kind: 'StoredShown'};

/** The mechanical figures WinISD's chain works out; null where the chain cannot reach one. */
export interface ShownMechanics {
    readonly Cms_m_per_N: number | null;
    readonly Mms_kg: number | null;
    readonly Rms_kg_per_s: number | null;
    readonly BL_terminal_Tm: number | null;
}
