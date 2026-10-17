import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELLS = join(HERE, '..', '..', 'src', 'ui', 'shells');
const read = (path: string): string => readFileSync(join(SHELLS, path), 'utf8');

describe('architecture: fields bound to project cells are UIField rows', () => {
  it('the phone Advanced and Enclosure tabs draw no <NumInput>', () => {
    for (const file of ['mobile/MobileAdvancedTab.vue', 'mobile/MobileEnclosureTab.vue']) {
      expect(read(file).includes('<NumInput'), `${file} draws a number box by hand`).toBe(false);
    }
  });

  it('the desktop environment fields (temperature, humidity, pressure) are UISettlingField rows', () => {
    expect(read('original/OriginalShell.vue')).not.toMatch(/<NumInput v-model="adv(Temp|Humidity|Pressure)"/);
  });
});
