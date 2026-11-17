/**
 * The Vas relation, Vas = ρ·c²·Sd²·Cms, against sheets that print Cms to one or two digits
 * (John, 14 Nov 2026, QO923; winisd_tools/reports/dq/DQ_vas_20261115.md).
 *
 * The check lets every input lie anywhere within its printed value ± half a unit in the last printed
 * digit and flags a record only when the two intervals do not overlap. The sheets never print the
 * air their Vas was worked out in, and ρ·c² = γ·p depends on the pressure alone: the app's air
 * (20 °C, 30 % RH, 101325 Pa) gives ρ·c² = 1.4 × 101325 = 141855 Pa. The 619 catalogue records that
 * print Vas, Cms and Sd to within 2 % of their own value imply ρ·c² between 138.8 kPa (1.18 kg/m³ at
 * 343 m/s, a common convention: 79 records sit in 138 to 140) and about 144 kPa, median 141.6 kPa
 * (the sheets are not wrong, their air differs). The check therefore also lets ρ·c² be anywhere within
 * 2.5 % of the app's (pressure 98.8 to 103.9 kPa), which takes in both ends.
 *
 * Every expected number is worked out by hand from the printed figures; sources are the records'
 * `manufacturer_product_page` readings.
 */
import {describe, expect, it} from 'vitest';
import type {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {printedRecord, projectPrinted, type Printed} from '../fixtures/printedRecord.js';

const vasIssues = (d: OpenISDDriver) => d.issues().filter(i => i.kind === 'inconsistent-inputs' && i.target === 'Vas_m3');
const sheet = (vas: Printed, cms: Printed, sd: Printed) => projectPrinted(printedRecord('Test', {Vas_m3: vas, Cms_m_per_N: cms, Sd_m2: sd}));

// SI figures: 1 dm³ = 1e-3 m³, 1 mm/N = 1e-3 m/N, 1 cm² = 1e-4 m².
describe('Vas against printed precision at the app\'s air (rho c^2 = 141855 Pa)', () => {
  it('FaitalPRO 12FH510-8 (https://faitalpro.com/en/products/LF_Loudspeakers/product_details/index.php?id=151050105): Vas 81.3 dm3, Cms 0.21 mm/N, Sd 533 cm2 agree', () => {
    // Lowest Vas the sheet allows at the app's air: 141855 x (0.05325 m2)^2 x 0.205e-3 = 82.46 dm3; the highest printed is 81.35.
    // They miss by 1.1 dm3 (1.3 %) at 141855 Pa; they meet at 141855 x 81.35/82.46 = 139.9 kPa, 1.4 % lower, inside the 2.5 % air range.
    const d = sheet(
      {text: '81.3 dm^3 (2.87 ft^3)', value: 0.0813, precision: 5e-5},
      {text: '0.21 mm/N', value: 0.00021, precision: 5e-6},
      {text: '533 cm^2 (82.62 in^2)', value: 0.0533, precision: 5e-5});
    expect(vasIssues(d)).toEqual([]);
  });

  it('FaitalPRO 15HP1030-8 (...datasheet.php?id=201060135): Vas 95.0 dm3, Cms 0.10 mm/N, Sd 842 cm2 agree', () => {
    // Lowest implied Vas: 141855 x (0.08415)^2 x 0.095e-3 = 95.43 dm3 against printed 95.05 at most: 0.4 % apart, meeting at 141.3 kPa.
    const d = sheet(
      {text: '95.0 dm^3 (3.35 ft^3)', value: 0.095, precision: 5e-5},
      {text: '0.10 mm/N', value: 0.0001, precision: 5e-6},
      {text: '842 cm^2 (130.51 in^2)', value: 0.0842, precision: 5e-5});
    expect(vasIssues(d)).toEqual([]);
  });

  it('FaitalPRO 6PR130-8 (...datasheet.php?id=101020155): Vas 4.2 dm3 against 2.17 dm3 implied stays flagged', () => {
    // 141855 x (0.014795)^2 x 0.07e-3 = 2.1736e-3 m3 = 2.17 dm3; the most the printed digits allow (Cms 0.075) is 2.33 dm3,
    // and the 2.5 % air range lifts that to 2.39: all below the printed 4.2 - 0.05 = 4.15 dm3.
    const d = sheet(
      {text: '4.2 dm^3 (0.15 ft^3)', value: 0.0042, precision: 5e-5},
      {text: '0.07 mm/N', value: 0.00007, precision: 5e-6},
      {text: '147.95 cm^2 (22.93 in^2)', value: 0.014795, precision: 5e-7});
    const issues = vasIssues(d);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({kind: 'inconsistent-inputs', actual: 0.0042});
    if (issues[0].kind === 'inconsistent-inputs') expect(issues[0].expected).toBeCloseTo(2.1736e-3, 6);
  });

  it('Morel SCW636 (https://www.morelhifi.com/filecont/SCW636.pdf): Vas 18.5 l, Cms 0.969 mm/N, Sd 119 cm2 stays flagged', () => {
    // 141855 x (0.0119)^2 x 0.969e-3 = 19.47 l. Printed digits and the air range together reach down to
    // 19.47 x (1 - 0.0005 - 0.0086 - 0.025) = 18.8 l, above the printed 18.5 + 0.05 = 18.55 l.
    const d = sheet(
      {text: '18.5 Lt', value: 0.0185, precision: 5e-5},
      {text: '0.969mm/N', value: 0.000969, precision: 5e-7},
      {text: '119 cm ²', value: 0.0119, precision: 5e-5});
    expect(vasIssues(d)).toHaveLength(1);
  });
});

describe('the air range the Vas check allows is 2.5 % of rho c^2, no more', () => {
  // A sheet printing Cms 0.5000 mm/N (+-0.00005), Sd 100.0 cm2 (+-0.05): the app's air implies
  // 141855 x (0.01)^2 x 0.5e-3 = 7.09275e-3 m3 = 7.093 dm3. Rounding allows 0.01 % (Cms) + 2 x 0.05 % (Sd) = 0.11 % around it.
  const cms: Printed = {text: '0.5000 mm/N', value: 0.0005, precision: 5e-8};
  const sd: Printed = {text: '100.0 cm^2', value: 0.01, precision: 5e-6};
  const vas = (dm3: number): Printed => ({text: `${dm3} dm^3`, value: dm3 / 1000, precision: 5e-7});

  it('7.093 dm3, the app\'s own air, agrees', () => expect(vasIssues(sheet(vas(7.093), cms, sd))).toEqual([]));
  it('7.20 dm3, 1.5 % above (rho c^2 = 144 kPa), agrees', () => expect(vasIssues(sheet(vas(7.2), cms, sd))).toEqual([]));
  it('6.95 dm3, 2.0 % below (rho c^2 = 139 kPa, 1.18 x 343^2 is 138.8), agrees', () => expect(vasIssues(sheet(vas(6.95), cms, sd))).toEqual([]));
  it('7.30 dm3, 2.9 % above, is flagged', () => expect(vasIssues(sheet(vas(7.3), cms, sd)).length).toBe(1));
  it('6.85 dm3, 3.4 % below, is flagged', () => expect(vasIssues(sheet(vas(6.85), cms, sd)).length).toBe(1));
});
