#!/usr/bin/env node
// Marks a baseline picture as drawn by a visual-retake run (T799). The mark is a PNG tEXt chunk, so the pixels, and
// Playwright's comparison, do not change.
//   node scripts/visual/png-stamp.mjs stamp <run-id> <file.png>...    write the mark
//   node scripts/visual/png-stamp.mjs read <file.png>                 print the run id, or nothing
// check-task.sh reads the mark without node (visual_stamp_run in lib.sh, by the chunk's declared length), so the chunk is
// `openisd-visual-run` NUL `run=<id>` and the 4-byte CRC after it is not part of the id.
import {readFileSync, writeFileSync} from 'node:fs';

const KEY = 'openisd-visual-run';
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TABLE = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function chunks(png) {
  if (!png.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  const out = [];
  for (let at = 8; at < png.length;) {
    const len = png.readUInt32BE(at), type = png.toString('latin1', at + 4, at + 8);
    out.push({type, data: png.subarray(at + 8, at + 8 + len)});
    at += 12 + len;
  }
  return out;
}
const isMark = (c) => c.type === 'tEXt' && c.data.toString('latin1').startsWith(KEY + '\0');
function build(list) {
  const parts = [SIG];
  for (const c of list) {
    const head = Buffer.alloc(8); head.writeUInt32BE(c.data.length, 0); head.write(c.type, 4, 'latin1');
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), c.data])), 0);
    parts.push(head, c.data, tail);
  }
  return Buffer.concat(parts);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'stamp' && /^\d+$/.test(args[0] ?? '') && args.length > 1) {
  const [run, ...files] = args;
  for (const f of files) {
    const list = chunks(readFileSync(f)).filter((c) => !isMark(c));
    const at = list.findIndex((c) => c.type === 'IDAT');
    list.splice(at, 0, {type: 'tEXt', data: Buffer.from(`${KEY}\0run=${run}`, 'latin1')});
    writeFileSync(f, build(list));
  }
} else if (cmd === 'read' && args.length === 1) {
  const m = chunks(readFileSync(args[0])).find(isMark);
  if (m) process.stdout.write(m.data.toString('latin1').split('run=')[1] + '\n');
} else {
  console.error('usage: png-stamp.mjs stamp <run-id> <file.png>... | read <file.png>');
  process.exit(2);
}
