const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8779); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8779/';
  try {
    console.log('== L no emoji, no horizontal scroll');
    const { page } = await H.newPage(b, { viewport: { width: 360, height: 780 } });
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FF}\u{25A0}-\u{25FF}‍️]/u;
    for (const t of ['workout', 'recovery', 'progress', 'body', 'more']) {
      await page.click('#nav-' + t); await page.waitForTimeout(250);
      const r = await page.evaluate(() => ({ txt: document.body.innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      const m = r.txt.match(emoji);
      H.check(t + ': no emoji/symbol glyphs in text', !m, m && m[0]);
      H.check(t + ': no horizontal scroll', r.sw <= r.cw, r);
    }
    const bad = await page.evaluate(() => [...document.querySelectorAll('svg.ic')].filter(s => !s.innerHTML.trim()).length);
    H.check('no empty icons', bad === 0, bad);
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
