// Minimal, dependency-free ZIP reader (stored + deflate). Used to extract the text of
// attachments that are ZIP containers: docx/xlsx/pptx, odt/ods/odp, epub and plain .zip.
// Hard caps keep a hostile archive (zip bomb, millions of entries) from exhausting memory.
import { inflateRawSync } from 'node:zlib';

export const ZIP_LIMITS = { maxEntries: 2000, maxEntryBytes: 40 * 1024 * 1024, maxTotalBytes: 80 * 1024 * 1024 };

export function isZip(buf) {
  return buf && buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50;
}

// Returns [{ name, size, read(): Buffer }] — read() inflates lazily and enforces the caps.
export function listZip(buf, limits = ZIP_LIMITS) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (count > limits.maxEntries) throw new Error(`zip has ${count} entries (limit ${limits.maxEntries})`);
  const out = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    out.push({
      name, size: usize, method,
      read() {
        if (usize > limits.maxEntryBytes) throw new Error(`entry ${name} too large (${usize} bytes)`);
        total += usize;
        if (total > limits.maxTotalBytes) throw new Error('zip expands beyond the extraction limit');
        if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('corrupt zip local header');
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const data = buf.subarray(start, start + csize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data, { maxOutputLength: limits.maxEntryBytes });
        throw new Error(`unsupported zip compression method ${method} in ${name}`);
      },
    });
  }
  return out;
}
