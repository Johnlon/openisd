// THE SEARCH FACILITY'S PUBLIC SURFACE.
//
// Two enums, exported as VALUES — unlike the domain's classes, a caller must be able to reach
// `DriverType.Subwoofer` and `Chip.Bass` at runtime, which is the entire point of an enum.
export { DriverType, Chip } from './driverType.js';
