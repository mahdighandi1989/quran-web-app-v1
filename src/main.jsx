
// 🌉 Inspector Bridge Script - Auto-injected
// Version: 2.4
// ارتباط با Inspector از طریق WebSocket (حل مشکل cross-origin)
/* eslint-disable */
// @ts-nocheck
if (typeof window !== 'undefined' && !window.__inspectorBridgeLoaded) {
  // @ts-ignore
  window.__inspectorBridgeLoaded = true;

  const isInIframe = window !== window.parent;
  const WS_URL = 'wss://ai-creator-backend-q677.onrender.com/api/render/ws/bridge/gh_mahdighandi1989_quran_web_app_v1';
  let ws = null;
  let wsReady = false;
  let messageQueue = [];

  console.log('🌉 Inspector Bridge: Active (WebSocket mode)');

  // Debounce
  const DEBOUNCE_MS = 100;
  let lastEventTime = 0;
  let messagesSent = 0;
  const shouldSend = () => {
    const now = Date.now();
    if (now - lastEventTime < DEBOUNCE_MS) return false;
    lastEventTime = now;
    return true;
  };

  // اتصال WebSocket
  const connectWS = () => {
    if (!WS_URL || WS_URL === 'wss://ai-creator-backend-q677.onrender.com/api/render/ws/bridge/gh_mahdighandi1989_quran_web_app_v1') return;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => { ws.send(JSON.stringify({ type: 'register', role: 'bridge' })); };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'registered') {
            wsReady = true;
            console.log('🌉 Inspector Bridge: WebSocket connected');
            messageQueue.forEach(m => ws.send(JSON.stringify(m)));
            messageQueue = [];
            ws.send(JSON.stringify({ type: 'inspector-bridge-ready', pageUrl: window.location.href, isInIframe, timestamp: Date.now() }));
          } else if (msg.type === 'command') {
            handleCommand(msg);
          }
        } catch (e) {}
      };
      ws.onclose = () => { wsReady = false; setTimeout(connectWS, 3000); };
      ws.onerror = () => {};
    } catch (e) {}
  };

  // اعتبارسنجی ورودی دستورات Inspector (دفاع لایه‌ای در برابر XSS و Open Redirect):
  // selector فقط کاراکترهای مجاز CSS و طول محدود؛ navigate فقط آدرس مطلقِ https.
  const sanitizeSelector = (sel) => (typeof sel === 'string' ? sel.slice(0, 200).replace(/[^\w\s#.\-\[\]="':>~+*(),|^$]/g, '') : '');
  const isSafeNavigationUrl = (url) => {
    if (typeof url !== 'string' || !url) return false;
    try { return new URL(url).protocol === 'https:'; } catch (e) { return false; }
  };
  const handleCommand = (msg) => {
    if (msg.command === 'click') {
      const safe = sanitizeSelector(msg.selector);
      if (!safe) return;
      let el = null;
      try { el = document.querySelector(safe); } catch (e) { el = null; }
      if (el) el.click();
    } else if (msg.command === 'navigate') {
      if (isSafeNavigationUrl(msg.url)) window.location.assign(msg.url);
    } else if (msg.command === 'get-elements') {
      const elements = [];
      document.querySelectorAll('a, button, input, textarea, select, [role="button"]').forEach((el, i) => {
        elements.push({ index: i, tag: el.tagName.toLowerCase(), text: (el.innerText || el.value || '').trim().slice(0, 50), id: el.id, href: el.href || '' });
      });
      sendToInspector('elements-list', { elements });
    }
  };

  const sendToInspector = (action, data) => {
    const message = {
      type: 'inspector-bridge-event', action,
      elementInfo: data.elementInfo || '', position: data.position || { xPercent: 50, yPercent: 50 },
      pageUrl: window.location.href, timestamp: Date.now(),
      level: data.level || null, source: 'imported-project',
      networkMeta: data.networkMeta || null
    };
    if (ws && wsReady) ws.send(JSON.stringify(message));
    else if (ws) messageQueue.push(message);
    if (isInIframe) { try { window.parent.postMessage(message, '*'); } catch(e) {} }
  };

  const getElementInfo = (el) => {
    if (!el) return '';
    const text = (el.innerText || el.value || '').trim().slice(0, 50);
    const tag = el.tagName?.toLowerCase() || '';
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '';
    const tagLabels = {
      'button': 'دکمه', 'a': 'لینک', 'input': 'فیلد ورودی', 'textarea': 'فیلد متن',
      'select': 'منوی انتخاب', 'img': 'تصویر', 'form': 'فرم', 'div': 'بخش', 'span': 'متن',
      'p': 'پاراگراف', 'h1': 'عنوان اصلی', 'h2': 'عنوان', 'h3': 'عنوان', 'nav': 'منوی ناوبری',
      'header': 'سربرگ', 'footer': 'پاورقی', 'li': 'آیتم لیست', 'table': 'جدول', 'video': 'ویدیو'
    };
    const typeLabel = tagLabels[tag] || tag;
    if (text) return typeLabel + ' "' + text + '"';
    return typeLabel + (id || cls || '');
  };

  const getPositionPercent = (e) => ({
    xPercent: (e.clientX / window.innerWidth) * 100,
    yPercent: (e.clientY / window.innerHeight) * 100
  });

  // Event Listeners - window capture phase (بالاترین اولویت)
  window.addEventListener('click', (e) => {
    if (!shouldSend()) return;
    sendToInspector('click', { elementInfo: getElementInfo(e.target), position: getPositionPercent(e) });
  }, true);

  // 🆕 فالبک pointerdown برای overlay هایی که click رو مصرف می‌کنند
  window.addEventListener('pointerdown', (e) => {
    setTimeout(() => {
      if (Date.now() - lastEventTime > 180) {
        sendToInspector('click', { elementInfo: getElementInfo(e.target) + ' (pointerdown)', position: getPositionPercent(e) });
      }
    }, 200);
  }, true);

  window.addEventListener('input', (e) => {
    if (!shouldSend()) return;
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') {
      sendToInspector('input', { elementInfo: getElementInfo(e.target) });
    }
  }, true);

  window.addEventListener('focus', (e) => {
    if (!shouldSend()) return;
    if (e.target && e.target !== document && e.target !== document.body) {
      sendToInspector('focus', { elementInfo: getElementInfo(e.target) });
    }
  }, true);

  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => { sendToInspector('scroll', { elementInfo: 'صفحه' }); }, 200);
  }, true);

  // 🔵 رهگیری تمام متدهای کنسول
  let consoleLogCount = 0;
  const MAX_CONSOLE_LOGS = 200;

  const interceptConsole = (level, origFn) => (...args) => {
    origFn.apply(console, args);
    if (consoleLogCount >= MAX_CONSOLE_LOGS) return;
    consoleLogCount++;
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a).slice(0, 200) : String(a).slice(0, 200)).join(' ').slice(0, 500);
    if (msg.includes('Inspector Bridge') || msg.includes('🌉')) return;
    sendToInspector(level === 'error' ? 'console-error' : 'console-log', { elementInfo: msg, level });
  };

  const origLog = console.log, origWarn = console.warn, origError = console.error, origInfo = console.info, origDebug = console.debug;
  console.log = interceptConsole('log', origLog);
  console.warn = interceptConsole('warn', origWarn);
  console.error = interceptConsole('error', origError);
  console.info = interceptConsole('info', origInfo);
  console.debug = interceptConsole('debug', origDebug);

  // 🔴 خطاهای JS
  let errorCount = 0;
  const MAX_ERRORS = 50;

  window.onerror = (message, source, lineno) => {
    if (errorCount >= MAX_ERRORS) return;
    errorCount++;
    let errorInfo = String(message || 'Unknown error').slice(0, 150);
    if (source) errorInfo += ` (at ${source.split('/').pop()}:${lineno})`;
    sendToInspector('error', { elementInfo: errorInfo, level: 'error' });
  };

  window.addEventListener('unhandledrejection', (e) => {
    if (errorCount >= MAX_ERRORS) return;
    errorCount++;
    const reason = (e.reason?.message || e.reason?.toString()) || 'Promise rejected';
    sendToInspector('error', { elementInfo: String(reason).slice(0, 150), level: 'error' });
  });

  // 🔍 MutationObserver + اسکن دوره‌ای - تشخیص لایه‌های خطا
  const __attachedOverlays = new WeakSet();
  const isOverlay = (node) => {
    try {
      const s = window.getComputedStyle(node);
      const z = parseInt(s.zIndex) || 0;
      return (s.position === 'fixed' || s.position === 'absolute') && (z > 1000 || (node.offsetWidth > window.innerWidth*0.8 && node.offsetHeight > window.innerHeight*0.5));
    } catch(e) { return false; }
  };
  const attachOverlay = (node) => {
    if (__attachedOverlays.has(node)) return;
    __attachedOverlays.add(node);
    sendToInspector('error-overlay', { elementInfo: 'لایه خطا: ' + (node.textContent||'').slice(0,200), level: 'error' });
    node.addEventListener('click', (e) => {
      sendToInspector('click', { elementInfo: getElementInfo(e.target) + ' (overlay)', position: getPositionPercent(e) });
    }, true);
    node.addEventListener('pointerdown', (e) => {
      sendToInspector('click', { elementInfo: getElementInfo(e.target) + ' (overlay pointerdown)', position: getPositionPercent(e) });
    }, true);
    if (node.shadowRoot) {
      node.shadowRoot.addEventListener('click', (e) => {
        sendToInspector('click', { elementInfo: getElementInfo(e.target) + ' (shadow)', position: { xPercent: 50, yPercent: 50 } });
      }, true);
    }
  };

  try {
    const overlayObs = new MutationObserver((mutations) => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (isOverlay(node)) attachOverlay(node);
      }));
    });
    if (document.body) overlayObs.observe(document.body, { childList: true, subtree: true });
    else document.addEventListener('DOMContentLoaded', () => overlayObs.observe(document.body, { childList: true, subtree: true }));
  } catch(e) {}

  // 🔁 اسکن دوره‌ای برای overlay های از دست رفته
  setInterval(() => {
    try {
      document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"], nextjs-portal, [id*="overlay"], [id*="error"], [class*="overlay"]').forEach(el => {
        if (isOverlay(el)) attachOverlay(el);
        if (el.shadowRoot && !__attachedOverlays.has(el)) attachOverlay(el);
      });
    } catch(e) {}
  }, 2000);

  // 🌐 Network Monitoring (fetch + XHR) — v2.4
  (function setupNetworkMonitoring() {
    try {
      let __netReqSeq = 0;
      const __maskValue = (v) => {
        if (!v) return v;
        const s = String(v);
        return s.length > 8 ? s.slice(0, 4) + '****' + s.slice(-2) : '****';
      };
      const __maskUrl = (url) => {
        try {
          const u = new URL(url, window.location.origin);
          u.searchParams.forEach((val, key) => {
            const lk = key.toLowerCase();
            if (lk.indexOf('token') >= 0 || lk.indexOf('key') >= 0 || lk.indexOf('secret') >= 0 || lk.indexOf('password') >= 0) {
              u.searchParams.set(key, __maskValue(val));
            }
          });
          return u.toString();
        } catch(e) { return String(url); }
      };
      const __summarizeUrl = (url) => {
        try {
          const u = new URL(url, window.location.origin);
          let path = u.pathname;
          if (path.length > 80) path = path.slice(0, 77) + '...';
          return u.host + path;
        } catch(e) { return String(url).slice(0, 100); }
      };
      if (typeof window.fetch === 'function' && !window.__inspectorFetchHooked) {
        window.__inspectorFetchHooked = true;
        const origFetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
          const reqId = 'fetch_' + (++__netReqSeq) + '_' + Date.now();
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const method = (init && init.method) || (input && input.method) || 'GET';
          const maskedUrl = __maskUrl(url);
          const startedAt = Date.now();
          try {
            sendToInspector('network-request', {
              elementInfo: method.toUpperCase() + ' ' + __summarizeUrl(maskedUrl),
              level: null,
              networkMeta: { reqId, method: method.toUpperCase(), url: maskedUrl, startedAt }
            });
          } catch(e) {}
          return origFetch(input, init).then((res) => {
            try {
              const dur = Date.now() - startedAt;
              const ok = res && res.ok;
              const status = res ? res.status : 0;
              const label = method.toUpperCase() + ' ' + __summarizeUrl(maskedUrl) + ' → ' + status + ' (' + dur + 'ms)';
              sendToInspector(ok ? 'network-response' : 'network-error', {
                elementInfo: label,
                level: ok ? null : 'error',
                networkMeta: { reqId, method: method.toUpperCase(), url: maskedUrl, status, durationMs: dur, ok: !!ok }
              });
            } catch(e) {}
            return res;
          }).catch((err) => {
            try {
              const dur = Date.now() - startedAt;
              sendToInspector('network-error', {
                elementInfo: method.toUpperCase() + ' ' + __summarizeUrl(maskedUrl) + ' ✗ ' + (err && err.message || 'fetch failed'),
                level: 'error',
                networkMeta: { reqId, method: method.toUpperCase(), url: maskedUrl, status: 0, durationMs: dur, ok: false, errorMessage: err && err.message }
              });
            } catch(e) {}
            throw err;
          });
        };
      }
      if (window.XMLHttpRequest && !window.__inspectorXhrHooked) {
        window.__inspectorXhrHooked = true;
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url) {
          try {
            this.__inspectorReqId = 'xhr_' + (++__netReqSeq) + '_' + Date.now();
            this.__inspectorMethod = (method || 'GET').toUpperCase();
            this.__inspectorUrl = __maskUrl(url);
          } catch(e) {}
          return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function() {
          const xhr = this;
          try {
            xhr.__inspectorStartedAt = Date.now();
            sendToInspector('network-request', {
              elementInfo: xhr.__inspectorMethod + ' ' + __summarizeUrl(xhr.__inspectorUrl),
              level: null,
              networkMeta: { reqId: xhr.__inspectorReqId, method: xhr.__inspectorMethod, url: xhr.__inspectorUrl, startedAt: xhr.__inspectorStartedAt }
            });
            xhr.addEventListener('loadend', () => {
              try {
                const dur = Date.now() - xhr.__inspectorStartedAt;
                const status = xhr.status || 0;
                const ok = status >= 200 && status < 400;
                const label = xhr.__inspectorMethod + ' ' + __summarizeUrl(xhr.__inspectorUrl) + ' → ' + status + ' (' + dur + 'ms)';
                sendToInspector(ok ? 'network-response' : 'network-error', {
                  elementInfo: label,
                  level: ok ? null : 'error',
                  networkMeta: { reqId: xhr.__inspectorReqId, method: xhr.__inspectorMethod, url: xhr.__inspectorUrl, status, durationMs: dur, ok }
                });
              } catch(e) {}
            });
          } catch(e) {}
          return origSend.apply(this, arguments);
        };
      }
    } catch(e) { /* non-critical */ }
  })();

  connectWS();
  setInterval(() => { if (ws && wsReady) try { ws.send(JSON.stringify({ type: 'ping' })); } catch(e) {} }, 25000);

  // فالبک postMessage
  if (isInIframe) {
    try { window.parent.postMessage({ type: 'inspector-bridge-ready', pageUrl: window.location.href }, '*'); } catch(e) {}
  }
}
// 🌉 End of Inspector Bridge Script

import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
)
