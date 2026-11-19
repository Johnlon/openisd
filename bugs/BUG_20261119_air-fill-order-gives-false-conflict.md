# BUG_20261119_air-fill-order-gives-false-conflict

**Status:** FIXED (T936)

## Symptom
After the Advanced tab's air reset, typing temperature 293.15 K and air density 1.1 kg/m3 marks every air field "disagree by 4.3%" and sweeps with c 359.11 m/s, where typing the humidity the app already shows (30 %) gives p 92830 Pa, c 343.73 m/s and no note.

## Evidence
Found by the Gemini (agy) engine review, checked 19 Nov 2026.

| humidity       | p (Pa)  | c (m/s) | note on every air field                          |
| -------------- | ------- | ------- | ------------------------------------------------ |
| left blank     | 101325  | 359.11  | "tempK, humidityPct, pressurePa, c disagree by 4.3%" |
| typed as 30 %  | 92830   | 343.73  | none                                             |

Two typed values cannot conflict here, and the answer must not depend on whether a value the app already shows was typed. c 4.5 % high puts Cab = Vb/(ρc²) about 9 % off. No WinISD equivalent: WinISD only calculates c and ρ from T, p and humidity (a typed density solving the others is OpenISD's own feature).

## Cause
`solveAir` (`packages/design/engine/environment/airSolver.ts`) filled the app's values in the order pressure, humidity, temperature. Pressure filled first let the density relation solve c, which then over-determined the sound relation once humidity was filled. The coupled solve (T, humidity, ρ -> p, c), written for this case, only runs when humidity is known before pressure is filled.

## Fix
Fill order humidity, pressure, temperature: temperature stays last (so a typed c still solves it), and the coupled solve now runs.

## Tests
`packages/design/test/domain/project-air.test.ts`, "air reset, then temperature and density typed": p 92780-92880 Pa, c 343.73 m/s, no disagreement; the same result with humidity 30 % typed.
