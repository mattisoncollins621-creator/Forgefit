const H = require('./h'); const { chromium } = require('playwright');
const tick = async (page, n) => { await page.locator('#exlist .chk').nth(n).click(); for (let k = 0; k < 4; k++) { if (await page.locator('#pr:not([hidden])').count()) { await page.click('#pr [data-a=prNext]'); await page.waitForTimeout(80); } } await page.evaluate(() => { state.timer = null; $('#tbar').hidden = true; }); };
(async () => {
  H.sync(); const srv = await H.serve(8765); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8765/';
  try {
    console.log('== T1 fresh install');
    let { ctx, page } = await H.newPage(b);
    await page.goto(URL + 'index.html'); await page.waitForSelector('#onboard:not([hidden])');
    H.check('onboarding shows on first run', true);
    for (let i = 0; i < 4; i++) await page.click('[data-a=obNext]');
    await page.click('[data-a=obDone]'); await page.waitForTimeout(400);
    H.check('workout generated after onboarding', await page.locator('#exlist .ex').count() >= 3, await page.locator('#exlist .ex').count());
    H.check('week strip present', await page.locator('.card.week .wd').count() === 7);
    H.check('first-run help card present for a brand-new person', await page.locator('text=Getting started').count() === 1);
    await page.click('[data-a=seenNew]'); H.check('whats-new dismissed', await page.locator('text=What’s new').count() === 0);
    H.check('default theme is dark', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    H.check('no unknown data-a/data-f hooks (workout)', (await H.unknownHooks(page)).length === 0, await H.unknownHooks(page));
    for (const t of ['recovery', 'progress', 'body', 'more']) { await page.click('#nav-' + t); await page.waitForTimeout(150); const u = await H.unknownHooks(page); H.check('hooks ok on ' + t, u.length === 0, u); }
    H.check('no JS errors (fresh)', page.errs.length === 0, page.errs);

    console.log('== T2 migration from previous version');
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'prev.html'); await H.skipOnboarding(page);
    // log a real session in the OLD build
    await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench'), { weight: 135 }), buildItem(exById('bb_row'), { weight: 115 })]; renderWorkout(); });
    for (const i of [0, 1]) { const n = await page.locator(`#exlist [data-ex="${i}"] .chk`).count(); for (let j = 0; j < n; j++) { await page.locator(`#exlist [data-ex="${i}"] .chk`).nth(j).click(); for (let k = 0; k < 3; k++) { if (await page.locator('#pr:not([hidden])').count()) { await page.click('#pr [data-a=prNext]'); await page.waitForTimeout(60); } } await page.evaluate(() => { state.timer = null; }); } }
    await page.click('[data-a=finish]'); await page.waitForTimeout(300);
    const old = await page.evaluate(() => ({ h: state.history.length, e: state.e1rm.bb_bench, prs: Object.keys(state.prs).length, unit: state.profile.unit }));
    await page.evaluate(() => flushSave());
    H.check('old build logged a session', old.h === 1 && old.prs >= 1, old);
    const errsOld = page.errs.length;
    await page.goto(URL + 'index.html'); await page.waitForSelector('#nav');
    const nw = await page.evaluate(() => ({ h: state.history.length, e: state.e1rm.bb_bench, prs: Object.keys(state.prs).length, ca: state.createdAt > 0, seen: typeof state.seen, ls: state.lastExport, th: state.settings.theme, pf: state.settings.prefill }));
    H.check('history/e1RM/PRs survive upgrade', nw.h === 1 && nw.e === old.e && nw.prs === old.prs, nw);
    H.check('new fields filled in', nw.ca && nw.seen === 'object' && nw.th === 'dark' && nw.pf === true, nw);
    H.check('no errors after upgrade', page.errs.length === errsOld, page.errs.slice(errsOld));
    for (const t of ['recovery', 'progress', 'body', 'more', 'workout']) { await page.click('#nav-' + t); await page.waitForTimeout(120); }
    H.check('all tabs render with migrated data', page.errs.length === errsOld, page.errs.slice(errsOld));
    // pre-fill uses the last session
    const pf = await page.evaluate(() => { const it = buildItem(exById('bb_bench')); return it.sets.map(s => [s.weight, s.reps]); });
    H.check('new bench sets pre-filled with 135 x 8', pf.every(s => s[0] === 135 && s[1] === 8), pf);
    const hint = await page.evaluate(() => { const it = buildItem(exById('bb_bench')); return progressHint(exById('bb_bench'), it); });
    H.check('progress hint appears after hitting target reps', !!hint && hint.to === 140, hint);
    console.log('== T3 logging, bump, undo, repeat');
    await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench'))]; renderWorkout(); });
    H.check('chip rendered', await page.locator('.coach.up').count() === 1);
    await page.click('.coach.up');
    const w1 = await page.evaluate(() => state.workout.items[0].sets.map(s => s.weight));
    H.check('bump adds 5 lb to every set', w1.every(w => w === 140), w1);
    H.check('chip gone after bump', await page.locator('.coach.up').count() === 0);
    // log 3 sets then un-log one
    for (let j = 0; j < 3; j++) await tick(page, j);
    H.check('3 sets done', await page.locator('.srow.done').count() === 3);
    await tick(page, 2);
    H.check('un-logging works', await page.locator('.srow.done').count() === 2);
    // fatigue chip
    await page.evaluate(() => { state.muscles.Chest.recovery = 40; state.workout.items = [buildItem(exById('bb_bench'))]; state.workout.items[0].bumped = false; renderWorkout(); });
    const fchip = await page.locator('.coach.dn').count();
    const upchip = await page.locator('.coach.up').count();
    H.check('fatigue chip shows when muscle < 55%', fchip + upchip === 1 && (fchip === 1 || upchip === 1), { fchip, upchip });
    if (fchip) { await page.click('.coach.dn'); const w = await page.evaluate(() => state.workout.items[0].sets.map(s => s.weight)); H.check('trim lowers weights ~10%', w.every(x => x === 120 || x === 125), w); }
    await page.evaluate(() => { state.muscles.Chest.recovery = 100; });
    // finish + repeat
    await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench')), buildItem(exById('bb_squat'))]; renderWorkout(); });
    await tick(page, 0); await tick(page, 1);
    await page.click('[data-a=finish]'); await page.waitForTimeout(300);
    H.check('finish sheet shows streak line', await page.locator('#sheet-b .or').count() >= 1);
    await page.click('#sheet-b [data-a=closeSheet]'); await page.waitForTimeout(200);
    await page.click('#nav-workout'); await page.click('[data-a=repeatLast]');
    const rep = await page.evaluate(() => state.workout.items.map(i => [i.exId, i.sets.length, i.sets[0].weight, i.sets[0].done]));
    H.check('repeat last workout loads the same lifts, unlogged', rep.length === 1 && rep[0][0] === 'bb_bench' && rep[0][3] === false, rep);
    H.check('no JS errors (migration/logging)', page.errs.length === errsOld, page.errs.slice(errsOld));
    await ctx.close();
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
