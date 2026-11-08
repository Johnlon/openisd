import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {cmsSourceOf} from '../../domain/project/cmsSource.js';
import type {CmsSource} from '../../domain/project/cmsSource.js';
import {createEngine} from '../../engine/Engine.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const W5 = {
  Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
  BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, Rms_kg_per_s: 2.2881560650261163,
  Xmax_m: 0.00925, Pe_W: 40,
};
const engine = createEngine();
const build = () => new ProjectBuilder(driverFromSpec(engine, W5), engine).sealed().volume_m3(0.00448).build();

/** Exhaustive: adding a variant to CmsSource fails the typecheck here. */
const label = (s: CmsSource): string => {
  switch (s.kind) {
    case 'VasWins': return 'vas';
    case 'StatedCmsWins': return 'stated';
    case 'StoredShown': return 'stored';
  }
};

describe('CmsSource', () => {
  it('switch ticked (the default) maps to VasWins', () => {
    expect(label(cmsSourceOf(build()))).toBe('vas');
  });

  it('switch unticked maps to StatedCmsWins', () => {
    const p = build();
    p.winisdCmsFromVas.set(false);
    expect(label(cmsSourceOf(p))).toBe('stated');
  });

  it('no other source file reads the Cms from Vas switch', () => {
    const root = resolve(__dirname, '../../..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
      if (n === 'node_modules' || n === 'test' || n.startsWith('.')) return [];
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|vue)$/.test(n) ? [p] : [];
    });
    const readers = walk(root)
      .filter(f => /CMS_FROM_VAS\.of\b|\.winisdCmsFromVas\.value\b/.test(readFileSync(f, 'utf8')))
      .map(f => relative(root, f))
      .sort();
    expect(readers).toEqual(['design/domain/project/cmsSource.ts']);
  });
});
