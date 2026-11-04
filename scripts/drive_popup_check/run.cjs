const { chromium } = require('playwright');
(async () => {
  const D = process.argv[2];
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto('file://' + D + '/index.html');
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  // A: one window only; closing it ⇒ the message + retry state, not «loading»
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('#b')]);
  ok((await p.textContent('#out')).includes('حساب گوگل را در پنجرهٔ کوچک انتخاب کنید'), 'while open: «choose the account» shown');
  await p.click('#b'); await p.waitForTimeout(300);
  ok(ctx.pages().length === 2, `second click opened no new window (pages=${ctx.pages().length})`);
  await pop.close(); await p.waitForTimeout(600);
  ok((await p.getAttribute('#out', 'data-state')) === 'retry' && (await p.textContent('#out')).includes('پنجره بسته شد'), 'closed by user ⇒ retry message: ' + await p.textContent('#out'));
  // B: timeout closes the window itself
  await p.evaluate(() => { document.getElementById('b').dataset.t = '1500'; });
  const [pop2] = await Promise.all([ctx.waitForEvent('page'), p.click('#b')]);
  await p.waitForTimeout(2200);
  ok(pop2.isClosed(), 'after the timeout the window was closed by the app');
  ok((await p.textContent('#out')).includes('ثانیه بی‌پاسخ ماند'), 'timeout ⇒ message: ' + await p.textContent('#out'));
  await p.screenshot({ path: D + '/after.png' });
  await b.close();
})();
