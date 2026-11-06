const H = require('./h'); const { chromium } = require('playwright'); const fs = require('fs'); const W = '/tmp/t/www/';
(async () => {
  H.sync(); fs.copyFileSync('/home/claude/forgefit/reset.html', W + 'reset.html');
  const srv = await H.serve(8777); const b = await chromium.launch(); const U = 'http://127.0.0.1:8777/';
  // a deliberately stubborn old helper: cache-first for everything, never checks the network once saved
  const v9index = fs.readFileSync(W + 'index.html', 'utf8'), v9sw = fs.readFileSync(W + 'sw.js', 'utf8');
  fs.writeFileSync(W + 'index.html', v9index.replace("APP_VER = '11'", "APP_VER = '7'"));
  fs.writeFileSync(W + 'sw.js', `const V='forgefit-v7';self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(['./','./index.html'])).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.url.includes('sw.js'))return;e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(h=>h||fetch(e.request)))});`);
  const { ctx, page } = await H.newPage(b); 
  await page.goto(U); await H.skipOnboarding(page); await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true));
  await page.evaluate(() => { state.notes = 'KEEPME'; localStorage.setItem('keepme_probe', 'yes'); }); await page.waitForTimeout(600);
  await page.reload(); await page.waitForTimeout(800);
  H.check('stale copy is in place (v7)', await page.evaluate(() => APP_VER) === '7');
  await page.waitForTimeout(2500); await page.waitForLoadState('load');
  // "deploy" v9
  await page.evaluate(() => sessionStorage.setItem('ff_upd', JSON.stringify({ to: '11', t: Date.now() })));   // keep the in-app updater out of it, to isolate the stuck cache
  fs.writeFileSync(W + 'index.html', v9index);   // new page uploaded, but the old helper keeps answering from its saved copy
  await page.reload(); await page.waitForTimeout(2500); await page.waitForLoadState('load');
  H.check('plain reload stays stuck on old copy (reproduces the problem)', await page.evaluate(() => APP_VER) === '7');
  fs.writeFileSync(W + 'sw.js', v9sw);
  await page.goto(U + 'reset.html?x=1'); await page.waitForURL(/fresh=/, { timeout: 8000 }); await page.waitForTimeout(1200);
  H.check('after refresh page: newest version (v11) loads', await page.evaluate(() => APP_VER) === '11');
  H.check('localStorage data kept', await page.evaluate(() => localStorage.getItem('keepme_probe')) === 'yes');
  const keys = await page.evaluate(async () => (await caches.keys()));
  H.check('only the new cache remains', keys.every(k => k === 'forgefit-v11'), keys);
  H.check('no JS errors', page.errs.filter(e => !/Failed to load resource/.test(e)).length === 0, page.errs);
  await ctx.close(); await b.close(); srv.kill(); process.exit(H.summary() ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.slice(0, 300)); process.exit(1); });
