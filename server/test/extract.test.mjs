import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { extractText } from '../lib/extract.mjs';

// Build a small ZIP (deflate) in memory.
function zip(files) {
  const locals = []; const centrals = []; let off = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8'); const comp = deflateRawSync(data); const n = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, n, comp); centrals.push(ch, n); off += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}

test('plain text and unknown-extension UTF-8 are read in full', async () => {
  const r = await extractText(Buffer.from('سلام\nدنیا'), 'a.txt', 'text/plain');
  assert.equal(r.status, 'ok'); assert.equal(r.text, 'سلام\nدنیا');
  assert.equal((await extractText(Buffer.from('k=v'), 'x.weird', '')).status, 'ok');
});

test('docx: paragraphs become lines', async () => {
  const doc = zip({ 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>بند اول</w:t></w:r></w:p><w:p><w:r><w:t>second &amp; more</w:t></w:r></w:p></w:body></w:document>' });
  const r = await extractText(doc, 'a.docx', '');
  assert.equal(r.status, 'ok'); assert.match(r.text, /بند اول\n+second & more/);
});

test('xlsx: shared strings and numbers, per sheet', async () => {
  const x = zip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="برگه۱" sheetId="1"/></sheets></workbook>',
    'xl/sharedStrings.xml': '<sst><si><t>سوره</t></si><si><t>آیه</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>2</v></c><c r="B2"><v>255</v></c></row></sheetData></worksheet>',
  });
  const r = await extractText(x, 'a.xlsx', '');
  assert.equal(r.status, 'ok'); assert.match(r.text, /## برگه۱\nسوره\tآیه\n2\t255/);
});

test('plain zip: lists entries and reads each with its own reader', async () => {
  const r = await extractText(zip({ 'a.txt': 'alpha', 'dir/b.md': '# beta' }), 'pack.zip', 'application/zip');
  assert.equal(r.status, 'ok'); assert.match(r.text, /alpha/); assert.match(r.text, /# beta/); assert.match(r.text, /2 فایل/);
});

test('images, audio and broken files are never reported as read', async () => {
  assert.equal((await extractText(Buffer.from([0x89, 0x50]), 'a.png', 'image/png')).status, 'image');
  assert.equal((await extractText(Buffer.from([1, 2, 3]), 'a.mp3', 'audio/mpeg')).status, 'unsupported');
  assert.equal((await extractText(Buffer.from('not a zip'), 'a.docx', '')).status, 'failed');
  assert.equal((await extractText(Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x00, 0x00]), 'a.bin', '')).status, 'unsupported');
});

test('pdf with a text layer is extracted page by page', async () => {
  const c = Buffer.from('BT /F1 24 Tf 72 720 Td (Hello PDF) Tj ET');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${c.length} >>\nstream\n${c}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  const r = await extractText(Buffer.from(out, 'latin1'), 'a.pdf', 'application/pdf');
  assert.equal(r.status, 'ok', r.note); assert.match(r.text, /Hello PDF/); assert.equal(r.page_count, 1);
});
