/** The engine's circuit model from the project's two switches: "Simulate voice coil inductance"
 *  (the stored `circuitModel`, 'winisd' = off) and "Enable WinISD two-BL driver bug", which picks
 *  WinISD's inductance model over the textbook one (John, 2026-09-26: one switch for WinISD's
 *  two-BL handling). A stored 'winisdGyrator' (projects saved before that ruling) reads as on. */
export function engineCircuitModel(stored: 'winisd' | 'gyrator' | 'winisdGyrator', winisdDriverModel: boolean): 'winisd' | 'gyrator' | 'winisdGyrator' {
    if (stored === 'winisd') return 'winisd';
    return winisdDriverModel ? 'winisdGyrator' : 'gyrator';
}
