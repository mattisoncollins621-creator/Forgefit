// v22: calmer Workout tab, tip carousel, Why this plan, quiet tip buttons, ghost empty charts
const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8822); const b = await chromium.launch(); const U = 'http://127.0.0.1:8822/index.html';
  try {
    const { page } = await H.newPage(b, { noExpand: true });
    await page.goto(U); await H.skipOnboarding(page);
    const ev = (f, a) => page.evaluate(f, a);
    await ev(() => { state.seen.v8 = true; state.nudgeSnooze = 0;
      for (let i = 60; i >= 3; i -= 2) state.history.push({ id: uid(), t: Date.now() - i * 864e5, name: 'pull', split: 'pull', sets: 9, vol: 9000, dur: 50, unit: 'lb', prs: 0, items: [{ exId: 'bb_row', name: 'Row', p: 'Back', s: [], sets: [{ w: 135, r: 8, rir: 2, type: 'work' }, { w: 135, r: 8, rir: 2, type: 'work' }] }], cardio: [] });
      state.history.sort((a, b) => b.t - a.t); state.lastExport = Date.now() - 30 * 864e5; state.split = 'push'; generateWorkout(); go('workout'); });
    const o = await ev(() => { const k = [...document.querySelector('#tab-workout').children].map(e => e.matches('.hero-card') ? 'hero' : e.matches('.tips') ? 'tips' : e.matches('#exlist') ? 'list' : e.querySelector && e.querySelector('.wk7, .week') ? 'week' : ''); return { k, hero: k.indexOf('hero'), tips: k.indexOf('tips'), list: k.indexOf('list') }; });
    H.check('the session card comes first, tips after it', o.hero >= 0 && o.hero < 2 && (o.tips < 0 || o.tips > o.hero) && o.list > o.hero, o);
    const t = await ev(() => ({ slides: document.querySelectorAll('.tips .cslide').length, banners: document.querySelectorAll('.tips .cslide > .banner').length, dots: document.querySelectorAll('.tips .cdots i').length }));
    H.check('all tips live in one card, one per slide, with dots', t.slides >= 1 && t.slides === t.banners && (t.slides === 1 ? t.dots === 0 : t.dots === t.slides), t);
    const q = await ev(() => { const btn = document.querySelector('.tips .banner .mini.pri, .tips .banner .btn.pri'); return btn ? getComputedStyle(btn).backgroundColor : 'none'; });
    H.check('buttons inside tips are not orange', q === 'none' || !/249, 115, 22/.test(q), q);
    await page.click('.tips .cslide >> nth=0');
    H.check('tapping a tip expands it', await ev(() => document.querySelector('.tips .cslide').classList.contains('open')));
    H.check('Workout tab has only one orange button (Start workout)', await ev(() => [...document.querySelectorAll('#tab-workout button, body > .fab')].filter(e => e.offsetParent && /249, 115, 22/.test(getComputedStyle(e).backgroundColor) && !e.matches('.chip')).length) <= 1);
    const hn = await ev(() => { const h = document.querySelector('.hnote'); return h && { one: h.querySelector('.hn1').textContent, full: wk().note }; });
    if (hn) {
      H.check('plan note shows one short line', hn.one.length <= hn.full.length && !hn.one.includes(' · '));
      await page.click('.hnote');
      H.check('"Why this plan" lists every reason', await ev(() => document.querySelector('#sheet-t').textContent === 'Why this plan' && document.querySelectorAll('#sheet-b .whyl li').length === wk().note.split(' · ').length));
      await ev(() => closeSheet());
    }
    await ev(() => go('progress'));
    H.check('empty strength curve shows a faded sample chart', await ev(() => !!document.querySelector('#tab-progress .ghost svg.gsvg')));
    await ev(() => go('body'));
    H.check('empty body trend shows a sample with what to log', await ev(() => /two days/.test(document.querySelector('#tab-body .ghost')?.textContent || '')));
    H.check('no page errors', page.errs.length === 0, page.errs);
  } catch (e) { console.log('ERROR', e); H.check('no exceptions', false); }
  await b.close(); srv.kill(); process.exit(H.summary() ? 1 : 0);
})();
