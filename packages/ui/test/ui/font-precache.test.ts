import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('service-worker precache carries the bundled font (T742, QO466)', () => {
  it('the workbox glob list includes woff2 files', () => {
    const config = readFileSync(new URL('../../../../vite.config.js', import.meta.url), 'utf8');
    const globLine = config.split('\n').find(line => line.includes('globPatterns:'));
    expect(globLine).toBeDefined();
    expect(globLine).toContain('woff2');
  });
});
