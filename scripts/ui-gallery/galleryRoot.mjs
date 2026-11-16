// Where the UI gallery lives: the workspace folder next to the repo (<repo>/../ui-gallery), found from this
// file's own location. Never a home path: the project runs on two machines (/home/john and /home/johnl).
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function galleryRootOf(repoRoot) {
  return path.resolve(repoRoot, '..', 'ui-gallery');
}

export function galleryRoot() {
  return galleryRootOf(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
}
