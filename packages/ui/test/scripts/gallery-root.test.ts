import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {galleryRoot, galleryRootOf} from '../../../../scripts/ui-gallery/galleryRoot.mjs';

const REPO_ROOT = resolve(__dirname, '../../../..');

describe('gallery root', () => {
  it('is the ui-gallery folder next to the repo', () => {
    expect(galleryRootOf('/work/winisd/openisd')).toBe('/work/winisd/ui-gallery');
  });

  it('is found from the repo the script sits in, on any machine', () => {
    expect(galleryRoot()).toBe(resolve(REPO_ROOT, '..', 'ui-gallery'));
  });
});
