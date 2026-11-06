const H = require('./h'); const { chromium } = require('playwright'); const fs = require('fs'); const { execSync } = require('child_process');
const W = '/tmp/t/www/';
const mkNext = () => { // build a fake "next release": v9 of index + sw
  fs.writeFileSync(W + 'index.v9', fs.readFileSync(W + 'index.html', 'utf8').replace("APP_VER = '12'", "APP_VER = '13'"));
  fs.writeFileSync(W + 'sw.v9', fs.readFileSync(W + 'sw.js', 'utf8').replace('forgefit-v12', 'forgefit-v13'));
};
const release = () => { fs.copyFileSync(W + 'index.v9', W + 'index.html'); fs.copyFileSync(W + 'sw.v9', W + 'sw.js'); };
(async () => {
  H.sync(); mkNext(); const srv = await H.serve(8772); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8772/';
  try {
    console.log('== H1 version label + manual check when up to date');
    let { ctx, page } = await H.newPage(b);
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(500);
    await page.click('#nav-more');
    H.check('More shows the version (v12) and a Check for updates button', (await page.locator('#ver-line').textContent()) === 'ForgeFit v12' && await page.locator('[data-a=checkUpdate]').count() === 1);
    await page.click('[data-a=checkUpdate]'); await page.waitForSelector('#toast.show');
    H.check('up to date → "You have the latest version (v12)"', /latest version \(v12\)/.test(await page.locator('#toast').textContent()), await page.locator('#toast').textContent());
    H.check('every hook on the More screen still resolves', (await H.unknownHooks(page)).length === 0, await H.unknownHooks(page));

    console.log('== H2 you are idle when a new release goes out → updates itself, data kept');
    await page.evaluate(() => { state.history = [{ id: 'h1', t: Date.now() - 864e5, name: 'Push', split: 'push', sets: 3, vol: 5000, dur: 50, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'b', p: 'Chest', s: [], sets: [{ w: 185, r: 8, rir: 2, type: 'work' }] }], cardio: [] }]; flushSave(); });
    await page.click('#nav-workout'); release();
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });   // (visible already) – use the manual path of the same engine too
    await page.evaluate(() => { updLast = 0; });
    const nav = page.waitForNavigation({ timeout: 12000 }).catch(() => null);
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await nav; await page.waitForSelector('#nav', { timeout: 10000 }); await page.waitForTimeout(700);
    const v = await page.evaluate(() => ({ ver: APP_VER, hist: state.history.length, sw: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL, keys: null }));
    H.check('page reloaded itself into v10', v.ver === '13', v);
    H.check('workout history is intact after the update', v.hist === 1, v);
    H.check('"Updated to v13" confirmation shown', /Updated to v13/.test(await page.locator('#toast').textContent()), await page.locator('#toast').textContent());
    const keys = await page.evaluate(() => caches.keys()); H.check('old cache is gone, v10 cache present', keys.includes('forgefit-v13') && !keys.includes('forgefit-v12'), keys);
    H.check('no JS errors through the update', page.errs.length === 0, page.errs);
    await ctx.close();

    console.log('== H3 mid-workout → asks first, never reloads under you');
    H.sync(); mkNext();
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(500);
    await page.evaluate(() => { wk().startedAt = Date.now(); flushSave(); });
    let reloads = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) reloads++; });
    release(); await page.evaluate(() => { updLast = 0; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForSelector('#toast.show.act', { timeout: 8000 });
    H.check('toast offers an "Update" button', (await page.locator('#toast').textContent()).includes('v13 is ready') && await page.locator('#toast [data-a=toastAct]').count() === 1, await page.locator('#toast').textContent());
    await page.waitForTimeout(1500);
    H.check('workout screen not reloaded while it waits', reloads === 0 && await page.evaluate(() => !!wk().startedAt), reloads);
    const nav2 = page.waitForNavigation({ timeout: 12000 }); await page.click('#toast [data-a=toastAct]'); await nav2; await page.waitForSelector('#nav'); await page.waitForTimeout(500);
    H.check('tapping Update moves to v10 and keeps the workout in progress', await page.evaluate(() => APP_VER === '13' && !!wk().startedAt));
    await ctx.close();

    console.log('== H4 stuck old copy: new index, old cached shell → manual button repairs it');
    H.sync(); mkNext();
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(500);
    release();
    await page.click('#nav-more');
    const nav3 = page.waitForNavigation({ timeout: 12000 }); await page.click('[data-a=checkUpdate]'); await nav3; await page.waitForSelector('#nav'); await page.waitForTimeout(500);
    H.check('"Check for updates" pulls v10 immediately', await page.evaluate(() => APP_VER) === '13');
    await ctx.close();

    console.log('== H5 network-first: a plain reopen gets the newest page, offline still works');
    H.sync(); mkNext();
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(600);
    await page.reload(); await page.waitForSelector('#nav'); await page.waitForTimeout(400);
    release();
    await page.evaluate(() => { sessionStorage.setItem('ff_upd', JSON.stringify({ to: '13', t: Date.now() })); });   // block the in-app updater so we test the service worker alone
    await page.reload(); await page.waitForSelector('#nav');
    H.check('one plain reload after a release already shows v10 (no double-open needed)', await page.evaluate(() => APP_VER) === '13');
    await page.waitForTimeout(500);
    await ctx.setOffline(true); await page.reload(); await page.waitForSelector('#nav');
    H.check('offline: app still opens from the saved copy', await page.locator('#exlist .ex').count() >= 1);
    await ctx.setOffline(false);
    H.check('no JS errors', page.errs.filter(e => !/Failed to load resource|net::ERR/.test(e)).length === 0, page.errs);
    await ctx.close();

    console.log('== H6 guard rails');
    H.sync(); mkNext();
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.evaluate(() => navigator.serviceWorker.ready);
    // server claims v11 but keeps serving the v9 page: the updater must try once, not loop forever
    fs.writeFileSync(W + 'sw.js', fs.readFileSync(W + 'sw.js', 'utf8').replace('forgefit-v12', 'forgefit-v14'));
    let navs = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navs++; });
    await page.evaluate(() => { updLast = 0; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(6000); const n6 = navs; await page.waitForTimeout(9000);
    H.check('a server that never delivers the new page does not cause a reload loop', n6 <= 2 && navs === n6, { n6, navs });
    H.check('app is still usable afterwards', await page.locator('#nav').count() === 1 && page.errs.length === 0, page.errs);
    // offline update check shows a friendly message
    H.sync(); mkNext();
    await ctx.close();
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(500);
    await page.click('#nav-more'); await ctx.setOffline(true); await page.click('[data-a=checkUpdate]'); await page.waitForSelector('#toast.show');
    H.check('offline "Check for updates" says it could not reach the server', /Could not check/.test(await page.locator('#toast').textContent()), await page.locator('#toast').textContent());
    await ctx.setOffline(false); await ctx.close();
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 8).join(' | ')); process.exit(1); });
