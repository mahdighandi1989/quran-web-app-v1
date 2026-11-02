// Outbound-URL guard for the AI proxy (SSRF). A guest — or a signed-in user's stored "custom
// provider" — chooses the base URL the SERVER then fetches. Without a guard, anyone could make this
// server call internal addresses (cloud metadata 169.254.169.254, localhost admin ports, private
// networks). Rule: https only, no credentials in the URL, and every address the host resolves to
// must be public. Built-in provider hosts pass the same check.
import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {}

function isPrivateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
// Expand any IPv6 text form (incl. '::', dotted tail) to 8 numbers.
function v6hextets(ip) {
  let x = ip.toLowerCase().split('%')[0];
  const dotted = x.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    x = x.slice(0, -dotted[1].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail] = x.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail ? tail.split(':') : [];
  const fill = x.includes('::') ? 8 - h.length - t.length : 0;
  return [...h, ...Array(fill).fill('0'), ...t].map((p) => parseInt(p || '0', 16));
}
function isPrivateV6(ip) {
  const w = v6hextets(ip);
  if (w.length !== 8 || w.some((n) => Number.isNaN(n))) return true;
  const v4 = () => `${w[6] >> 8}.${w[6] & 255}.${w[7] >> 8}.${w[7] & 255}`;
  const zero = (n) => w.slice(0, n).every((v) => v === 0);
  if (zero(8) || (zero(7) && w[7] === 1)) return true;                       // :: and ::1
  if (zero(5) && w[5] === 0xffff) return isPrivateV4(v4());                 // ::ffff:a.b.c.d (mapped)
  if (zero(6)) return isPrivateV4(v4());                                    // ::a.b.c.d (compat)
  if (w[0] === 0x64 && w[1] === 0xff9b) return isPrivateV4(v4());           // 64:ff9b::/96 (NAT64)
  if (w[0] === 0x2002) return isPrivateV4(`${w[1] >> 8}.${w[1] & 255}.${w[2] >> 8}.${w[2] & 255}`); // 6to4
  return (w[0] & 0xfe00) === 0xfc00 || (w[0] & 0xffc0) === 0xfe80 || (w[0] & 0xff00) === 0xff00; // ULA, link-local, multicast
}
export function isPrivateAddress(ip) {
  return net.isIPv4(ip) ? isPrivateV4(ip) : net.isIPv6(ip) ? isPrivateV6(ip) : true;
}

export async function assertPublicHttpsUrl(raw, { lookup = (h) => dns.lookup(h, { all: true, verbatim: true }) } = {}) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new UnsafeUrlError('آدرسِ پایهٔ پروایدر نامعتبر است'); }
  if (u.protocol !== 'https:') throw new UnsafeUrlError('آدرسِ پایهٔ پروایدر باید https باشد');
  if (u.username || u.password) throw new UnsafeUrlError('آدرسِ پایه نباید نام‌کاربری/رمز داشته باشد');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new UnsafeUrlError('آدرسِ داخلی مجاز نیست');
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host).catch(() => { throw new UnsafeUrlError(`نامِ «${host}» resolve نشد`); });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError('آدرسِ داخلی/خصوصی مجاز نیست');
  return u;
}

// Fixed-window limiter per key (IP). Small and in-memory: one instance on Render.
export function createRateLimiter({ max = 30, windowMs = 60_000 } = {}) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const xs = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (xs.length >= max) { hits.set(key, xs); return false; }
    xs.push(now); hits.set(key, xs);
    if (hits.size > 5000) for (const k of hits.keys()) { hits.delete(k); if (hits.size < 2500) break; }
    return true;
  };
}
