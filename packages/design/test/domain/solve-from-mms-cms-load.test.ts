/**
 * bugs/BUG_20261005_winisd-driver-without-fs-vas-crashes-on-load.md: WinISD dies loading a driver
 * with Fs and Vas at 0. OpenISD loads the golden and every derived driver value is finite and positive.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const goldenPath = join(here, '..', 'winisd', 'fixtures', 'winisd-parity', 'goldens', 'solve-from-mms-cms.wpr');
const DERIVED = ['Fs_hz', 'Vas_m3', 'Qts', 'Qes', 'Rms_kg_per_s', 'Cms_m_per_N', 'EBP_hz'] as const;

function load(text: string) {
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

describe('solve-from-mms-cms project loads', () => {
  it('every derived driver value is finite and positive', () => {
    const driver = load(readFileSync(goldenPath, 'utf8')).driver;
    for (const name of DERIVED) {
      const v = driver.specs[name].value;
      expect(v, name).not.toBeNull();
      expect(Number.isFinite(v), name).toBe(true);
      expect(v as number, name).toBeGreaterThan(0);
    }
  });

  it('with Fs, Vas, Qts, Qes and Rms at 0 in the file, they are derived, not zero', () => {
    const zeroed = readFileSync(goldenPath, 'utf8')
      .replace(/^(Fs|Vas|Qts|Qes|Rms)=.*$/gm, '$1=0');
    const driver = load(zeroed).driver;
    for (const name of ['Fs_hz', 'Vas_m3', 'Qts', 'Qes', 'Rms_kg_per_s'] as const) {
      const v = driver.specs[name].value;
      expect(Number.isFinite(v) && (v as number) > 0, `${name}=${String(v)}`).toBe(true);
    }
  });
});
