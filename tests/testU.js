// v23: anatomical body map, folded fresh muscles, display font, tab titles, count-up
const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8828); const b = await chromium.launch(); const U = 'http://127.0.0.1:8828/index.html';
  try {
    const { page } = await H.newPage(b, { noExpand: true });
    await page.goto(U); await H.skipOnboarding(page);
    const ev = (f, a) => page.evaluate(f, a);
    await ev(() => { state.seen.v8 = true; state.muscles.Chest.recovery = 40; state.muscles.Quads.recovery = 70; go('recovery'); });
    const bm = await ev(() => { const s = document.querySelector('.face.fr svg'); return { base: s.querySelectorAll('path.base').length, seam: /Z$/.test(s.querySelector('path.base').getAttribute('d')) && !s.querySelector('path.base[transform]'), mus: [...s.querySelectorAll('.mus')].map(g => g.dataset.m).sort().join(','), back: [...document.querySelectorAll('.face.bk .mus')].map(g => g.dataset.m).sort().join(',') }; });
    H.check('body outline is one seamless shape (no mirrored halves)', bm.base <= 2 && bm.seam, bm);
    H.check('front and back show the right muscle groups', bm.mus === 'Biceps,Calves,Chest,Core,Quads,Shoulders' && bm.back === 'Back,Calves,Glutes,Hamstrings,Shoulders,Triceps', bm);
    const rl = await ev(() => ({ top: [...document.querySelectorAll('.rlist > .rrow')].map(r => r.dataset.row), fold: document.querySelectorAll('.rfresh .rrow').length, all: document.querySelectorAll('.rlist .rrow').length, open: document.querySelector('.rfresh').open }));
    H.check('recovering muscles come first, most tired first', rl.top.join() === 'Chest,Quads', rl);
    H.check('fresh muscles fold into one closed row (all 10 still there)', rl.fold === 8 && rl.all === 10 && !rl.open, rl);
    await ev(() => A.recMuscle(document.querySelector('.face.bk .mus[data-m=Glutes]')));
    await page.waitForTimeout(300);
    H.check('tapping a fresh muscle on the map opens the fold', await ev(() => document.querySelector('.rfresh').open));
    H.check('header shows the tab title', await ev(() => document.querySelector('#htitle').textContent) === 'Recovery');
    await ev(() => go('more')); H.check('…and it follows the tab', await ev(() => document.querySelector('#htitle').textContent) === 'Settings');
    H.check('display font is embedded and used for titles', await ev(async () => { await document.fonts.ready; return document.fonts.check('800 24px "Big Shoulders"') && getComputedStyle(document.querySelector('#htitle')).fontFamily.includes('Big Shoulders'); }));
    await ev(() => go('recovery')); await page.waitForTimeout(700);
    H.check('readiness number lands on the real value after counting up', await ev(() => document.querySelector('#rring-n').textContent === avgRecovery() + '%'));
    H.check('no page errors', page.errs.length === 0, page.errs);
    const r = await H.newPage(b, { noExpand: true, opts: { reducedMotion: 'reduce' } });
    await r.page.goto(U); await H.skipOnboarding(r.page);
    await r.page.evaluate(() => { state.muscles.Chest.recovery = 40; go('recovery'); });
    H.check('reduced motion: numbers appear at once, no count-up', await r.page.evaluate(() => document.querySelector('#rring-n').textContent === avgRecovery() + '%'));
  } catch (e) { console.log('ERROR', e); H.check('no exceptions', false); }
  await b.close(); srv.kill(); process.exit(H.summary() ? 1 : 0);
})();
