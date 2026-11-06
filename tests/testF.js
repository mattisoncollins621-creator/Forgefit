const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8770); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8770/';
  try {
    for (const w of [320, 360]) {
      const { ctx, page } = await H.newPage(b, { opts: { viewport: { width: w, height: 400 }, deviceScaleFactor: 2 } });
      await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
      await page.evaluate(() => { PROFILES.list.push({ id: 'p2', name: 'Jessica Long' }); writeProfiles(); PROFILES.list[0].name = 'Mattison Collins'; writeProfiles(); paintChrome(); });
      await page.waitForTimeout(200);
      const o = await page.evaluate(() => { const h = document.querySelector('header') || document.body; const els = [...document.querySelectorAll('header .pill, #pname')].map(e => { const r = e.getBoundingClientRect(); return { id: e.id, l: Math.round(r.left), r: Math.round(r.right), vis: !e.hidden, t: e.textContent.trim() }; }); return { els, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
      console.log(w, JSON.stringify(o));
      H.check(`${w}px header fits with two people`, o.sw <= o.cw && o.els.every(e => e.r <= w + 1), o);
      await page.screenshot({ path: `/tmp/t/out/w${w}-header.png`, clip: { x: 0, y: 0, width: w, height: 110 } });
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
