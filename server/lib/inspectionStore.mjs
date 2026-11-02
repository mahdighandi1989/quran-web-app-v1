// Storage for the inspection board. Two implementations with the SAME interface:
//   firestoreStore(db) — production (Firebase Admin; collections below are closed to clients
//                        by firestore.rules' default deny, so only this server reads/writes them)
//   memoryStore()      — tests
//
// Collections: inspectionReports/{number} · inspectionFiles/{id} · inspectionBlobs/{id}
//              inspectionBlobChunks/{id}_{seq} · inspectionMeta/{name}
// Bytes (screenshots and attachments) are chunked: a Firestore document is capped at 1 MiB and a
// batch commit at 10 MiB, and Render's container disk is wiped on every deploy.
import crypto from 'node:crypto';

export const CHUNK_BYTES = 700 * 1024;
const clean = (o) => JSON.parse(JSON.stringify(o)); // Firestore rejects `undefined`

export function memoryStore() {
  const reports = new Map(); const files = new Map(); const blobs = new Map(); const meta = new Map();
  let counter = 0;
  return {
    kind: 'memory',
    async nextNumber() { counter += 1; return counter; },
    async getReport(n) { const r = reports.get(Number(n)); return r ? clean(r) : null; },
    async putReport(r) { reports.set(Number(r.number), clean(r)); },
    async updateReport(n, mutate) {
      const cur = reports.get(Number(n));
      if (!cur) return mutate(null);
      const draft = clean(cur);
      const res = await mutate(draft);
      reports.set(Number(n), clean(draft));
      return res;
    },
    async listReports() { return [...reports.values()].map(clean).sort((a, b) => b.number - a.number); },
    async putFile(f) { files.set(f.id, clean(f)); },
    async getFile(id) { const f = files.get(id); return f ? clean(f) : null; },
    async updateFile(id, mutate) { const f = clean(files.get(id)); const r = await mutate(f); files.set(id, clean(f)); return r; },
    async listFiles(number) { return [...files.values()].filter((f) => f.report_number === Number(number)).map(clean); },
    async putBlob(id, buf, mime) { blobs.set(id, { mime, data: Buffer.from(buf) }); return { size: buf.length, sha256: sha(buf) }; },
    async getBlob(id) { const b = blobs.get(id); return b ? { mime: b.mime, data: Buffer.from(b.data) } : null; },
    async getMeta(name) { return clean(meta.get(name) || {}); },
    async setMeta(name, obj) { meta.set(name, clean(obj)); },
  };
}

export const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function firestoreStore(db) {
  const C = (n) => db.collection(n);
  return {
    kind: 'firestore',
    async nextNumber() {
      return db.runTransaction(async (t) => {
        const ref = C('inspectionMeta').doc('counter');
        const s = await t.get(ref);
        const n = ((s.exists && s.data().last) || 0) + 1;
        t.set(ref, { last: n }, { merge: true });
        return n;
      });
    },
    async getReport(n) { const s = await C('inspectionReports').doc(String(n)).get(); return s.exists ? s.data() : null; },
    async putReport(r) { await C('inspectionReports').doc(String(r.number)).set(clean(r)); },
    // Read-modify-write inside a transaction so two writers (owner + supervisor) never lose an update.
    async updateReport(n, mutate) {
      return db.runTransaction(async (t) => {
        const ref = C('inspectionReports').doc(String(n));
        const s = await t.get(ref);
        if (!s.exists) return mutate(null);
        const draft = s.data();
        const res = await mutate(draft);
        t.set(ref, clean(draft));
        return res;
      });
    },
    async listReports() {
      const q = await C('inspectionReports').orderBy('number', 'desc').limit(1000).get();
      return q.docs.map((d) => d.data());
    },
    async putFile(f) { await C('inspectionFiles').doc(f.id).set(clean(f)); },
    async getFile(id) { const s = await C('inspectionFiles').doc(String(id)).get(); return s.exists ? s.data() : null; },
    async updateFile(id, mutate) {
      return db.runTransaction(async (t) => {
        const ref = C('inspectionFiles').doc(String(id));
        const s = await t.get(ref);
        const f = s.exists ? s.data() : null;
        const r = await mutate(f);
        if (f) t.set(ref, clean(f));
        return r;
      });
    },
    async listFiles(number) {
      const q = await C('inspectionFiles').where('report_number', '==', Number(number)).get();
      return q.docs.map((d) => d.data()).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    },
    async putBlob(id, buf, mime) {
      const n = Math.max(1, Math.ceil(buf.length / CHUNK_BYTES));
      for (let start = 0; start < n; start += 10) { // ≤ 10 chunks (7 MB) per batch: under the 10 MiB commit cap
        const batch = db.batch();
        for (let i = start; i < Math.min(n, start + 10); i++) {
          batch.set(C('inspectionBlobChunks').doc(`${id}_${i}`), { blob: id, seq: i, data: buf.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES) });
        }
        await batch.commit();
      }
      const digest = sha(buf);
      await C('inspectionBlobs').doc(id).set({ mime, size: buf.length, chunks: n, sha256: digest, created_at: new Date().toISOString() });
      return { size: buf.length, sha256: digest };
    },
    async getBlob(id) {
      const m = await C('inspectionBlobs').doc(String(id)).get();
      if (!m.exists) return null;
      const { mime, chunks, sha256 } = m.data();
      const refs = Array.from({ length: chunks }, (_, i) => C('inspectionBlobChunks').doc(`${id}_${i}`));
      const snaps = await db.getAll(...refs);
      if (snaps.some((s) => !s.exists)) throw new Error('بخشی از بایت‌های فایل در Firestore پیدا نشد');
      const data = Buffer.concat(snaps.map((s) => Buffer.from(s.data().data)));
      if (sha(data) !== sha256) throw new Error('بایت‌های بازخوانده‌شده با هشِ ذخیره‌شده نمی‌خواند');
      return { mime, data };
    },
    async getMeta(name) { const s = await C('inspectionMeta').doc(name).get(); return s.exists ? s.data() : {}; },
    async setMeta(name, obj) { await C('inspectionMeta').doc(name).set(clean(obj)); },
  };
}
