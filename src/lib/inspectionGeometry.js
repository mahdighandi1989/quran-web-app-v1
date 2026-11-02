// Where exactly did the owner draw the box? Pixels alone are not enough (layouts move), so a
// sheet records: document coordinates + viewport/dpr/scroll, AND the element under the box
// (a CSS selector verified to round-trip) with the box as FRACTIONS of that element.
// Fractions are measured from the element's LEFT edge, even in an RTL page.

const esc = (s) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, (c) => `\\${c}`));

// A short, unique selector for `el` that resolves back to it (or '' if none can be built).
export function cssPath(el, root = document) {
  if (!el || el.nodeType !== 1) return '';
  if (el.id && root.querySelectorAll(`#${esc(el.id)}`).length === 1) return `#${esc(el.id)}`;
  const tid = el.getAttribute && el.getAttribute('data-testid');
  if (tid && root.querySelectorAll(`[data-testid="${tid}"]`).length === 1) return `[data-testid="${tid}"]`;
  const parts = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && cur !== root.documentElement) {
    if (cur.id && root.querySelectorAll(`#${esc(cur.id)}`).length === 1) { parts.unshift(`#${esc(cur.id)}`); break; }
    const tag = cur.tagName.toLowerCase();
    const parent = cur.parentElement;
    if (!parent) { parts.unshift(tag); break; }
    const same = [...parent.children].filter((c) => c.tagName === cur.tagName);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    const sel = parts.join(' > ');
    try { if (root.querySelectorAll(sel).length === 1 && root.querySelector(sel) === el) return sel; } catch { /* keep climbing */ }
    cur = parent;
  }
  const sel = parts.join(' > ');
  try { return root.querySelector(sel) === el ? sel : ''; } catch { return ''; }
}

// The smallest element that contains the whole box (viewport coords), skipping our own overlay.
export function anchorFor(box, { root = document, ignore } = {}) {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  let el = root.elementFromPoint ? root.elementFromPoint(cx, cy) : null;
  while (el && ignore && ignore(el)) el = el.parentElement;
  while (el && el.parentElement) {
    const r = el.getBoundingClientRect();
    if (r.left <= box.x + 1 && r.top <= box.y + 1 && r.right >= box.x + box.w - 1 && r.bottom >= box.y + box.h - 1) break;
    el = el.parentElement;
  }
  return el || null;
}

export function fractionsOf(box, el) {
  const r = el.getBoundingClientRect();
  const w = r.width || 1, h = r.height || 1;
  const round = (x) => Math.round(x * 1000) / 1000;
  return { fx: round((box.x - r.left) / w), fy: round((box.y - r.top) / h), fw: round(box.w / w), fh: round(box.h / h) };
}

// The full record sent with a sheet. `box` is in VIEWPORT coordinates.
export function describeSpot(box, { win = window, root = document, ignore, pageLabel = '' } = {}) {
  const anchorEl = anchorFor(box, { root, ignore });
  const selector = anchorEl ? cssPath(anchorEl, root) : '';
  let verified = false;
  try { verified = !!selector && root.querySelector(selector) === anchorEl; } catch { verified = false; }
  const covered = anchorEl ? String(anchorEl.innerText || anchorEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1500) : '';
  return {
    path: win.location.pathname,
    page_label: pageLabel,
    title: root.title || '',
    rect: { x: Math.round(box.x + win.scrollX), y: Math.round(box.y + win.scrollY), w: Math.round(box.w), h: Math.round(box.h) },
    viewport: { w: win.innerWidth, h: win.innerHeight, dpr: win.devicePixelRatio || 1, sx: Math.round(win.scrollX), sy: Math.round(win.scrollY) },
    covered_text: covered,
    anchor: anchorEl ? { selector, verified, tag: anchorEl.tagName.toLowerCase(), ...fractionsOf(box, anchorEl) } : null,
  };
}

// Where to draw a saved sheet's highlight now (viewport coords): via its anchor if it still
// resolves, else its stored document rectangle.
export function placeSpot(spot, { win = window, root = document } = {}) {
  if (!spot) return null;
  const a = spot.anchor;
  if (a && a.selector) {
    let el = null;
    try { el = root.querySelector(a.selector); } catch { el = null; }
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + a.fx * r.width, y: r.top + a.fy * r.height, w: Math.max(8, a.fw * r.width), h: Math.max(8, a.fh * r.height), via: 'anchor' };
    }
  }
  const rect = spot.rect || {};
  return { x: rect.x - win.scrollX, y: rect.y - win.scrollY, w: Math.max(8, rect.w), h: Math.max(8, rect.h), via: 'rect' };
}
