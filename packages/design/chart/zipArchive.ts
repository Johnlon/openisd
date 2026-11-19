/** One file to put in a ZIP: its path inside the archive and its text. */
export interface ZipEntry {
  readonly name: string;
  readonly text: string;
}

const CRC_TABLE: readonly number[] = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 1 January 1980, 00:00: a fixed stamp, so the same files always give the same bytes. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
/** General purpose bit 11: names are UTF-8. */
const UTF8_FLAG = 0x0800;

/**
 * A ZIP file with every entry stored uncompressed, so no compression library is needed and the
 * archive works offline; any unzip tool opens it.
 */
export class ZipArchive {
  static store(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
    const enc = new TextEncoder();
    const parts: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    const header = (size: number, write: (v: DataView) => void): Uint8Array<ArrayBuffer> => {
      const buf = new Uint8Array(size);
      write(new DataView(buf.buffer));
      return buf;
    };
    for (const entry of entries) {
      const name = enc.encode(entry.name);
      const data = enc.encode(entry.text);
      const crc = crc32(data);
      const local = header(30, v => {
        v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, UTF8_FLAG, true);
        v.setUint16(8, 0, true); v.setUint16(10, DOS_TIME, true); v.setUint16(12, DOS_DATE, true);
        v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true);
        v.setUint16(26, name.length, true); v.setUint16(28, 0, true);
      });
      central.push(header(46, v => {
        v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true);
        v.setUint16(8, UTF8_FLAG, true); v.setUint16(10, 0, true); v.setUint16(12, DOS_TIME, true);
        v.setUint16(14, DOS_DATE, true); v.setUint32(16, crc, true); v.setUint32(20, data.length, true);
        v.setUint32(24, data.length, true); v.setUint16(28, name.length, true);
        v.setUint32(42, offset, true);
      }), name);
      parts.push(local, name, data);
      offset += local.length + name.length + data.length;
    }
    const centralSize = central.reduce((n, p) => n + p.length, 0);
    const end = header(22, v => {
      v.setUint32(0, 0x06054b50, true); v.setUint16(8, entries.length, true); v.setUint16(10, entries.length, true);
      v.setUint32(12, centralSize, true); v.setUint32(16, offset, true);
    });
    const all = [...parts, ...central, end];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of all) { out.set(p, at); at += p.length; }
    return out;
  }
}
