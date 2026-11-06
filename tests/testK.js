const H = require('./h'); const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  H.sync(); fs.copyFileSync('/home/claude/forgefit/reset.html', '/tmp/t/www/reset.html');
  const srv = await H.serve(8778); const b = await chromium.launch(); const U = 'http://127.0.0.1:8778/index.html';
  const np = async (th, w = 390) => { const { ctx, page } = await H.newPage(b, { noExpand: true, opts: { viewport: { width: w, height: 844 }, deviceScaleFactor: 1 } }); await page.goto(U); await H.skipOnboarding(page); if (th) await page.evaluate(t => { state.settings.theme = t; applyTheme(); }, th); return { ctx, page }; };
  const shot = (page, n) => page.screenshot({ path: `/tmp/t/out/v10-${n}.png` });
  try {
    let { ctx, page } = await np();
    console.log('== K1 plan screen');
    await page.evaluate(() => { state.seen = { v4: true, v8: true, tips: true }; renderWorkout(); });
    H.check('plan: Start workout button shown', await page.locator('[data-a=startWorkout]').count() >= 1);
    H.check('plan: exercises are compact rows (no set inputs)', await page.locator('#exlist .card.plan').count() >= 3 && await page.locator('#exlist .srow').count() === 0);
    H.check('plan: split / regenerate builder tools are on this screen', await page.locator('#tab-workout [data-a=regen]').count() === 1 && await page.locator('#tab-workout [data-a=split]').count() >= 5);
    H.check('plan: no End / Pause buttons yet', await page.locator('[data-a=endWorkout], [data-a=pauseWorkout]').count() === 0);
    H.check('plan: header clock hidden', await page.locator('#clock').isHidden());
    H.check('plan: drag handle and swap/menu on each row', await page.locator('#exlist .card.plan [data-drag]').count() >= 3 && await page.locator('#exlist .card.plan [data-a=exMenu]').count() >= 3);
    H.check('plan: row shows a sets summary', /\d+ × \d+|\d+×\d+/.test(await page.locator('#exlist .card.plan').first().innerText()));
    await shot(page, 'plan');
    console.log('== K2 expand a row to edit its sets');
    await page.locator('#exlist .card.plan [data-a=planExp]').first().click();
    H.check('tapping a row opens its set editor', await page.locator('#exlist [data-ex="0"] .srow').count() >= 2);
    H.check('expanded card can be collapsed again', (await page.locator('#exlist [data-ex="0"] [data-a=planExp]').count()) === 1);
    await page.locator('#exlist [data-ex="0"] [data-a=planExp]').click();
    H.check('collapse returns to the compact row', await page.locator('#exlist [data-ex="0"] .srow').count() === 0 && await page.locator('#exlist [data-ex="0"].plan').count() === 1);
    H.check('editing sets before starting does not start the workout', await page.evaluate(() => !sessActive()));

    console.log('== K3 start');
    await page.locator('[data-a=startWorkout]').first().click();
    H.check('workout is started', await page.evaluate(() => sessActive() && !sessPaused()));
    H.check('live: header shows In progress + clock', /in progress/i.test(await page.locator('.card.sess').innerText()) && await page.locator('#sess-time').count() === 1);
    H.check('live: set rows are shown for logging', await page.locator('#exlist .srow').count() >= 6);
    H.check('live: Start button and builder tools are gone', await page.locator('[data-a=startWorkout]').count() === 0 && await page.locator('#tab-workout [data-a=regen]').count() === 0 && await page.locator('#tab-workout [data-a=split]').count() === 0);
    H.check('live: Pause, Edit and End are available', await page.locator('[data-a=pauseWorkout]').count() === 1 && await page.locator('[data-a=editWorkout]').count() === 1 && await page.locator('[data-a=endWorkout]').count() === 2);
    H.check('live: add exercise / cardio still available under the list', await page.locator('#tab-workout > [data-a=addEx], #tab-workout .row [data-a=addEx]').count() >= 1);
    H.check('live: header clock visible', await page.locator('#clock').isVisible());
    await page.waitForTimeout(2300);
    const t1 = await page.locator('#sess-time').innerText();
    H.check('clock ticks every second', t1 !== '0:00' && /^0:0[2-9]$/.test(t1), t1);
    await shot(page, 'active');

    console.log('== K4 pause / resume');
    await page.locator('.srow .chk').first().click();           // a rest timer starts
    H.check('rest timer running after logging a set', await page.evaluate(() => !!state.timer));
    await page.click('[data-a=pauseWorkout]');
    const p = await page.evaluate(async () => { const a = sessMs(); await new Promise(r => setTimeout(r, 1300)); return { a, b: sessMs(), paused: sessPaused(), timer: !!state.timer, rest: wk().pausedRest }; });
    H.check('paused: time is frozen', p.paused && p.a === p.b, p);
    H.check('paused: rest timer is parked, not lost', !p.timer && p.rest > 0, p);
    H.check('paused: shows Paused label and Resume button', /paused/i.test(await page.locator('.card.sess').innerText()) && await page.locator('[data-a=resumeWorkout]').count() === 1 && await page.locator('[data-a=pauseWorkout]').count() === 0);
    H.check('paused: header clock shows pause icon', /⏸/.test(await page.locator('#clock').innerText()));
    await shot(page, 'paused');
    await page.waitForTimeout(1500);
    await page.click('[data-a=resumeWorkout]');
    const r = await page.evaluate(() => ({ paused: sessPaused(), timer: !!state.timer, pm: wk().pausedMs }));
    H.check('resume: running again with the rest timer restored', !r.paused && r.timer && r.pm >= 2000, r);
    H.check('paused minutes are not counted', await page.evaluate(() => { const w = wk(); const keep = [w.startedAt, w.pausedMs]; w.startedAt = Date.now() - 600000; w.pausedMs = 120000; const v = sessMs(); [w.startedAt, w.pausedMs] = keep; return Math.abs(v - 480000) < 1500; }));
    await page.click('[data-a=pauseWorkout]');
    await page.locator('.srow .chk').nth(1).click();
    H.check('logging a set while paused resumes automatically', await page.evaluate(() => !sessPaused()));

    console.log('== K5 edit on the fly');
    const before = await page.evaluate(() => ({ s: wk().startedAt, n: wk().items.length }));
    await page.click('[data-a=editWorkout]');
    H.check('Edit sheet has split, regenerate, quick log, templates, add exercise', await page.locator('#sheet [data-x=regen]').count() === 1 && await page.locator('#sheet [data-x=split]').count() >= 5 && await page.locator('#sheet [data-x=nl]').count() === 1 && await page.locator('#sheet [data-x=tplOpen]').count() === 1 && await page.locator('#sheet [data-x=addEx]').count() === 1);
    await page.click('#sheet [data-x=addEx]'); await page.waitForSelector('#sheet:not([hidden]) [data-a=pickEx]');
    await page.locator('#sheet [data-a=pickEx]').first().click(); await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ s: wk().startedAt, n: wk().items.length }));
    H.check('adding an exercise mid-workout keeps the clock and logged sets', after.s === before.s && after.n === before.n + 1 && await page.evaluate(() => doneSetCount()) >= 2, { before, after });
    await page.click('[data-a=editWorkout]'); await page.click('#sheet [data-x=split][data-v=legs]'); await page.waitForTimeout(400);
    const sp = await page.evaluate(() => ({ s: wk().startedAt, split: state.split, live: sessActive(), name: wk().name }));
    H.check('switching split mid-workout keeps the session running', sp.s === before.s && sp.split === 'legs' && sp.live, sp);
    await page.click('[data-a=editWorkout]'); await page.click('#sheet [data-x=regen]'); await page.waitForTimeout(400);
    H.check('regenerate mid-workout keeps the session running', await page.evaluate(() => wk().startedAt) === before.s);
    await page.click('[data-a=editWorkout]'); await page.click('#sheet [data-x=nl]'); await page.waitForSelector('#sheet:not([hidden]) #ql-text');
    H.check('Quick log opens from the Edit sheet', true); await page.click('#sheet .ib[data-a=closeSheet]');
    await shot(page, 'live-after-edit');
    await page.click('[data-a=editWorkout]'); await shot(page, 'edit-sheet'); await page.click('#sheet .ib[data-a=closeSheet]');

    console.log('== K6 reload mid-workout');
    await page.evaluate(() => flushSave()); await page.waitForTimeout(400);
    const s0 = await page.evaluate(() => wk().startedAt); await page.reload(); await page.waitForSelector('#nav'); await page.waitForTimeout(500);
    H.check('after a reload the session is still live with the same start time', await page.evaluate(s => sessActive() && wk().startedAt === s, s0) && await page.locator('.card.sess').count() === 1);
    await ctx.close();

    console.log('== K7 end with nothing logged');
    ({ ctx, page } = await np()); await page.evaluate(() => { state.seen = { v4: true, v8: true, tips: true }; renderWorkout(); });
    await page.locator('[data-a=startWorkout]').first().click();
    await page.locator('[data-a=endWorkout]').first().click();
    H.check('End sheet explains nothing is logged', /Nothing is logged/.test(await page.locator('#sheet').innerText()) && await page.locator('#sheet [data-a=finish]').count() === 0);
    await shot(page, 'end-empty');
    await page.click('#sheet [data-a=closeSheet].btn');
    H.check('Keep going closes the sheet and the session continues', await page.evaluate(() => sessActive() && $('#sheet').hidden));
    const n0 = await page.evaluate(() => wk().items.length);
    await page.locator('[data-a=endWorkout]').first().click(); await page.click('#sheet [data-a=discardWorkout]');
    H.check('ending returns to the plan with exercises kept', await page.evaluate(n => !sessActive() && wk().items.length === n, n0) && await page.locator('[data-a=startWorkout]').count() >= 1 && await page.locator('#exlist .card.plan').count() === n0);
    H.check('ending an empty session adds nothing to history', await page.evaluate(() => state.history.length) === 0);

    console.log('== K8 end with sets logged, summary');
    await page.locator('[data-a=startWorkout]').first().click();
    await page.evaluate(() => { const w = wk(); w.startedAt = Date.now() - 41 * 60000; });
    for (let i = 0; i < 5; i++) { await page.locator('.srow .chk:not(.on)').first().click(); await page.waitForTimeout(80); while (await page.locator('#pr:not([hidden]) [data-a=prNext]').count()) await page.click('#pr [data-a=prNext]'); }
    const logged = await page.evaluate(() => doneSetCount());
    await page.locator('[data-a=endWorkout]').first().click();
    H.check('End sheet offers Finish & save / Discard / Keep going', await page.locator('#sheet [data-a=finish]').count() === 1 && await page.locator('#sheet [data-a=discardWorkout]').count() === 1 && /5 sets/.test(await page.locator('#sheet').innerText()), await page.locator('#sheet').innerText());
    await shot(page, 'end-sets');
    await page.click('#sheet [data-a=finish]'); await page.waitForSelector('#sheet-t:has-text("Workout complete")');
    const sum = await page.locator('#sheet').innerText();
    H.check('summary shows duration, calories, sets, volume, PRs', /Active time/.test(sum) && /kcal burned/.test(sum) && /Hard sets/.test(sum) && /volume/.test(sum) && /PRs/.test(sum), sum.slice(0, 200));
    const rec = await page.evaluate(() => state.history[0]);
    H.check('history record has minutes, calories, and ≥ 40 min active', rec && rec.dur >= 40 && rec.kcal > 100 && rec.kcal < 900 && rec.sets >= 1, rec && { d: rec.dur, k: rec.kcal });
    H.check('calorie tile matches the saved record', sum.includes(rec.kcal.toLocaleString()));
    H.check('summary has an Achievements section or an encouraging note', /achievements/i.test(sum) || /No records this time/.test(sum));
    H.check('first-ever workout earns the first-workout achievement', /first workout/i.test(sum));
    H.check('session cleared after finishing', await page.evaluate(() => !sessActive() && !wk().pausedAt));
    await shot(page, 'summary');
    await page.click('#sheet .btn.pri[data-a=closeSheet]'); await page.waitForTimeout(300);
    H.check('Done returns to the plan screen (Workout tab, Start button)', await page.evaluate(() => tab) === 'workout' && await page.locator('[data-a=startWorkout]').count() >= 1 && await page.locator('#clock').isHidden());
    await ctx.close();

    console.log('== K9 calorie estimate sanity');
    ({ ctx, page } = await np());
    const k = await page.evaluate(() => {
      state.profile.unit = 'lb'; state.profile.weight = 180;
      const a = estKcal({ min: 45, workSets: 15, cardio: [] }), short = estKcal({ min: 20, workSets: 15, cardio: [] });
      const withRun = estKcal({ min: 75, workSets: 15, cardio: [{ exId: 'cardio_run', min: 30 }] });
      state.profile.weight = 250; const heavy = estKcal({ min: 45, workSets: 15, cardio: [] });
      state.profile.unit = 'kg'; state.profile.weight = 81.65; const kg = estKcal({ min: 45, workSets: 15, cardio: [] });
      state.profile.unit = 'lb'; state.profile.weight = 180;
      return { a, short, withRun, heavy, kg, none: estKcal({ min: 0, workSets: 0, cardio: [] }) };
    });
    H.check('45 min lifting @180 lb is a believable number', k.a >= 200 && k.a <= 450, k);
    H.check('longer time burns more; cardio adds', k.withRun > k.a && k.a > k.short * 0.8, k);
    H.check('heavier body burns more', k.heavy > k.a, k);
    H.check('kg and lb give the same answer', Math.abs(k.kg - k.a) <= 10, k);
    H.check('empty session is 0 kcal', k.none === 0, k);
    console.log('== K10 achievements logic');
    const ach = await page.evaluate(() => {
      const mk = (vol, t) => ({ t, vol, unit: 'lb', sets: 10, items: [], cardio: [] });
      const prior = [mk(8000, 1), mk(9000, 2), mk(8500, 3), mk(9500, 4)];        // 4 earlier workouts → this is #5
      const rec = { t: Date.now(), vol: 12000, unit: 'lb', cardio: [{ exId: 'cardio_run', name: 'Run (Outdoor / Treadmill)', min: 30 }] };
      prior[3].cardio = [{ exId: 'cardio_run', min: 20 }];
      const out = sessAchievements(rec, prior, [{ name: 'Barbell Bench Press', w: 190, r: 5, now: 222, prev: 215 }, { name: 'Cable Row', w: 100, r: 10, now: 133, prev: null }], { curN: 0 });
      return out.map(a => a.t);
    });
    H.check('PR is called out', ach.some(t => /New PR: Barbell Bench Press/.test(t)), ach);
    H.check('first-time lift is a "first record", not a PR', ach.some(t => /First record: Cable Row/.test(t)) && !ach.some(t => /New PR: Cable/.test(t)), ach);
    H.check('volume record is called out', ach.some(t => /Biggest session ever by volume/.test(t)), ach);
    H.check('workout #5 milestone', ach.some(t => /Workout #5/.test(t)), ach);
    H.check('longest cardio yet', ach.some(t => /Longest Run/.test(t)), ach);
    const none = await page.evaluate(() => sessAchievements({ t: Date.now(), vol: 100, unit: 'lb', cardio: [] }, Array.from({ length: 6 }, (_, i) => ({ t: i, vol: 5000, unit: 'lb', sets: 5, items: [], cardio: [] })), [], { curN: 0 }).map(a => a.t));
    H.check('an ordinary session has no made-up achievements', none.length === 0, none);
    await ctx.close();

    console.log('== K11 settings groups');
    ({ ctx, page } = await np());
    await page.click('#nav-more');
    const heads = await page.locator('#tab-more .grpt').allInnerTexts();
    H.check('three labelled sections', heads.map(x => x.toLowerCase()).join('|') === 'preferences|workout setup|data & app', heads);
    const names = await page.locator('#tab-more .grph b').allInnerTexts();
    H.check('ten groups in sensible order', names.join('|') === 'Appearance & units|Training|Sound & haptics|Timers & screen|Equipment|Library & routines|People|Data & backup|Integrations|App version & advanced', names);
    H.check('settings are collapsed (except Data & backup, because no backup exists yet)', await page.locator('#tab-more .grph[aria-expanded=true]').count() === 1 && await page.locator('#tab-more .grph[data-k=data][aria-expanded=true]').count() === 1);
    H.check('collapsed groups hide their controls', await page.locator('#tab-more [data-a=themeSet]').count() === 0);
    await page.click('#tab-more [data-k=display]');
    H.check('tapping a group opens it', await page.locator('#tab-more [data-a=themeSet]').count() === 3 && await page.locator('#tab-more [data-a=unitSet]').count() === 2);
    await page.click('#tab-more [data-a=themeSet][data-v=light]');
    H.check('changing a setting does not collapse the group', await page.locator('#tab-more [data-a=themeSet]').count() === 3 && await page.evaluate(() => state.settings.theme) === 'light');
    await page.click('[data-a=moreAll]');
    H.check('Expand all shows every control', await page.locator('#tab-more .grph[aria-expanded=true]').count() === 10);
    for (const sel of ['[data-a=exportJSON]', '[data-a=importJSON]', '[data-a=gearToggle]', '[data-a=libOpen]', '[data-a=planOpen]', '[data-a=tplOpen]', '[data-a=cxOpen]', '[data-a=profAdd]', '[data-a=checkUpdate]', '#json-ta', '[data-k=restC]', '[data-f=platesCsv]', '[data-k=tone]', '[data-k=weekStart]', '[data-k=notify]', '[data-k=wake]', '[data-k=rpe]', '[data-k=warmups]', '[data-k=prefill]', '[data-a=testFx]', '#ver-line', '[data-a=wipe]'])
      H.check('still reachable: ' + sel, await page.locator('#tab-more ' + sel).count() >= 1);
    H.check('no controls are nested in a second card (no card-in-card)', await page.locator('#tab-more .grpb .card').count() === 0);
    await shot(page, 'more-all-light');
    await page.click('[data-a=moreAll]');
    H.check('Collapse all closes everything', await page.locator('#tab-more .grph[aria-expanded=true]').count() === 0);
    await page.evaluate(() => { state.settings.theme = 'dark'; applyTheme(); renderMore(); });
    await shot(page, 'more-collapsed-dark');
    await page.click('#tab-more [data-k=sound]'); await page.click('#tab-more [data-k=training]'); await shot(page, 'more-two-open-dark');
    await page.evaluate(() => A.moreGrp({ dataset: { k: 'people' } }));
    await ctx.close();

    console.log('== K12 phone widths + themes, no errors');
    for (const [th, w] of [['dark', 390], ['light', 390], ['dark', 360]]) {
      ({ ctx, page } = await np(th, w)); await page.evaluate(() => { state.seen = { v4: true, v8: true, tips: true }; renderWorkout(); });
      const wide = async (n) => H.check(`${th} ${w}px ${n}: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await wide('plan');
      await page.locator('[data-a=startWorkout]').first().click(); await wide('live');
      await page.screenshot({ path: `/tmp/t/out/v10-${th}${w}-live.png` });
      await page.click('[data-a=pauseWorkout]'); await wide('paused'); await page.screenshot({ path: `/tmp/t/out/v10-${th}${w}-paused.png` }); await page.click('[data-a=resumeWorkout]');
      await page.click('[data-a=editWorkout]'); await wide('edit sheet'); await page.click('#sheet .ib[data-a=closeSheet]');
      await page.locator('.srow .chk').first().click(); await page.locator('.srow .chk').nth(1).click();
      await page.locator('[data-a=endWorkout]').first().click(); await page.click('#sheet [data-a=finish]'); await page.waitForSelector('#sheet-t:has-text("Workout complete")'); await wide('summary');
      await page.screenshot({ path: `/tmp/t/out/v10-${th}${w}-summary.png` }); await page.click('#sheet .btn.pri[data-a=closeSheet]');
      await page.click('#nav-more'); await page.click('[data-a=moreAll]'); await wide('settings');
      H.check(`${th} ${w}px: no unknown hooks`, (await H.unknownHooks(page)).length === 0, await H.unknownHooks(page));
      H.check(`${th} ${w}px: no JS errors`, page.errs.filter(e => !/Failed to load resource/.test(e)).length === 0, page.errs);
      await ctx.close();
    }

    console.log('== K13 share text, repeat/template keep working');
    ({ ctx, page } = await np()); await page.evaluate(() => { state.seen = { v4: true, v8: true, tips: true }; });
    await page.locator('[data-a=startWorkout]').first().click(); await page.locator('.srow .chk').first().click(); await page.locator('[data-a=endWorkout]').first().click(); await page.click('#sheet [data-a=finish]'); await page.waitForSelector('#sheet-t:has-text("Workout complete")');
    const txt = await page.evaluate(() => { let out = ''; window.shareText = t => { out = t; }; A.sessShare(); return out; });
    H.check('shared summary includes kcal', /~\d+ kcal/.test(txt), txt);
    await page.click('#sheet .btn.pri[data-a=closeSheet]');
    await page.click('[data-a=repeatLast]'); await page.waitForTimeout(300);
    H.check('Repeat last workout loads it into the plan (not started)', await page.evaluate(() => !sessActive() && wk().items.length > 0) && await page.locator('[data-a=startWorkout]').count() >= 1);
    await ctx.close();
  } finally { await b.close(); srv.kill(); process.exit(H.summary() ? 1 : 0); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
