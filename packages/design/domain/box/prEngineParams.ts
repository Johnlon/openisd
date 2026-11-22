
/** A T/S field of the chosen passive radiator, out of its own `passive-radiator` spec section.
 *  Same not-chosen handling as `prMeta`, plus the section invariant `OpenISDPassiveRadiator`
 *  already guarantees: a record that reached `configurePR()` came through that class, which
 *  refuses to construct without the section, so it is present whenever a component is. */

/** The parameters required to solve passive radiator tuning and mass. */
export interface PrEngineParams {
    Vb: number;
    prMmd: number;
    prMadd: number;
    prSd: number;
    prCms: number;
}
