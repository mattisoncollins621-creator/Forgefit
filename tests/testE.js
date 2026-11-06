const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8769); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8769/';
  try {
    for (const w of [320, 360]) {
      const { ctx, page } = await H.newPage(b, { opts: { viewport: { width: w, height: 740 }, deviceScaleFactor: 2 } });
      await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
      await page.evaluate(() => { state.profile.trainDays = [1, 3, 5]; state.lastExport = Date.now() - 20 * 864e5; });
      await page.evaluate(() => { const p = readProfiles(); return p; });
      const tabs = ['workout', 'recovery', 'progress', 'body', 'more'];
      for (const t of tabs) {
        await page.click('#nav-' + t); await page.waitForTimeout(200);
        const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        H.check(`${w}px ${t}: no sideways scroll`, o.sw <= o.cw, o);
      }
      await page.click('#nav-more'); await page.click('[data-a=profAdd]').catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: `/tmp/t/out/w${w}-more.png` });
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
