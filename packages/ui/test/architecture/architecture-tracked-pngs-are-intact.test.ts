/**
 * T696: a repo-wide word rewrite (29 Sep 2026) also ran over binary files and replaced bytes inside
 * seven tracked PNGs, so the README's driver-library picture and six WinISD captures no longer opened.
 * Every tracked PNG must keep a whole chunk list with correct checksums.
 */
import {describe, expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {crc32} from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The first defect in a PNG file's bytes, or null when every chunk is whole and its CRC matches. */
function pngDefect(bytes: Buffer): string | null {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) return 'bad signature';
  let at = 8;
  while (at < bytes.length) {
    if (at + 12 > bytes.length) return `chunk header cut off at byte ${at}`;
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString('latin1');
    const end = at + 8 + length;
    if (end + 4 > bytes.length) return `${type} chunk cut off at byte ${at}`;
    if (crc32(bytes.subarray(at + 4, end)) !== bytes.readUInt32BE(end)) return `${type} chunk at byte ${at} fails its CRC`;
    if (type === 'IEND') return end + 4 === bytes.length ? null : 'bytes after IEND';
    at = end + 4;
  }
  return 'no IEND chunk';
}

const tracked = execFileSync('git', ['ls-files', '-z', '*.png'], {cwd: ROOT}).toString('utf8').split('\0').filter(Boolean);

describe('every tracked PNG is intact', () => {
  it('finds the tracked pictures', () => {
    expect(tracked.length).toBeGreaterThan(0);
  });

  it('has no PNG whose chunks are cut off or fail their CRC', () => {
    const broken = tracked
      .map(file => ({file, defect: pngDefect(readFileSync(join(ROOT, file)))}))
      .filter(r => r.defect !== null)
      .map(r => `${r.file}: ${r.defect}`);
    expect(broken).toEqual([]);
  });
});
