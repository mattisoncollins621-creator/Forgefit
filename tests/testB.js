const H = require('./h'); const { chromium } = require('playwright'); const fs = require('fs');
const tick = async (page, n) => { await page.locator('#exlist .chk').nth(n).click(); for (let k = 0; k < 4; k++) { if (await page.locator('#pr:not([hidden])').count()) { await page.click('#pr [data-a=prNext]'); await page.waitForTimeout(80); } } await page.evaluate(() => { state.timer = null; $('#tbar').hidden = true; }); };
const setCount = page => page.evaluate(() => state.workout.items[0].sets.length);
const seed = page => page.evaluate(() => { state.workout.items = [buildItem(exById('bb_bench'), { weight: 135 }), buildItem(exById('bb_row'), { weight: 115 }), buildItem(exById('lat_pulldown'), { weight: 100 })]; scheduleSave(); renderWorkout(); });
async function mouseSwipe(page, sel, dx, dy = 0, steps = 12) {
  const bb = await page.locator(sel).first().boundingBox(); const x = bb.x + 20, y = bb.y + bb.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let k = 1; k <= steps; k++) await page.mouse.move(x + dx * k / steps, y + dy * k / steps);
  await page.mouse.up(); await page.waitForTimeout(120);
}
(async () => {
  H.sync(); const srv = await H.serve(8766); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8766/';
  try {
    console.log('== T4 swipe (mouse pointer events)');
    let { ctx, page } = await H.newPage(b);
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.click('[data-a=seenNew]'); await seed(page);
    const n0 = await setCount(page);
    await mouseSwipe(page, '#exlist [data-ex="0"] .srow', -60);
    H.check('short swipe (60px) does nothing', await setCount(page) === n0);
    await mouseSwipe(page, '#exlist [data-ex="0"] .srow', -130);
    H.check('swipe left deletes a set', await setCount(page) === n0 - 1, await setCount(page));
    H.check('undo toast shown', await page.locator('#toast.show.act [data-a=toastAct]').count() === 1);
    await page.click('#toast [data-a=toastAct]');
    H.check('undo restores the set', await setCount(page) === n0);
    await mouseSwipe(page, '#exlist [data-ex="0"] .srow', 130);
    H.check('swipe right duplicates a set', await setCount(page) === n0 + 1, await setCount(page));
    await mouseSwipe(page, '#exlist [data-ex="0"] .srow', 20, 90);
    H.check('vertical drag does not swipe', await setCount(page) === n0 + 1);
    await tick(page, 0); H.check('tapping the check button still logs a set', await page.locator('#exlist [data-ex="0"] .srow.done').count() === 1);
    // swipe-delete a logged set reverts its effects
    const before = await page.evaluate(() => state.muscles.Chest.recovery);
    await mouseSwipe(page, '#exlist [data-ex="0"] .srow.done', -130);
    const after = await page.evaluate(() => state.muscles.Chest.recovery);
    H.check('deleting a logged set undoes its fatigue', after > before, [before, after]);
    H.check('typing field: focus selects value', await (async () => { await page.locator('#exlist [data-ex="1"] .srow input').first().focus(); await page.waitForTimeout(60); return page.evaluate(() => { const e = document.activeElement; return e.selectionStart === 0 && e.selectionEnd === String(e.value).length && e.value.length > 0; }); })());
    await page.keyboard.type('120'); await page.keyboard.press('Tab');
    H.check('typed value replaces the old weight', await page.evaluate(() => state.workout.items[1].sets[0].weight) === 120);

    console.log('== T4b swipe (real touch events via CDP)');
    const t = await H.newPage(b, { opts: { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } } });
    await t.page.goto(URL + 'index.html'); await H.skipOnboarding(t.page); await t.page.click('[data-a=seenNew]'); await seed(t.page);
    const cdp = await t.ctx.newCDPSession(t.page);
    const touch = async (sel, dx, dy) => {
      const bb = await t.page.locator(sel).first().boundingBox(), x = bb.x + 24, y = bb.y + bb.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let k = 1; k <= 14; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * k / 14, y: y + dy * k / 14 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await t.page.waitForTimeout(150);
    };
    const m0 = await setCount(t.page);
    await touch('#exlist [data-ex="0"] .srow', -140, 0);
    H.check('touch swipe left deletes', await setCount(t.page) === m0 - 1, await setCount(t.page));
    await t.page.click('#toast [data-a=toastAct]');
    await touch('#exlist [data-ex="0"] .srow', 140, 0);
    H.check('touch swipe right duplicates', await setCount(t.page) === m0 + 1, await setCount(t.page));
    const sy0 = await t.page.evaluate(() => scrollY);
    await touch('#exlist [data-ex="1"] .srow', 0, -200);
    H.check('vertical touch scrolls the page, not the set', await setCount(t.page) === m0 + 1 && (await t.page.evaluate(() => scrollY)) !== sy0, [sy0, await t.page.evaluate(() => scrollY)]);
    H.check('no JS errors (touch)', t.page.errs.length === 0, t.page.errs);
    await t.ctx.close();

    console.log('== T5 drag reorder (regression)');
    await seed(page); await page.evaluate(() => scrollTo(0, 0));
    const grip = await page.locator('#exlist [data-ex="0"] .grip').boundingBox();
    await page.mouse.move(grip.x + 12, grip.y + 14); await page.mouse.down(); await page.mouse.move(grip.x + 12, grip.y + 60, { steps: 6 });
    const c1 = await page.locator('#exlist .ex').nth(1).boundingBox();
    await page.mouse.move(grip.x + 12, c1.y + c1.height - 4, { steps: 12 }); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(150);
    const order = await page.evaluate(() => state.workout.items.map(i => i.exId));
    H.check('dragging the first card down reorders the list', order[0] !== 'bb_bench' && order.includes('bb_bench'), order);
    H.check('cards re-expanded after drag', await page.locator('#exlist.reordering').count() === 0);

    console.log('== T6 quick log (regression)');
    await page.evaluate(() => { state.workout.items = []; state.history = []; renderWorkout(); });
    await page.click('[data-a=nl]'); await page.fill('#ql-text', 'bench 185x8x3, squat 3x5 at 225'); await page.click('[data-a=qlParse]');
    H.check('typed entries parsed', await page.locator('#ql-list .prow').count() === 2);
    await page.click('[data-a=qlGo]'); await page.waitForTimeout(250);
    const today = await page.evaluate(() => wk().items.map(i => [i.exId, i.sets.filter(s => s.done).length]));
    H.check('logged to today as done sets', today.some(x => x[0] === 'bb_bench' && x[1] === 3) && today.some(x => x[0] === 'bb_squat' && x[1] === 3), today);
    await page.click('[data-a=nl]'); await page.click('[data-a=qlMode][data-v=pick]'); await page.click('[data-a=qlF][data-v=all]'); await page.fill('#ql-q', 'pulldown'); await page.click('[data-a=qlPick]');
    await page.fill('[data-k=sets]', '2'); await page.fill('[data-k=r]', '10'); await page.fill('[data-k=w]', '110'); await page.click('[data-a=qlAdd]');
    await page.click('[data-a=qlDay][data-d="1"]'); await page.click('[data-a=qlGo]'); await page.waitForTimeout(250);
    const past = await page.evaluate(() => state.history.map(h => [h.manual, ymd(h.t) === ymd(Date.now() - 864e5), h.sets]));
    H.check('picked exercise logged to yesterday in history', past.length === 1 && past[0][0] && past[0][1] && past[0][2] === 2, past);

    console.log('== T7 trim chip');
    await page.evaluate(() => { state.history = [{ id: 'h1', t: Date.now() - 3 * 864e5, name: 'x', split: '', sets: 3, vol: 1, dur: 0, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'Bench', p: 'Chest', s: [], sets: [{ w: 135, r: 6, rir: 2, fail: false, type: 'work' }, { w: 135, r: 6, rir: 2, fail: false, type: 'work' }] }], cardio: [] }]; state.muscles.Chest.recovery = 40; state.workout.items = [buildItem(exById('bb_bench'))]; renderWorkout(); });
    H.check('no +chip when last session missed the rep target', await page.locator('.coach.up').count() === 0);
    H.check('fatigue chip shows at 40% fresh', await page.locator('.coach.dn').count() === 1);
    await page.click('.coach.dn'); const tw = await page.evaluate(() => state.workout.items[0].sets.map(s => s.weight));
    H.check('trim lowers 135 to 120 (10%, rounded to 5)', tw.every(w => w === 120), tw);
    H.check('trim chip disappears after use', await page.locator('.coach.dn').count() === 0);

    console.log('== T8 backup, reminder, share, import');
    await page.evaluate(() => { state.muscles.Chest.recovery = 100; state.createdAt = Date.now() - 20 * 864e5; state.lastExport = 0; state.backupSnooze = 0; renderWorkout(); });
    H.check('reminder banner appears after 2 weeks without a backup', await page.locator('.banner:has-text("Time for a backup")').count() === 1);
    await page.click('[data-a=backupLater]'); H.check('"Later" hides the reminder', await page.locator('.banner:has-text("Time for a backup")').count() === 0);
    await page.evaluate(() => { state.backupSnooze = 0; renderWorkout(); });
    await page.click('.banner [data-a=exportJSON]'); await page.waitForSelector('#sheet:not([hidden]) [data-a=bakDownload]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=bakDownload]')]);
    const path = await dl.path(); const json = JSON.parse(fs.readFileSync(path, 'utf8'));
    H.check('downloaded file is a ForgeFit backup with history', json.app === 'forgefit' && json.state.history.length === 1, Object.keys(json));
    H.check('file name has the date', /forgefit-backup-\d{4}-\d{2}-\d{2}\.json/.test(dl.suggestedFilename()), dl.suggestedFilename());
    H.check('lastExport recorded, reminder gone', await page.evaluate(() => state.lastExport > 0 && !backupDue()));
    await page.click('#nav-more');
    H.check('More shows last-backup status', await page.locator('.banner:has-text("Last backup")').count() === 1);
    // import round-trip
    await page.evaluate(() => { state.history = []; flushSave(); });
    fs.copyFileSync(path, '/tmp/t/out/backup.json');
    await page.setInputFiles('#import-in', '/tmp/t/out/backup.json'); await page.waitForTimeout(500);
    H.check('import restores history', await page.evaluate(() => state.history.length) === 1);
    // share path (iOS/Android): stubbed share sheet, must be called straight from the tap
    const s2 = await H.newPage(b, { seed: false });
    await s2.page.addInitScript(() => { navigator.canShare = () => true; navigator.share = async d => { window.__shared = { files: d.files.length, name: d.files[0].name, sync: true }; }; });
    await s2.page.goto(URL + 'index.html'); await H.skipOnboarding(s2.page); await s2.page.click('#nav-more');
    await s2.page.click('.card [data-a=exportJSON]'); await s2.page.waitForSelector('[data-a=bakShare]');
    await s2.page.click('[data-a=bakShare]'); await s2.page.waitForTimeout(200);
    const sh = await s2.page.evaluate(() => window.__shared);
    H.check('share sheet receives the backup file', sh && sh.files === 1 && /\.json$/.test(sh.name), sh);
    H.check('sharing marks the backup as done', await s2.page.evaluate(() => state.lastExport > 0));
    await s2.ctx.close();

    console.log('== T9 library');
    await page.click('#nav-more'); await page.click('[data-a=libOpen]'); await page.fill('#lib-q', 'bench');
    H.check('library search finds bench presses', await page.locator('#lib-list .prow').count() >= 3);
    await page.locator('#lib-list .prow').first().click();
    H.check('info sheet shows 3 how-to steps', await page.locator('ol.how li').count() === 3);
    H.check('info sheet has a video search link', (await page.locator('a[href*="youtube.com/results"]').getAttribute('href')).includes('proper%20form'));
    await page.click('[data-a=libAdd]'); await page.waitForTimeout(250);
    H.check('add to workout from the library', await page.evaluate(() => tab === 'workout' && wk().items.length > 0));
    await page.click('#exlist [data-a=exMenu]'); await page.click('[data-a=exInfo]');
    H.check('info reachable from the exercise menu', await page.locator('ol.how li').count() >= 1);
    H.check('no JS errors (batch B)', page.errs.length === 0, page.errs);
    await ctx.close();
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0,14).join(' | ')); process.exit(1); });
