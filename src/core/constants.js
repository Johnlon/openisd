'use strict';
// Physical constants for the acoustical model.
const RHO = 1.184;   // air density  kg/m^3  (20 °C)
const C   = 345.0;   // speed of sound  m/s
const P0  = 20e-6;   // reference SPL pressure  Pa  (0 dB)

const API = { RHO, C, P0 };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.R = Object.assign(window.R || {}, API);
