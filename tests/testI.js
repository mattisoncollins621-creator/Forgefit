const H = require('./h'); const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  H.sync(); fs.copyFileSync('/tmp/t/index_v_delivered.html', '/tmp/t/www/delivered.html');
  const srv = await H.serve(8775); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8775/';
  const seed = () => { // 6 bench sessions over ~5 weeks (flat e1RM => stalled), squat rising, last week + prior week activity
    const now = Date.now(), cur = weekStartOf(now), mk = (t, exId, name, p, sec, sets, extra = {}) => ({ id: uid(), t, name: name + ' Session', split: 'push', sets: sets.length, vol: sets.reduce((a, s) => a + s.w * s.r, 0), dur: 55, unit: 'lb', prs: 0, items: [{ exId, name, p, s: sec, sets: sets.map(s => ({ ...s, rir: 2, type: 'work' })) }], cardio: [], ...extra });
    const h = [];
    // bench: flat for 5 weeks
    [34, 27, 20, 13, 6, 2].forEach((d, k) => h.push(mk(now - d * DAY, 'bb_bench', 'Barbell Bench Press', 'Chest', ['Triceps'], [{ w: 185, r: 8 }, { w: 185, r: 8 }, { w: 185, r: k % 2 ? 7 : 8 }])));
    // squat: rising
    [30, 23, 16, 9, 3].forEach((d, k) => h.push(mk(now - d * DAY, 'bb_squat', 'Barbell Back Squat', 'Quads', ['Glutes'], [{ w: 205 + k * 10, r: 6 }, { w: 205 + k * 10, r: 6 }])));
    // last week (Tue + Thu), two weeks ago (Tue)
    h.push(mk(cur - 7 * DAY + 1 * DAY + 10 * 36e5, 'ohp', 'Barbell Overhead Press', 'Shoulders', ['Triceps'], [{ w: 105, r: 8 }, { w: 105, r: 8 }, { w: 105, r: 8 }], { prs: 1 }));
    h.push(mk(cur - 7 * DAY + 3 * DAY + 10 * 36e5, 'bb_row', 'Barbell Bent-Over Row', 'Back', ['Biceps'], [{ w: 155, r: 8 }, { w: 155, r: 8 }]));
    h.push(mk(cur - 14 * DAY + 1 * DAY + 10 * 36e5, 'ohp', 'Barbell Overhead Press', 'Shoulders', ['Triceps'], [{ w: 100, r: 8 }, { w: 100, r: 8 }]));
    h.sort((a, b) => b.t - a.t); state.history = h;
    const pts = (arr, ds) => arr.map((v, i) => ({ t: now - ds[i] * DAY, v }));
    state.e1rmHist = { bb_bench: pts([233, 234, 233, 233, 232, 233], [34, 27, 20, 13, 6, 2]), bb_squat: pts([246, 256, 266, 276, 286], [30, 23, 16, 9, 3]), ohp: pts([128, 133], [14 - 1, 6]) };
    state.prs = { bb_bench: { e1rm: 234, weight: 185, reps: 8, t: now - 27 * DAY }, bb_squat: { e1rm: 286, weight: 245, reps: 6, t: now - 3 * DAY }, ohp: { e1rm: 133, weight: 105, reps: 8, t: now - 6 * DAY } };
    state.e1rm = { ...state.e1rm, bb_bench: 233, bb_squat: 286, ohp: 133 };
    state.profile.done = true; flushSave();
  };
  try {
    console.log('== I1 upgrade from the build you have now (v6 data) keeps everything, adds new fields');
    let { ctx, page } = await H.newPage(b);
    await page.goto(URL + 'delivered.html'); await H.skipOnboarding(page);
    await page.evaluate(seed); await page.waitForTimeout(300);
    await page.goto(URL + 'index.html'); await page.waitForTimeout(700);
    let r = await page.evaluate(() => ({ h: state.history.length, favs: Array.isArray(state.favs), notes: typeof state.exNotes === 'object', e1: state.e1rm.bb_bench, v: APP_VER }));
    H.check('history/e1RM survive, favs + notes fields created', r.h === 14 && r.favs && r.notes && r.e1 === 233, r);

    console.log('== I2 favorites and recents');
    await page.evaluate(() => { state.seen.v8 = true; state.seen.v4 = true; renderWorkout(); });
    await page.click('#nav-more'); await page.click('[data-a=libOpen]'); await page.fill('#lib-q', 'hack squat'); await page.locator('#lib-list .prow').first().click();
    const btn = page.locator('#sheet [data-a=favToggle]'); H.check('info sheet shows an "Add to favorites" button', /Add to favorites/.test(await btn.textContent()));
    await btn.click(); H.check('button flips to ★ Favorite and the state saves', /★ Favorite/.test(await btn.textContent()) && await page.evaluate(() => isFav('hack_squat')));
    await page.click('#sheet .ib[data-a=closeSheet]');
    await page.click('#nav-workout'); await page.click('[data-a=addEx]'); await page.check('[data-f=pickall]');
    let names = await page.locator('#pick-list .prow b').allInnerTexts();
    H.check('favorites sort first in Add exercise and carry a ★', names[0].startsWith('★') && /Hack Squat/.test(names[0]), names.slice(0, 3));
    H.check('then recently used lifts come before the rest (bench, squat, row, press near the top)', ['Barbell Bench Press', 'Barbell Back Squat'].every(n => names.slice(1, 8).some(x => x.includes(n))), names.slice(0, 8));
    await page.click('#pick-f [data-v=fav]'); names = await page.locator('#pick-list .prow b').allInnerTexts();
    H.check('Favorites chip lists only starred lifts', names.length === 1 && /Hack Squat/.test(names[0]), names);
    await page.click('#pick-f [data-v=recent]'); names = await page.locator('#pick-list .prow b').allInnerTexts();
    H.check('Recent chip lists the lifts you actually logged', names.length >= 4 && names.some(n => n.includes('Overhead Press')) && !names.some(n => n.includes('Hack')), names);
    await page.evaluate(() => { state.favs = []; }); await page.click('#pick-f [data-v=fav]');
    H.check('empty Favorites tells you how to add one', /No favorites yet/.test(await page.locator('#pick-list').innerText()));
    await page.click('#sheet .ib[data-a=closeSheet]');
    // swap picker + quick log use the same chips
    await page.evaluate(() => { state.favs = ['cable_curl']; });
    await page.click('[data-a=nl]'); const qlText = await page.locator('#sheet').innerText();
    await page.click('#sheet .ib[data-a=closeSheet]').catch(() => { });
    H.check('quick log opens without errors after the change', page.errs.length === 0, page.errs);

    console.log('== I3 notes');
    await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench')), buildItem(exById('bb_squat'))]; renderWorkout(); });
    await page.locator('#exlist [data-a=exMenu]').first().click();
    H.check('⋯ menu has favorite + note + history buttons', await page.locator('#sheet [data-a=favToggle]').count() === 1 && await page.locator('#sheet [data-a=noteOpen]').count() === 1 && await page.locator('#sheet [data-a=exHist]').count() === 1);
    await page.click('#sheet [data-a=noteOpen]');
    await page.fill('#note-in', 'Seat 4 <b>narrow</b> grip & pause'); await page.click('#sheet [data-a=noteSave]'); await page.waitForTimeout(200);
    let note = await page.locator('#exlist .exnote').first().innerText();
    H.check('note shows on the card as plain text (HTML escaped)', note.includes('<b>narrow</b>') && note.includes('Seat 4') && await page.locator('#exlist .exnote b').count() === 0, note);
    await page.reload(); await page.waitForSelector('#nav'); await page.waitForTimeout(500);
    H.check('note survives a reload', await page.evaluate(() => noteOf('bb_bench')).then(v => v.includes('Seat 4')));
    await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench'))]; renderWorkout(); });
    H.check('note appears on any future card for that lift', await page.locator('#exlist .exnote').count() === 1);
    await page.click('#exlist .exnote'); await page.fill('#note-in', 'x'.repeat(400)); await page.click('#sheet [data-a=noteSave]');
    H.check('note is capped at 160 characters', await page.evaluate(() => noteOf('bb_bench').length) === 160);
    await page.click('#exlist .exnote'); await page.click('#sheet [data-a=noteClear]');
    H.check('Clear removes the note', await page.locator('#exlist .exnote').count() === 0 && await page.evaluate(() => !('bb_bench' in state.exNotes)));
    await page.evaluate(() => { state.exNotes.bb_bench = 'keep me'; state.favs = ['bb_squat']; flushSave(); });
    const bk = await page.evaluate(async () => { const f = await buildBackup(); const o = JSON.parse(await f.text()); return { n: o.state.exNotes, f: o.state.favs }; });
    H.check('backup file carries notes and favorites', bk.n.bb_bench === 'keep me' && bk.f[0] === 'bb_squat', bk);

    console.log('== I4 full history of a lift');
    await page.evaluate(() => { document.querySelector('#nav-progress').click(); });
    await page.click('[data-a=exHist]');
    let t = await page.locator('#sheet').innerText();
    H.check('history sheet shows sessions, est. 1RM, best set', /Sessions/.test(t) && /Est\. 1RM/.test(t) && /Best set/.test(t), t.slice(0, 160));
    const rows = await page.locator('#sheet .prow.static').count();
    H.check('one row per session (6 bench sessions)', rows === 6, rows);
    H.check('chart + stalled banner present for the flat lift', await page.locator('#sheet svg.chart').count() === 1 && /Stalled for about/.test(t));
    H.check('rows show sets like 185×8', /185×8 · 185×8/.test(t));
    await page.click('#sheet .ib[data-a=closeSheet]');
    const hs = await page.evaluate(() => { setUnit('kg'); const ex = exById('bb_bench'), s = exSessions(ex)[0].sets.map(x => x.w); setUnit('lb'); return s; });
    H.check('lb history converts when the app is in kg (185 lb → 85 kg)', hs.every(w => w === 85), hs);
    await page.evaluate(() => A.exHist({ dataset: { id: 'plank' } })); t = await page.locator('#sheet').innerText();
    H.check('a seconds/bodyweight exercise with no history shows a friendly empty message', /No sessions logged/.test(t) && /Best reps/.test(t), t.slice(0, 160));
    await page.click('#sheet .ib[data-a=closeSheet]');
    await page.evaluate(() => { A.exInfo({ dataset: { id: 'cardio_run' } }); });
    H.check('cardio has no history/note button but can be favorited', await page.locator('#sheet [data-a=exHist]').count() === 0 && await page.locator('#sheet [data-a=noteOpen]').count() === 0 && await page.locator('#sheet [data-a=favToggle]').count() === 1);
    await page.click('#sheet .ib[data-a=closeSheet]');

    console.log('== I5 stalled lifts');
    const st = await page.evaluate(() => ({ bench: stalledInfo('bb_bench'), squat: stalledInfo('bb_squat'), ohp: stalledInfo('ohp'), plank: stalledInfo('plank') }));
    H.check('flat bench is flagged (>= 2 weeks), rising squat is not', st.bench && st.bench.weeks >= 2 && st.squat === null, st);
    H.check('lifts with < 4 data points or noE1 are never flagged', st.ohp === null && st.plank === null, st);
    const old = await page.evaluate(() => { const a = state.e1rmHist.bb_bench; const keep = JSON.stringify(a); state.e1rmHist.bb_bench = a.map(p => ({ ...p, t: p.t - 60 * DAY })); const r = stalledInfo('bb_bench'); state.e1rmHist.bb_bench = JSON.parse(keep); return r; });
    H.check('a lift you stopped doing weeks ago is not flagged', old === null);
    await page.click('#nav-progress'); t = await page.locator('#tab-progress').innerText();
    H.check('Progress shows a Stalled lifts card naming bench only', /Stalled lifts/.test(t) && /Barbell Bench Press/.test(t.split('Stalled lifts')[1].slice(0, 400)) && !/Barbell Back Squat[^]{0,80}wks/.test(t));
    await page.click('#nav-workout'); await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench'))]; renderWorkout(); });
    H.check('stalled tag appears on the workout card', await page.locator('#exlist .tag.am', { hasText: 'stalled' }).count() === 1);

    console.log('== I6 records');
    await page.click('#nav-progress'); await page.click('[data-a=recOpen]');
    let names2 = await page.locator('#sheet .prow .grow b').allInnerTexts();
    H.check('records list has all 3 lifts, newest first (squat, press, bench)', names2.length === 3 && /Squat/.test(names2[0]) && /Overhead/.test(names2[1]) && /Bench/.test(names2[2]), names2);
    await page.click('#sheet [data-v=az]'); names2 = await page.locator('#sheet .prow .grow b').allInnerTexts();
    H.check('A–Z sort', /Back Squat/.test(names2[0]) && /Bench/.test(names2[1]), names2);
    await page.click('#sheet [data-v=heavy]'); names2 = await page.locator('#sheet .prow .grow b').allInnerTexts();
    H.check('Heaviest sort puts the 245 lb squat first', /Squat/.test(names2[0]) , names2);
    await page.locator('#sheet .prow').first().click(); H.check('tapping a record opens that lift’s history', /history/.test(await page.locator('#sheet-t').innerText()));
    await page.click('#sheet .ib[data-a=closeSheet]');
    await page.evaluate(() => { const p = state.prs; state.prs = {}; A.recOpen(); window.__p = p; });
    H.check('empty records explains itself', /No records yet/.test(await page.locator('#sheet').innerText()));
    await page.evaluate(() => { state.prs = window.__p; }); await page.click('#sheet .ib[data-a=closeSheet]');

    console.log('== I7 weekly recap');
    await page.evaluate(() => { state.seen = { v4: true, v8: true }; renderWorkout(); }); await page.click('#nav-workout');
    const lw = await page.evaluate(() => { const cur = weekStartOf(Date.now()), hs = state.history.filter(h => h.t >= cur - 7 * DAY && h.t < cur); return { n: hs.length, sets: hs.reduce((a, h) => a + h.sets, 0), vol: Math.round(hs.reduce((a, h) => a + h.vol, 0)), days: new Set(hs.map(h => ymd(h.t))).size, prs: hs.reduce((a, h) => a + h.prs, 0) }; });
    const wt = await page.locator('#tab-workout').innerText();
    H.check('Workout shows the "week in review" banner with last week’s numbers', /Your week in review/.test(wt) && wt.includes(`${lw.n} sessions · ${lw.sets} sets · ${lw.vol.toLocaleString()} lb`), { lw, wt: wt.slice(0, 300) });
    await page.click('[data-a=recapOpen]'); t = await page.locator('#sheet').innerText();
    const exp = await page.evaluate(() => { const S = weekStats(addDays(weekStartOf(Date.now()), -7)); return S; });
    H.check('recap opens on LAST week and its totals match an independent count of the history', /Last week/.test(t) && exp.sessions === lw.n && exp.sets === lw.sets && exp.vol === lw.vol && exp.days === lw.days && exp.prs === lw.prs && t.includes(lw.vol.toLocaleString()), { exp, lw, t: t.slice(0, 200) });
    H.check('shows biggest gain, trained days vs plan, streak', /Biggest gain/.test(t) && /Barbell Back Squat: estimated 1RM up/.test(t) && new RegExp(`trained on ${lw.days} days`).test(t), t);
    H.check('compares with the previous week (volume/sets change shown)', /\+\d+%/.test(t), t);
    H.check('under-target muscles are called out', /Skipped or light/.test(t));
    await page.click('#sheet [data-a=recapGo][data-d="-1"]'); t = await page.locator('#sheet').innerText();
    H.check('Newer › goes to this week so far', /This week so far/.test(t));
    await page.click('#sheet [data-a=recapGo][data-d="1"]'); await page.click('#sheet [data-a=recapGo][data-d="1"]'); t = await page.locator('#sheet').innerText();
    H.check('Older ‹ moves back two weeks without breaking', /Barbell|sessions|Sessions|No sessions/i.test(t) && page.errs.length === 0, page.errs);
    await page.click('#sheet .ib[data-a=closeSheet]');
    H.check('opening the recap marks it seen: banner is gone', !/Your week in review/.test(await page.locator('#tab-workout').innerText()));
    await page.evaluate(() => { state.seen = { v4: true, v8: true }; renderWorkout(); }); await page.click('[data-a=recapDismiss]');
    H.check('"Later" hides the banner for the week', !/Your week in review/.test(await page.locator('#tab-workout').innerText()));
    await page.evaluate(() => { state.seen = { v4: true, v8: true }; const keep = state.history; state.history = keep.filter(h => h.t < weekStartOf(Date.now()) - 7 * DAY); renderWorkout(); window.__k = keep; });
    H.check('no banner when last week had no sessions', !/Your week in review/.test(await page.locator('#tab-workout').innerText()));
    await page.evaluate(() => { state.history = window.__k; });

    console.log('== I8 photo compare');
    const png = c => page.evaluate(async c => { const cv = document.createElement('canvas'); cv.width = 60; cv.height = 80; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 60, 80); return await new Promise(r => cv.toBlob(b => r(b), 'image/png')); }, c);
    await page.evaluate(async () => {
      const mk = async (id, t, c) => { const cv = document.createElement('canvas'); cv.width = 60; cv.height = 80; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 60, 80); const blob = await new Promise(r => cv.toBlob(r, 'image/png')); await idbPut('photos', { id, t, blob }); state.photos.push({ id, t }); };
      state.photos = []; await mk('pa', Date.now() - 60 * DAY, '#c00'); 
      state.measures = [{ id: 'm1', t: Date.now() - 58 * DAY, unit: 'lb', weight: 190 }, { id: 'm2', t: Date.now() - 1 * DAY, unit: 'lb', weight: 184.4 }];
      renderBody();
    });
    await page.click('#nav-body'); H.check('one photo: no Compare button yet', await page.locator('[data-a=photoCmp]').count() === 0);
    await page.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 60; cv.height = 80; const x = cv.getContext('2d'); x.fillStyle = '#0a0'; x.fillRect(0, 0, 60, 80); const blob = await new Promise(r => cv.toBlob(r, 'image/png')); await idbPut('photos', { id: 'pb', t: Date.now() - 2 * DAY, blob }); state.photos.push({ id: 'pb', t: Date.now() - 2 * DAY }); renderBody(); });
    await page.waitForTimeout(300);
    H.check('two photos: Compare button appears', await page.locator('[data-a=photoCmp]').count() === 1);
    await page.click('[data-a=photoCmp]'); await page.waitForSelector('#cmp-view .cmp2 img'); await page.waitForTimeout(300);
    const imgs = await page.evaluate(() => [...document.querySelectorAll('#cmp-view img')].map(i => [i.naturalWidth, i.alt]));
    H.check('both photos load side by side', imgs.length === 2 && imgs.every(i => i[0] === 60) && imgs[0][1].startsWith('Before'), imgs);
    t = await page.locator('#cmp-view').innerText();
    H.check('shows days apart and the weight change between the dates', /58 days apart/.test(t) && /190 → 184\.4 lb \(-5\.6\)/.test(t), t);
    const before1 = await page.evaluate(() => document.querySelector('#cmp-view img').src);
    await page.click('[data-a=cmpSwap]'); await page.waitForTimeout(300);
    const before2 = await page.evaluate(() => document.querySelector('#cmp-view img').src);
    H.check('Swap sides exchanges the two photos', before1 !== before2);
    await page.click('#sheet .ib[data-a=closeSheet]');
    H.check('closing the compare sheet frees the image URLs', await page.evaluate(() => cmpUrls.length) === 0);

    console.log('== I9 empty states and first-run help (brand-new person)');
    await ctx.close();
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    t = await page.locator('#tab-workout').innerText();
    H.check('new person sees Getting started (not What’s new)', /Getting started/.test(t) && !/What’s new/.test(t));
    await page.click('[data-a=seenNew]'); H.check('Got it hides it for good', !/Getting started/.test(await page.locator('#tab-workout').innerText()));
    await page.evaluate(() => { state.workout.items = []; renderWorkout(); });
    H.check('empty workout shows the friendly card with two actions', await page.locator('#exlist .emptyico').count() === 1 && await page.locator('#exlist [data-a=regen]').count() === 1);
    await page.click('#exlist [data-a=regen]'); H.check('"Build a workout" fills the session', await page.locator('#exlist .ex').count() >= 3);
    await page.click('#nav-progress'); t = await page.locator('#tab-progress').innerText();
    H.check('Progress explains itself before the first workout', /charts start with your first workout/.test(t) && await page.locator('#tab-progress [data-a=go][data-t=workout]').count() === 1);
    await page.click('#tab-progress [data-a=go][data-t=workout]'); H.check('its button goes to Workout', await page.locator('#tab-workout').isVisible());
    await page.click('#nav-body'); t = await page.locator('#tab-body').innerText();
    H.check('Body empty states give guidance', /Take one every few weeks/.test(t) && /Save your weight above/.test(t));
    await page.click('#nav-progress'); await page.click('[data-a=recapOpen]'); H.check('recap with no history is a calm empty message', /Nothing logged yet this week|No sessions/.test(await page.locator('#sheet').innerText()));
    await page.click('#sheet .ib[data-a=closeSheet]'); await page.click('[data-a=recOpen]'); await page.click('#sheet .ib[data-a=closeSheet]');
    H.check('no JS errors on empty screens', page.errs.length === 0, page.errs);
    // existing person who finished onboarding with history sees What's new once
    await page.evaluate(seed); await page.evaluate(() => { state.seen = {}; renderWorkout(); });
    H.check('existing person sees the new What’s new card', /What’s new/.test(await page.locator('#tab-workout').innerText()) && /Favorites and recents/.test(await page.locator('#tab-workout').innerText()));
    await page.click('#nav-workout'); await page.click('[data-a=seenNew]'); H.check('and Got it dismisses it', !/What’s new/.test(await page.locator('#tab-workout').innerText()));

    console.log('== I10 animation + sound');
    await page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench'))]; state.workout.items[0].sets[0].reps = 8; renderWorkout(); });
    await page.click('#exlist .chk >> nth=0'); 
    H.check('completing a set adds the pop animation class briefly', await page.locator('#exlist .srow.pop').count() === 1);
    await page.waitForTimeout(1000); H.check('and removes it afterwards', await page.locator('#exlist .srow.pop').count() === 0);
    const f = await page.evaluate(() => { try { cue('finish'); buzz('finish'); cue('pr'); return 'ok'; } catch (e) { return e.message; } });
    H.check('finish/PR cues run without errors', f === 'ok', f);
    while (await page.locator('#pr:not([hidden]) [data-a=prNext]').count()) await page.click('#pr [data-a=prNext]');
    await page.click('[data-a=finish]'); await page.waitForSelector('#sheet:not([hidden])'); H.check('finishing still logs the session', /Workout complete/.test(await page.locator('#sheet-t').innerText()));
    await page.click('#sheet .ib[data-a=closeSheet]'); await page.waitForTimeout(300);
    await ctx.close();
    const rm = await H.newPage(b, { opts: { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' } });
    await rm.page.goto(URL + 'index.html'); await H.skipOnboarding(rm.page);
    await rm.page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench'))]; state.workout.items[0].sets[0].reps = 8; renderWorkout(); });
    await rm.page.click('#exlist .chk >> nth=0');
    const an = await rm.page.evaluate(() => getComputedStyle(document.querySelector('#exlist .srow')).animationName);
    H.check('reduced-motion phones get no animation', an === 'none', an);
    await rm.ctx.close();

    console.log('== I11 every button/field hook resolves, no errors (dark + light)');
    for (const th of ['dark', 'light']) {
      ({ ctx, page } = await H.newPage(b));
      await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.evaluate(seed); await page.evaluate(th => { state.settings.theme = th; applyTheme(); state.seen = { v4: true }; renderWorkout(); }, th);
      let bad = [];
      for (const tab of ['workout', 'recovery', 'progress', 'body', 'more']) { await page.click('#nav-' + tab); await page.waitForTimeout(150); bad.push(...await H.unknownHooks(page)); }
      for (const open of ["A.recOpen()", "A.recapOpen()", "A.exHist({dataset:{id:'bb_bench'}})", "A.exInfo({dataset:{id:'bb_bench'}})", "A.noteOpen({dataset:{id:'bb_bench'}})", "A.libOpen()"]) { await page.evaluate(open); await page.waitForTimeout(120); bad.push(...await H.unknownHooks(page)); await page.evaluate(() => closeSheet()); }
      H.check(`${th}: no unknown hooks anywhere`, bad.length === 0, [...new Set(bad)]);
      H.check(`${th}: no JS errors`, page.errs.length === 0, page.errs);
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 8).join(' | ')); process.exit(1); });
