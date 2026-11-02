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
function isPrivateV6(ip) {
  const x = ip.toLowerCase();
  if (x === '::' || x === '::1') return true;
  if (x.startsWith('::ffff:')) return isPrivateV4(x.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
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
