const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8800); const b = await chromium.launch(); const U = 'http://127.0.0.1:8800/index.html';
  try {
    const { page } = await H.newPage(b, { noExpand: true, focus: true });
    await page.goto(U); await H.skipOnboarding(page);
    const ev = (f, a) => page.evaluate(f, a);
    await ev(() => { state.seen.v8 = true; Object.keys(state.gear).forEach(k => state.gear[k] = true); state.profile.goal = 'muscle'; state.profile.experience = 'intermediate'; state.profile.sessionMin = 60; });
    console.log('== P1 weekly set targets');
    // history: 2 sessions in the last week; chest already over the top of its range, shoulders far behind
    const mkHist = () => ev(() => {
      const it = (exId, n) => { const e = exById(exId); return { exId, name: e.name, p: e.primary, s: e.secondary, mw: exW(e), sets: Array.from({ length: n }, () => ({ w: 100, r: 8, rir: 2, type: 'work' })) }; };
      state.history = [
        { id: 'h1', t: Date.now() - 2 * 864e5, name: 'Push', split: 'push', sets: 22, vol: 1, dur: 60, unit: 'lb', items: [it('cable_fly', 19)], cardio: [] },
        { id: 'h2', t: Date.now() - 4 * 864e5, name: 'Pull', split: 'pull', sets: 6, vol: 1, dur: 40, unit: 'lb', items: [it('bb_row', 6)], cardio: [] }];
      MUSCLES.forEach(m => state.muscles[m].recovery = 100); state.anchors = {};
    });
    await mkHist();
    const r = await ev(() => {
      const ws = weeklySets(1), T = m => setTarget(m); const res = { chest: ws.Chest[0], chestT: T('Chest'), sh: ws.Shoulders[0], shT: T('Shoulders'), runs: [] };
      for (let k = 0; k < 15; k++) { state.split = 'push'; generateWorkout(true); const w = wk(); res.runs.push({ items: w.items.filter(i => !i.cardio).map(i => ({ p: exById(i.exId).primary, n: i.sets.length, main: !!i.main })), note: w.note }); }
      return res;
    });
    H.check('test setup: chest is over its weekly range, shoulders behind', r.chest >= r.chestT[1] && r.sh < r.shT[0] - 3, r);
    H.check('push days skip extra chest accessories when chest is already at target', r.runs.every(x => x.items.filter(i => i.p === 'Chest' && !i.main).length === 0), r.runs.map(x => x.items.map(i => i.p + (i.main ? '*' : '') + i.n).join()).slice(0, 5));
    H.check('the chest main lift stays but drops to 2 sets', r.runs.every(x => x.items.filter(i => i.p === 'Chest' && i.main).every(i => i.n === 2)));
    H.check('shoulders (behind) get an extra set', r.runs.every(x => x.items.filter(i => i.p === 'Shoulders').some(i => i.n >= 4)));
    H.check('the note explains both', /Extra sets where you're behind this week: .*shoulders/.test(r.runs[0].note) && /Already at target this week, kept light: .*chest/.test(r.runs[0].note), r.runs[0].note);
    // no history → no target logic
    const fresh = await ev(() => { state.history = []; state.anchors = {}; state.split = 'push'; generateWorkout(true); return { note: wk().note, n: wk().items.filter(i => !i.cardio).map(i => i.sets.length) }; });
    H.check('with no recent history the targets stay out of the way', !/Extra sets|Already at target/.test(fresh.note) && fresh.n.every(n => n <= 4), fresh);
    // deload ignores targets
    await mkHist();
    const dl = await ev(() => { state.deload = { until: Date.now() + 5 * 864e5 }; state.split = 'push'; generateWorkout(true); const o = wk().note; state.deload = null; return o; });
    H.check('deload weeks ignore the targets', !/Extra sets|Already at target/.test(dl), dl);
    // legs day unaffected by push volume
    const lg = await ev(() => { state.split = 'legs'; generateWorkout(true); return wk().items.filter(i => !i.cardio).length; });
    H.check('a legs day still builds a full session', lg >= 4, lg);
    // everything maxed: still at least 3 exercises
    const mx = await ev(() => { state.history.forEach(h => h.items.forEach(i => i.sets = i.sets.concat(i.sets, i.sets))); state.split = 'push'; generateWorkout(true); return wk().items.filter(i => !i.cardio).length; });
    H.check('even when everything is at target, a session keeps at least 3 exercises', mx >= 3, mx);

    console.log('== P2 calibration');
    await ev(() => { state.history = []; state.prs = {}; state.calib = {}; state.anchors = {}; MUSCLES.forEach(m => state.muscles[m].recovery = 100); state.split = 'push'; generateWorkout(); });
    H.check('the plan note mentions new lifts', /new lift/.test(await ev(() => wk().note)));
    await page.click('[data-a=startWorkout]'); await page.waitForTimeout(200);
    H.check('a lift with no history shows "find your working weight"', await page.locator('#focus [data-a=calib]').count() === 1);
    const id = await ev(() => wk().items[0].exId);
    await page.click('#focus [data-a=calib]');
    H.check('the sheet opens on test set 1 with Save disabled until effort is picked', /Test set 1/.test(await page.locator('#sheet-b').innerText()) && await page.locator('#sheet [data-a=calSave]').isDisabled());
    await ev(() => { cal.w = 100; cal.r = 5; calPaint(); });
    await page.click('#sheet [data-a=calRir][data-v="5"]'); await page.click('#sheet [data-a=calSave]');
    const w2 = await ev(() => cal.w);
    H.check('an easy set (5+ left) asks for a heavier second set', /Test set 2/.test(await page.locator('#sheet-b').innerText()) && w2 > 100, w2);
    await page.click('#sheet [data-a=calRir][data-v="2"]'); await page.click('#sheet [data-a=calSave]');
    const res = await ev(() => cal.result);
    const expE = Math.round(w2 * (1 + 7 / 30));
    H.check('a moderate set (2 left) finishes with a working weight from that set', res && res.e === expE && /Your working weight/.test(await page.locator('#sheet-b').innerText()), { res, expE });
    await page.click('#sheet [data-a=calApply]'); await page.waitForTimeout(200);
    const ap = await ev(id => ({ e: state.e1rm[id], c: !!state.calib[id], w: wk().items[0].sets.map(s => +s.weight) }), id);
    H.check('applying saves the estimate and updates today\'s sets', ap.e === expE && ap.c && ap.w.every(x => x === ap.w[0] && x > 0), ap);
    H.check('the prompt disappears once calibrated', await page.locator('#focus [data-a=calib]').count() === 0);
    H.check('lifts you already have history for never show the prompt', await ev(() => { state.prs.bb_bench = { e1rm: 200, weight: 185, reps: 5, t: Date.now() }; return !isNewLift(exById('bb_bench')); }));
    H.check('bodyweight-only / no-load moves are never offered calibration', await ev(() => allEx().filter(e => e.noE1).every(e => !isNewLift(e))));
    // three hard-but-easy sets cap at 3
    await ev(id2 => { calStart('ohp', 1); }, null);
    for (let k = 0; k < 3; k++) { await page.click('#sheet [data-a=calRir][data-v="5"]'); await page.click('#sheet [data-a=calSave]'); }
    H.check('it stops after 3 test sets even if they all felt easy', /Your working weight/.test(await page.locator('#sheet-b').innerText()) && await page.locator('#sheet [data-a=calMore]').count() === 0);
    await page.click('#sheet .ib[data-a=closeSheet]');
    // list view shows it too
    await page.click('[data-a=viewMode][data-v=list]');
    H.check('list view cards show the prompt too', await page.locator('#exlist [data-a=calib]').count() >= 1);
    H.check('no page errors', page.errs.length === 0, page.errs);
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
