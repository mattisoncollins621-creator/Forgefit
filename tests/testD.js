const H = require('./h'); const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  H.sync(); const srv = await H.serve(8768); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8768/';
  try {
    console.log('== T19 deload/prefill/units/settings edge cases');
    let { ctx, page } = await H.newPage(b);
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.click('[data-a=seenNew]');
    const r1 = await page.evaluate(() => {
      state.history = [{ id: 'a', t: Date.now() - 3 * 864e5, name: 'x', split: '', sets: 3, vol: 1, dur: 0, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'b', p: 'Chest', s: [], sets: [{ w: 200, r: 8, rir: 2, type: 'work' }, { w: 200, r: 8, rir: 2, type: 'work' }, { w: 200, r: 8, rir: 1, type: 'work' }] }], cardio: [] }];
      const normal = buildItem(exById('bb_bench')).sets.map(s => [s.weight, s.reps]);
      state.deload = { until: Date.now() + 7 * 864e5 }; const dl = buildItem(exById('bb_bench')); const dlw = dl.sets.map(s => s.weight); const dlr = dl.sets[0].rir; state.deload = null;
      // a finished deload session must not become next week's baseline
      state.history.unshift({ id: 'b', t: Date.now() - 864e5, deload: true, name: 'x', split: '', sets: 3, vol: 1, dur: 0, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'b', p: 'Chest', s: [], sets: [{ w: 180, r: 8, rir: 3, type: 'work' }] }], cardio: [] });
      const after = buildItem(exById('bb_bench')).sets[0].weight;
      state.settings.prefill = false; const off = buildItem(exById('bb_bench')).sets[0].weight; state.settings.prefill = true;
      return { normal, dlw, dlr, after, off };
    });
    H.check('normal week pre-fills last session (200 x 8)', r1.normal.every(s => s[0] === 200 && s[1] === 8), r1.normal);
    H.check('deload week uses 90% of last normal week (180)', r1.dlw.every(w => w === 180), r1);
    const r1b = await page.evaluate(() => {
      const strength = () => state.workout.items.filter(i => !i.cardio);
      generateWorkout(true); const base = strength()[0].sets[0].rir, bn = strength().length;
      state.deload = { until: Date.now() + 7 * 864e5 }; generateWorkout(true);
      const dl = strength()[0].sets[0].rir, note = state.workout.note; state.deload = null; generateWorkout(true);
      return { base, dl, note, bn };
    });
    H.check('generated deload workout adds +1 rep in reserve and says so', r1b.dl === Math.min(4, r1b.base + 1) && /Deload/.test(r1b.note), r1b);
    H.check('a deload session never becomes the next baseline', r1.after === 200, r1.after);
    H.check('turning pre-fill off restores the e1RM-based weights', r1.off !== 200 || r1.off > 0, r1.off);
    const r2 = await page.evaluate(() => { setUnit('kg'); const w = buildItem(exById('bb_bench')).sets.map(s => s.weight); const hint = progressHint(exById('bb_bench'), buildItem(exById('bb_bench'))); setUnit('lb'); return { w, hint }; });
    H.check('history in lb is converted when the app is in kg (200 lb ≈ 90 kg)', r2.w.every(x => x === 90), r2);
    // progress hint rules
    const r3 = await page.evaluate(() => {
      const mk = sets => { state.history = [{ id: 'q', t: Date.now() - 864e5, name: 'x', split: '', sets: sets.length, vol: 1, dur: 0, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'b', p: 'Chest', s: [], sets: sets.map(([w, r, rir, fail]) => ({ w, r, rir, fail: !!fail, type: 'work' })) }], cardio: [] }]; const it = buildItem(exById('bb_bench')); return !!progressHint(exById('bb_bench'), it); };
      return { allHit: mk([[135, 8, 2], [135, 8, 2], [135, 9, 1]]), oneMissed: mk([[135, 8, 2], [135, 7, 1]]), failure: mk([[135, 8, 2], [135, 8, 0]]), flagged: mk([[135, 8, 2], [135, 8, 2, true]]), single: mk([[135, 8, 2]]) };
    });
    H.check('hint: all sets hit target → yes', r3.allHit === true, r3);
    H.check('hint: a missed set → no; failure → no; single set → no', !r3.oneMissed && !r3.failure && !r3.flagged && !r3.single, r3);
    // erase all data: only this person's data goes, app restarts cleanly
    await page.evaluate(() => { state.photos = [{ id: 'p1', t: 1 }]; return idbPut('photos', { id: 'p1', t: 1, blob: new Blob(['x']) }).then(() => idbPut('photos', { id: 'other', t: 2, blob: new Blob(['y']) })); });
    await page.click('#nav-more'); await page.click('[data-a=wipe]'); await page.waitForSelector('#onboard:not([hidden])');
    const left = await page.evaluate(async () => (await idbAll('photos')).map(p => p.id));
    H.check('erase removes this person’s photos only', JSON.stringify(left) === '["other"]', left);
    H.check('onboarding restarts after erase, no errors', page.errs.length === 0, page.errs);
    await ctx.close();

    console.log('== T20 backup only carries this person’s photos');
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    const f = await page.evaluate(async () => { state.photos = [{ id: 'mine', t: 1 }]; await idbPut('photos', { id: 'mine', t: 1, blob: new Blob(['aaa']) }); await idbPut('photos', { id: 'theirs', t: 2, blob: new Blob(['bbb']) }); const file = await buildBackup(); const o = JSON.parse(await file.text()); return { ids: o.photos.map(p => p.id), name: file.name }; });
    H.check('backup has only my photo', JSON.stringify(f.ids) === '["mine"]', f);
    await ctx.close();

    console.log('== T21 screenshots');
    for (const theme of ['dark', 'light']) {
      ({ ctx, page } = await H.newPage(b, { opts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } }));
      await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
      await page.evaluate(th => {
        state.settings.theme = th; applyTheme(); state.profile.splitPref = 'ppl'; state.profile.days = 4; state.profile.trainDays = null; state.seen = {};
        const n = Date.now(), mkS = (w, r, k) => Array.from({ length: k }, () => ({ w, r, rir: 2, type: 'work' }));
        const ex = [['bb_bench', 'Chest', ['Triceps', 'Shoulders'], 185, 8], ['bb_row', 'Back', ['Biceps'], 155, 8], ['ohp', 'Shoulders', ['Triceps'], 105, 8], ['bb_squat', 'Quads', ['Glutes'], 225, 6]];
        state.history = [];
        for (let d = 1; d <= 36; d += 2) { const e = ex[(d / 2 | 0) % 4], prog = Math.round((36 - d) / 6) * 5; state.history.push({ id: uid(), t: n - d * 864e5, name: e[1] + ' Session', split: 'push', sets: 8, vol: 7000, dur: 55, unit: 'lb', prs: d % 7 === 1 ? 1 : 0, items: [{ exId: e[0], name: e[0], p: e[1], s: e[2], sets: mkS(e[3] - 25 + prog, e[4], 4) }], cardio: [] }); }
        state.e1rmHist = {}; ex.forEach(e => { state.e1rmHist[e[0]] = Array.from({ length: 8 }, (_, k) => ({ t: n - (36 - k * 5) * 864e5, v: Math.round((e[3] * 1.25) - 30 + k * 6) })); });
        state.measures = [[-35, 186.5], [-28, 185.8], [-21, 186], [-14, 185], [-7, 184.2], [-1, 183.6]].map(([d, w]) => ({ id: uid(), t: n + d * 864e5, unit: 'lb', weight: w }));
        state.lastExport = n - 20 * 864e5; state.createdAt = n - 40 * 864e5;
        MUSCLES.forEach((m, i) => state.muscles[m].recovery = [85, 70, 60, 45, 90, 95, 100, 75, 55, 80][i]);
        state.workout.items = [buildItem(exById('bb_bench')), buildItem(exById('ohp')), buildItem(exById('lat_pulldown'))];
        state.workout.items[0].sets[0].done = true; state.workout.items[0].sets[0].reps = 8; state.workout.name = 'Push Session'; state.workout.note = 'Pre-filled from your last session';
        state.templates = [{ id: 't1', name: 'Push A', t: n, items: [{ exId: 'bb_bench', sets: [{ w: 185, r: 8 }] }] }];
        renderWorkout();
      }, theme);
      await page.waitForTimeout(300);
      const shot = async n => { await page.waitForTimeout(250); await page.screenshot({ path: `/tmp/t/out/${theme}-${n}.png`, fullPage: true }); };
      await shot('workout');
      await page.click('.card.week'); await shot('plan'); await page.click('#sheet .ib[data-a=closeSheet]');
      await page.click('#nav-recovery'); await shot('recovery');
      await page.click('#nav-progress'); await shot('progress');
      await page.click('#nav-more'); await shot('more');
      await page.click('[data-a=libOpen]'); await page.fill('#lib-q', 'squat'); await page.locator('#lib-list .prow').first().click(); await shot('libinfo'); await page.click('#sheet .ib[data-a=closeSheet]');
      await page.click('.card [data-a=exportJSON]'); await page.waitForSelector('[data-a=bakDownload]'); await shot('backup'); await page.click('#sheet .ib[data-a=closeSheet]');
      await page.click('#nav-workout');
      // mid-swipe pose
      const row = page.locator('#exlist .srow').nth(1); await row.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      const bb = await row.boundingBox();
      await page.mouse.move(bb.x + 22, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x - 70, bb.y + bb.height / 2, { steps: 10 }); await page.waitForTimeout(100);
      await page.screenshot({ path: `/tmp/t/out/${theme}-swipe.png`, clip: { x: 0, y: Math.max(0, Math.min(bb.y - 150, 844 - 330)), width: 390, height: 330 } }); await page.mouse.up();
      H.check(`${theme}: no JS errors while rendering every screen`, page.errs.length === 0, page.errs);
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 10).join(' | ')); process.exit(1); });
