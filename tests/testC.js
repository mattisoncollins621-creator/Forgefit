const H = require('./h'); const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  H.sync(); const srv = await H.serve(8767); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8767/';
  const DAYMS = 864e5;
  try {
    console.log('== T10 plan sheet + training blocks');
    let { ctx, page } = await H.newPage(b);
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.click('[data-a=seenNew]');
    await page.evaluate(() => { state.profile.splitPref = 'ppl'; state.profile.days = 3; state.profile.trainDays = null; scheduleSave(); renderWorkout(); });
    await page.click('.card.week'); await page.waitForSelector('#sheet:not([hidden])');
    H.check('plan sheet opens with 7 day chips', await page.locator('[data-a=planDay]').count() === 7);
    const td0 = await page.evaluate(() => trainDays());
    H.check('default 3-day schedule is Mon/Wed/Fri', JSON.stringify(td0) === '[1,3,5]', td0);
    await page.click('[data-a=planDay][data-d="6"]');
    const td1 = await page.evaluate(() => [trainDays(), state.profile.days]);
    H.check('tapping Saturday adds a training day and updates the goal', JSON.stringify(td1) === '[[1,3,5,6],4]', td1);
    await page.click('[data-a=blockWeeks][data-n="8"]'); await page.click('[data-a=blockStart]');
    H.check('8-week block starts at week 1 with RIR +1', await page.evaluate(() => { const i = blockInfo(); return i.week === 1 && i.weeks === 8 && blockRirAdj() === 1; }));
    const ramp = await page.evaluate(() => { const out = []; for (let w = 1; w <= 9; w++) { state.block.start = sod(Date.now()) - (w - 1) * 7 * 864e5; const i = blockInfo(); out.push(i.done ? 'done' : i.deload ? 'DL' : blockRirAdj()); } return out; });
    H.check('RIR ramps 3→2→1 then deload then done', JSON.stringify(ramp) === JSON.stringify([1, 1, 1, 0, 0, -1, -1, 'DL', 'done']), ramp);
    await page.evaluate(() => { state.block = { weeks: 8, start: sod(Date.now()) }; });
    await page.click('#sheet [data-a=closeSheet].ib'); await page.waitForTimeout(200);
    await page.click('[data-a=regen]'); await page.waitForTimeout(200);
    const rir = await page.evaluate(() => state.workout.items.filter(i => !i.cardio).map(i => i.sets[0].rir));
    H.check('regenerated workout uses block week-1 target (3 RIR)', rir.length > 0 && rir.every(r => r === 3), rir);
    H.check('workout note mentions the block', (await page.locator('.px4 .mut').first().textContent()).includes('Block week 1 of 8'));
    await page.evaluate(() => { state.block.start = sod(Date.now()) - 7 * 7 * 864e5; checkBlock(); renderWorkout(); });
    H.check('final block week triggers an automatic deload', await page.evaluate(() => isDeload() && state.lastDeload > Date.now() - 5000));
    H.check('deload banner explains it is the block', await page.locator('.banner:has-text("final week of your training block")').count() === 1);
    const dl = await page.evaluate(() => state.workout.items.filter(i => !i.cardio).map(i => i.sets[0].rir));
    H.check('deload workout has +1 RIR', dl.every(r => r === 3), dl);
    await page.click('[data-a=endDeload]'); H.check('End deload works for block deloads', await page.evaluate(() => !isDeload()));
    await page.evaluate(() => { state.block.start = sod(Date.now()) - 9 * 7 * 864e5; renderWorkout(); });
    H.check('finished block offers the next one', await page.locator('.banner:has-text("Training block complete")').count() === 1);
    await page.click('[data-a=blockAck]'); H.check('dismissing the completion banner works', await page.locator('.banner:has-text("Training block complete")').count() === 0);
    H.check('no JS errors (plan/blocks)', page.errs.length === 0, page.errs);

    console.log('== T11 streak, T12 rest advice');
    await page.evaluate(() => { state.block = null; state.profile.days = 3; state.profile.trainDays = null; state.history = []; });
    const st = await page.evaluate(() => {
      const mk = t => ({ id: uid(), t, name: 'x', split: 'push', sets: 3, vol: 100, dur: 30, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'Bench', p: 'Chest', s: [], sets: [{ w: 100, r: 8, rir: 2, type: 'work' }] }], cardio: [] });
      const ws = weekStartOf(Date.now()), noon = d => addDays(ws, d) + 12 * 36e5, now = Date.now();
      [-14, -13, -11, -7, -6, -4].forEach(d => state.history.push(mk(noon(d))));          // two full previous weeks with 3 sessions
      for (let d = 0; d < 7; d++) if (noon(d) < now && d < 3) state.history.push(mk(noon(d)));
      state.history.sort((a, b) => b.t - a.t);
      const a = streakInfo(); const cur = a.curN;
      state.history = state.history.filter(h => h.t !== noon(-4)); const b = streakInfo();
      return { a, cur, b };
    });
    const expect = 2 + (st.cur >= 3 ? 1 : 0);
    H.check('streak counts consecutive weeks that hit the goal', st.a.streak === expect && st.a.best >= st.a.streak, st);
    H.check('missing a session in the last full week breaks the earlier part', st.b.streak === (st.cur >= 3 ? 1 : 0), st.b);
    await page.evaluate(() => renderWorkout());
    H.check('week strip marks trained days', await page.locator('.wd.did').count() >= 1);
    const adv = await page.evaluate(() => {
      state.history = []; MUSCLES.forEach(m => state.muscles[m].recovery = 30); const a = restAdvice().tone;
      MUSCLES.forEach(m => state.muscles[m].recovery = 95); state.lastTick = Date.now(); const g = restAdvice().tone;
      MUSCLES.forEach(m => state.muscles[m].recovery = 62); state.lastTick = Date.now(); const l = restAdvice().tone;
      state.history.push({ id: 'z', t: Date.now(), name: 'x', items: [{ exId: 'bb_bench', name: 'b', p: 'Chest', s: [], sets: [{ w: 1, r: 1, rir: 2, type: 'work' }] }], cardio: [] }); const d = restAdvice().tone;
      return [a, g, l, d];
    });
    H.check('rest advice: low=rest, high=go, middle=light, trained=done', JSON.stringify(adv) === '["rest","go","light","ok"]', adv);
    await page.evaluate(() => { MUSCLES.forEach(m => state.muscles[m].recovery = 30); state.history = []; state.lastTick = Date.now(); });
    await page.click('#nav-recovery'); H.check('Recovery tab shows the rest-day card', await page.locator('.banner:has-text("Take a rest day")').count() === 1);

    console.log('== T13 nudge, T14 progress analytics');
    await page.evaluate(() => {
      MUSCLES.forEach(m => { state.muscles[m].recovery = 100; state.muscles[m].lastTrained = Date.now() - 20 * 864e5; }); state.lastTick = Date.now(); state.nudgeSnooze = 0;
      state.history = [2, 5, 8].map(d => ({ id: uid(), t: Date.now() - d * 864e5, name: 'Pull', split: 'pull', sets: 10, vol: 5000, dur: 40, unit: 'lb', prs: 0, items: [{ exId: 'bb_row', name: 'Row', p: 'Back', s: ['Biceps'], sets: Array.from({ length: 6 }, () => ({ w: 135, r: 8, rir: 2, type: 'work' })) }], cardio: [] }));
      MUSCLES.filter(m => m !== 'Chest').forEach(m => { state.muscles[m].lastTrained = Date.now() - 1 * 864e5; });
    });
    await page.click('#nav-workout');
    H.check('neglected muscle nudge appears', await page.locator('.banner:has-text("Chest is falling behind")').count() === 1);
    await page.click('[data-a=nudgeAdd]'); await page.waitForSelector('#pick-f .chip.on');
    H.check('nudge opens the exercise picker filtered to that muscle', (await page.locator('#pick-f .chip.on').textContent()) === 'Chest');
    await page.click('#sheet .ib[data-a=closeSheet]'); await page.click('[data-a=nudgeLater]');
    H.check('"Later" snoozes the nudge', await page.locator('.banner:has-text("falling behind")').count() === 0);
    await page.evaluate(() => {
      const n = Date.now(); state.measures = [[-60, 180], [-30, 182], [-1, 184]].map(([d, w]) => ({ id: uid(), t: n + d * 864e5, unit: 'lb', weight: w }));
      state.e1rmHist = { bb_bench: [[-60, 200], [-30, 210], [-1, 225]].map(([d, v]) => ({ t: n + d * 864e5, v })), bb_row: [[-45, 150], [-20, 160], [-2, 170]].map(([d, v]) => ({ t: n + d * 864e5, v })) };
    });
    await page.click('#nav-progress');
    H.check('bodyweight-vs-strength chart draws two lines', await page.locator('.card:has(h2:text("Bodyweight vs strength")) path.ln').count() === 2);
    H.check('chart legend shows both series', (await page.locator('.legend').textContent()).includes('Strength') && (await page.locator('.legend').textContent()).includes('Bodyweight'));
    H.check('weekly sets show status + 4-week trend for every muscle', await page.locator('.wsub').count() === 10);
    H.check('streak tile in Progress', await page.locator('.tiles.t4 .tile').count() === 4);
    await page.evaluate(() => { state.measures = []; renderProgress(); });
    H.check('without weight entries the chart explains what to log', await page.locator('.empty:has-text("Log your weight")').count() === 1);
    await page.selectOption('[data-f=progRange]', '30'); await page.waitForTimeout(100);
    H.check('range selector still works', page.errs.length === 0, page.errs);
    H.check('no JS errors (analytics)', page.errs.length === 0, page.errs);

    console.log('== T15 profiles on one phone');
    await page.evaluate(() => { state.history = [{ id: 'keep', t: Date.now() - 864e5, name: 'Mine', split: '', sets: 3, vol: 100, dur: 20, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'Bench', p: 'Chest', s: [], sets: [{ w: 100, r: 8, rir: 2, type: 'work' }] }], cardio: [] }]; flushSave(); });
    await page.click('#nav-more'); await page.click('[data-a=profAdd]'); await page.fill('#ask-in', 'Wife');
    await Promise.all([page.waitForNavigation(), page.click('[data-a=askOk]')]);
    await page.waitForSelector('#onboard:not([hidden])');
    H.check('new person starts with a clean onboarding', await page.evaluate(() => PROFILES.list.length === 2 && PROFILES.active !== 'main' && state.history.length === 0));
    await page.click('[data-a=obSkip]'); await page.waitForTimeout(200);
    H.check('header shows who is active', (await page.locator('#pname').textContent()).includes('Wife') && await page.locator('#pname').isVisible());
    await page.evaluate(() => flushSave());
    const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('forgefit_state_v3')));
    H.check('each person has separate storage keys', keys.length === 2 && keys.includes('forgefit_state_v3'), keys);
    await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_squat'), { weight: 95 })]; flushSave(); });
    await page.click('#pname'); await Promise.all([page.waitForNavigation(), page.click('[data-a=profSwitch][data-id=main]')]);
    await page.waitForSelector('#nav');
    H.check('switching back restores the first person’s data untouched', await page.evaluate(() => state.history.length === 1 && state.history[0].id === 'keep' && PROFILES.active === 'main'));
    await page.click('#nav-more'); await page.click('[data-a=profDel]'); await page.waitForTimeout(400);
    H.check('deleting the other person removes their data', await page.evaluate(() => PROFILES.list.length === 1 && Object.keys(localStorage).filter(k => k.startsWith('forgefit_state_v3')).length === 1));
    H.check('header pill hides with a single person', await page.locator('#pname').isHidden());
    H.check('no JS errors (profiles)', page.errs.length === 0, page.errs);
    await ctx.close();

    console.log('== T16 routine links');
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    const link = await page.evaluate(() => { saveTemplate('Push <b>A</b>', [{ exId: 'bb_bench', superset: null, sets: [{ w: 135, r: 8 }, { w: 135, r: 8 }] }, { exId: 'ohp', superset: null, sets: [{ w: 85, r: 8 }] }]); return { link: tplLink(state.templates[0]), code: encodeTpl(state.templates[0]) }; });
    H.check('link is the app URL plus a #ff1= payload', link.link.startsWith(URL + 'index.html#ff1='), link.link.slice(0, 60));
    await page.click('#nav-more'); await page.click('#tab-more [data-a=tplOpen]'); await page.click('[data-a=tplShare]');
    H.check('share sheet offers link and code', await page.locator('[data-a=tplSendLink]').count() === 1 && await page.locator('[data-a=tplCopyCode]').count() === 1);
    const w = await H.newPage(b);
    await w.page.goto(link.link); await w.page.waitForSelector('#onboard:not([hidden])');
    H.check('link hash is cleared from the address bar', (await w.page.evaluate(() => location.hash)) === '');
    await w.page.click('[data-a=obSkip]'); await w.page.waitForSelector('#sheet:not([hidden]) [data-a=incomingSave]');
    H.check('asks before saving the shared routine (after onboarding)', (await w.page.locator('#sheet-b').textContent()).includes('2 exercises'));
    H.check('shared name is shown as text, not markup', await w.page.locator('#sheet-b b').count() === 0 || (await w.page.locator('#sheet-b .prow b').textContent()).includes('<b>A</b>'));
    await w.page.click('[data-a=incomingSave]');
    H.check('routine saved on the other phone', await w.page.evaluate(() => state.templates.length === 1 && state.templates[0].items.length === 2));
    await w.page.click('#nav-workout'); await w.page.click('[data-a=tplOpen]'); await w.page.click('[data-a=tplImport]');
    await w.page.fill('#tpl-code', 'Look at this routine!\n' + link.code + '\nenjoy'); await w.page.click('[data-a=tplImportGo]');
    H.check('pasting a whole message with the code also imports', await w.page.evaluate(() => state.templates.length === 2));
    await w.page.goto(URL + 'index.html#ff1=AAAAAAAAAAAAAAAAAAAAAAAA'); await w.page.waitForSelector('#nav');
    H.check('a broken link shows a message and does not crash', w.page.errs.length === 0, w.page.errs);
    await w.ctx.close(); await ctx.close();

    console.log('== T17 light theme');
    ({ ctx, page } = await H.newPage(b, { opts: { colorScheme: 'dark', viewport: { width: 390, height: 844 } } }));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.click('[data-a=seenNew]');
    await page.click('#nav-more'); await page.click('[data-a=themeSet][data-v=light]');
    H.check('light theme applied', await page.evaluate(() => document.documentElement.dataset.theme) === 'light' && (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(243, 245, 249)');
    H.check('theme-color meta follows the theme', (await page.getAttribute('meta[name=theme-color]', 'content')) === '#f2f4f9');
    await page.reload(); await page.waitForSelector('#nav');
    H.check('theme survives reload', await page.evaluate(() => document.documentElement.dataset.theme) === 'light');
    await page.click('#nav-more'); await page.click('[data-a=themeSet][data-v=auto]');
    H.check('"match phone" follows a dark phone', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    await page.emulateMedia({ colorScheme: 'light' }); await page.evaluate(() => applyTheme());
    H.check('"match phone" follows a light phone', await page.evaluate(() => document.documentElement.dataset.theme) === 'light');
    await page.click('[data-a=themeSet][data-v=dark]'); H.check('can return to dark', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    await ctx.close();

    console.log('== T18 icons, manifest, offline, update notice');
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    const meta = await page.evaluate(async () => {
      const m = await (await fetch('manifest.webmanifest')).json(), out = { icons: [] };
      for (const i of m.icons) { const r = await fetch(i.src); out.icons.push([i.src, r.status, r.headers.get('content-type')]); }
      out.apple = document.querySelector('link[rel=apple-touch-icon]').getAttribute('href'); out.title = document.querySelector('meta[name=apple-mobile-web-app-title]').content;
      return out;
    });
    H.check('every manifest icon loads', meta.icons.every(i => i[1] === 200), meta.icons);
    H.check('PNG icons are real PNGs', meta.icons.filter(i => i[0].endsWith('.png')).every(i => i[2] === 'image/png'), meta.icons);
    H.check('apple-touch-icon + short home-screen name set', meta.apple === 'icon-180.png' && meta.title === 'ForgeFit', meta);
    await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector('#nav');
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const cached = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); const reqs = (await c.keys()).map(r => new URL(r.url).pathname); return { ks, reqs }; });
    H.check('service worker cache v11 holds the app shell + icons', cached.ks.includes('forgefit-v11') && ['/index.html', '/icon-180.png', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'].every(p => cached.reqs.includes(p)), cached);
    await ctx.setOffline(true); await page.reload(); await page.waitForSelector('#nav');
    H.check('app opens fully offline', await page.locator('#exlist .ex').count() >= 1);
    await page.click('#nav-progress'); await page.click('#nav-more'); H.check('tabs work offline', page.errs.filter(e => !/Failed to load resource|net::ERR/.test(e)).length === 0, page.errs);
    await ctx.setOffline(false);
    // simulate a new release: the next service worker takes over and the app offers a reload
    fs.writeFileSync("/tmp/t/www/sw.js", fs.readFileSync("/tmp/t/www/sw.js", "utf8").replace("forgefit-v11", "forgefit-v12"));
    await page.evaluate(() => { wk().startedAt = Date.now(); });   // mid-workout: the app must NOT reload itself
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await page.waitForSelector('#toast.show.act', { timeout: 8000 });
    H.check('mid-workout, a new version only offers a Reload button (never reloads on its own)', (await page.locator('#toast').textContent()).includes('updated') && await page.locator('#toast [data-a=toastAct]').count() === 1);
    await ctx.close();
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 10).join(' | ')); process.exit(1); });
