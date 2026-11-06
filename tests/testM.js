const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8795); const b = await chromium.launch(); const U = 'http://127.0.0.1:8795/index.html';
  try {
    console.log('== M v12 overhaul');
    const { page } = await H.newPage(b, { noExpand: true });
    await page.goto(U); await H.skipOnboarding(page);
    await page.evaluate(() => { state.seen.v8 = true; state.seen.v4 = true; renderWorkout(); });
    // --- global
    H.check('nav shows Settings (not More) with 5 tabs', (await page.locator('#nav button').allInnerTexts()).join('|') === 'Workout|Recovery|Progress|Body|Settings');
    H.check('nav icons are 20px', await page.evaluate(() => [...document.querySelectorAll('#nav svg')].every(s => Math.round(s.getBoundingClientRect().width) === 20)));
    H.check('canvas + glass chrome tokens', await page.evaluate(() => { const c = getComputedStyle(document.body).backgroundColor, n = getComputedStyle(document.querySelector('#nav')); return c === 'rgb(10, 12, 16)' && (n.backdropFilter || n.webkitBackdropFilter || '').includes('blur(16px)') && n.backgroundColor === 'rgba(10, 12, 16, 0.85)'; }));
    H.check('tabular figures on body', await page.evaluate(() => getComputedStyle(document.body).fontVariantNumeric.includes('tabular-nums')));
    // --- workout
    H.check('exactly one Start workout button and it floats above the tab bar', await page.locator('[data-a=startWorkout]').count() === 1 && await page.evaluate(() => { const f = document.querySelector('.fab'), n = document.querySelector('#nav').getBoundingClientRect(), r = f.getBoundingClientRect(); return getComputedStyle(f).position === 'fixed' && r.bottom <= n.top + 1 && r.bottom > n.top - 30; }));
    H.check('split carousel has orange active pill + Smart/Push/Pull/Legs/Upper/Lower', await page.evaluate(() => { const t = [...document.querySelectorAll('.splits .chip')].map(c => c.textContent.trim()); return ['Smart', 'Push', 'Pull', 'Legs', 'Upper', 'Lower'].every(x => t.includes(x)) && document.querySelector('.splits .chip.on').textContent.trim() === 'Smart'; }));
    H.check('session card: title, metadata chips and ghost Regenerate icon', await page.locator('.hero-card .ttl').count() === 1 && (await page.locator('.mchips').innerText()).match(/exercise/) && await page.locator('.hero-card [data-a=regen]').count() === 1);
    H.check('toolbar is one row of four 38px glass buttons', await page.evaluate(() => { const bs = [...document.querySelectorAll('.toolbar button')]; return bs.length === 4 && bs.every(b => Math.round(b.getBoundingClientRect().height) === 38) && new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size === 1; }));
    await page.click('[data-a=wkMore]'); H.check('More opens Repeat last / Plan / Regenerate', (await page.locator('#sheet-b').innerText()).includes('Repeat last workout') && (await page.locator('#sheet-b').innerText()).includes('Plan'));
    await page.click('#sheet .ib[data-a=closeSheet]');
    await page.click('[data-a=startWorkout]'); H.check('floating Start button is gone once the session is live', await page.locator('.fab').count() === 0 && !(await page.evaluate(() => document.body.classList.contains('hasfab'))));
    await page.click('[data-a=endWorkout]'); await page.click('[data-a=discardWorkout]').catch(() => { }); await page.waitForTimeout(200);
    // --- recovery
    await page.evaluate(() => { state.muscles.Chest.recovery = 93; state.muscles.Back.recovery = 62; state.muscles.Quads.recovery = 38; scheduleSave(); });
    await page.click('#nav-recovery');
    H.check('readiness ring draws an arc', await page.locator('#rring .rv').count() === 1 && /^\d+%$/.test(await page.locator('#rring-n').innerText()));
    H.check('callout banner uses a left accent bar', await page.evaluate(() => getComputedStyle(document.querySelector('#tab-recovery .banner'), '::before').width === '3px'));
    H.check('front and back figures each have clickable muscle paths', await page.locator('.face.fr .mus').count() >= 5 && await page.locator('.face.bk .mus').count() >= 5);
    H.check('freshness colours map: Chest 93 green, Back 62 amber, Quads 38 red', await page.evaluate(() => { const c = m => document.querySelector(`.face.fr .mus[data-m=${m}]`).classList; return c('Chest').contains('gr') && c('Quads').contains('rd') && document.querySelector('.face.bk .mus[data-m=Back]').classList.contains('am'); }));
    H.check('3D flip container uses perspective + preserve-3d + hidden backfaces', await page.evaluate(() => getComputedStyle(document.querySelector('#flip')).perspective === '1000px' && getComputedStyle(document.querySelector('#flipin')).transformStyle === 'preserve-3d' && getComputedStyle(document.querySelector('.face')).backfaceVisibility === 'hidden'));
    await page.click('.dot[data-v=back]'); await page.waitForTimeout(800);
    H.check('tapping the dot flips to the back view', await page.evaluate(() => document.querySelector('#flipin').classList.contains('back')) && (await page.locator('#recSideLbl').innerText()).includes('Back'));
    const box = await page.locator('#flip').boundingBox();
    await page.mouse.move(box.x + box.width * .2, box.y + 120); await page.mouse.down(); await page.mouse.move(box.x + box.width * .8, box.y + 122, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(700);
    H.check('swiping left→right (>40px) turns it back to front', await page.evaluate(() => !document.querySelector('#flipin').classList.contains('back')));
    await page.mouse.move(box.x + box.width * .8, box.y + 120); await page.mouse.down(); await page.mouse.move(box.x + box.width * .2, box.y + 122, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(700);
    H.check('swiping the other way flips to the back view', await page.evaluate(() => document.querySelector('#flipin').classList.contains('back')));
    await page.mouse.move(box.x + 60, box.y + 120); await page.mouse.down(); await page.mouse.move(box.x + 75, box.y + 126, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(500);
    H.check('a short drag (<40px) does not flip', await page.evaluate(() => document.querySelector('#flipin').classList.contains('back')));
    await page.click('.dot[data-v=front]'); await page.waitForTimeout(800);
    H.check('one slider per muscle, no duplicate "Manual override" tracks', await page.locator('#tab-recovery input[type=range]').count() === 10 && !(await page.locator('#tab-recovery').innerText()).includes('Manual override'));
    H.check('slider is a single 10px capsule with a 16px thumb', await page.evaluate(() => { const rules = [...document.styleSheets].flatMap(sh => [...sh.cssRules]); const r = sel => rules.find(x => x.selectorText === sel); const tr = r('.rs::-webkit-slider-runnable-track'), th = r('.rs::-webkit-slider-thumb'); return !!tr && !!th && tr.style.height === '10px' && th.style.width === '16px' && th.style.height === '16px'; }));
    H.check('rows sit in one inset container with Fresh/Recovering/Fatigued badges', (await page.locator('.rlist .rrow').count()) === 10 && (await page.locator('.rlist [data-badge]').allInnerTexts()).join().includes('Fatigued') && (await page.locator('.rlist [data-badge]').allInnerTexts()).join().includes('Recovering'));
    // slider -> SVG live sync
    await page.evaluate(() => { const s = document.querySelector('input.rs[data-m=Chest]'); s.value = 20; s.dispatchEvent(new Event('input', { bubbles: true })); });
    H.check('dragging a slider recolours the figure live and updates badge + ring', await page.evaluate(() => document.querySelector('.face.fr .mus[data-m=Chest]').classList.contains('rd') && document.querySelector('.rrow[data-row=Chest] [data-badge]').textContent === 'Fatigued' && document.querySelector('.rrow[data-row=Chest] [data-pct]').textContent === '20%' && state.muscles.Chest.recovery === 20));
    // svg -> slider
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.face.fr .mus[data-m=Quads] path').first().click({ force: true }); await page.waitForTimeout(700);
    H.check('tapping a muscle scrolls to its slider and flashes the row', await page.evaluate(() => { const r = document.querySelector('.rrow[data-row=Quads]'); const b = r.getBoundingClientRect(); return r.classList.contains('flash') && b.top > 0 && b.bottom < innerHeight && window.scrollY > 100; }));
    // --- progress
    await page.evaluate(() => {
      const mk = (d, n) => ({ id: uid(), t: Date.now() - d * 864e5, name: n, split: 'push', sets: 16, vol: 14100, dur: 45, unit: 'lb', prs: 0, items: [{ exId: 'bb_bench', name: 'B', p: 'Chest', s: [], sets: Array.from({ length: 4 }, () => ({ w: 185, r: 8, rir: 2, type: 'work' })) }], cardio: [] });
      state.history = [mk(1, 'Legs Session'), mk(3, 'Push Session')]; state.e1rmHist.bb_bench = [225, 230, 236, 241].map((v, i) => ({ t: Date.now() - (20 - i * 5) * 864e5, v })); scheduleSave();
    });
    await page.click('#nav-progress');
    H.check('4 stat tiles: Sessions, Volume, PRs, Streak', (await page.locator('.tiles.t4 .tile span').allInnerTexts()).join('|') === 'Sessions|Volume|PRs|Streak');
    H.check('strength curve is a smooth path with gradient fill and glowing last point', await page.evaluate(() => { const c = document.querySelector('.chart'); return /C/.test(c.querySelector('.ln').getAttribute('d')) && !!c.querySelector('linearGradient') && !!c.querySelector('circle.pt.last') && c.querySelectorAll('text.xl').length >= 3; }));
    H.check('heatmap has a segmented Volume/Intensity pill and 14 columns', await page.locator('.segp button').count() === 2 && await page.locator('.hrow:first-child .hcells i').count() === 14);
    H.check('volume benchmark: name+sets, capsule with target band, status tag + 4-bar sparkline', await page.evaluate(() => { const r = document.querySelector('.vrow'); return r.querySelector('.vname span').textContent.includes('sets') && !!r.querySelector('.vbar .zone') && !!r.querySelector('.vstat .tag') && r.querySelectorAll('.spark i').length === 4 && ['Low', 'Optimal', 'Over'].includes(r.querySelector('.vstat .tag').textContent); }));
    H.check('recent sessions are tiles with a date block, pills and a ··· menu (no X)', await page.evaluate(() => { const t = document.querySelector('.stile'); return /^[A-Z]{3}\s*\d{2}$/.test(t.querySelector('.dtile').innerText.replace(/\n/g, ' ').trim()) && t.querySelectorAll('.spills span').length === 2 && !!t.querySelector('[data-a=histMenu]') && !t.querySelector('[data-a=histDel]'); }));
    await page.click('.stile [data-a=histMenu]'); await page.click('#sheet [data-a=histDel]'); await page.waitForTimeout(250);
    H.check('menu → delete removes the session and closes the sheet', await page.evaluate(() => state.history.length === 1) && await page.locator('#sheet').isHidden());
    // --- body
    await page.evaluate(() => { state.measures = [{ id: uid(), t: Date.now() - 20 * 864e5, unit: 'lb', weight: 197.5, waist: 33 }, { id: uid(), t: Date.now() - 2 * 864e5, unit: 'lb', weight: 196, waist: 32.5 }]; scheduleSave(); });
    await page.click('#nav-body');
    H.check('log grid is 3 columns with unified inset fields', await page.evaluate(() => { const g = getComputedStyle(document.querySelector('.grid3')).gridTemplateColumns.split(' ').length, i = getComputedStyle(document.querySelector('.field input')); return g === 3 && i.borderRadius === '10px' && i.backgroundColor === 'rgba(255, 255, 255, 0.04)'; }));
    H.check('history is a timeline with date pills and delta tags (−1.5 lb, −0.5 in)', await page.locator('.tline .dpill').count() === 2 && (await page.locator('.tline').innerText()).includes('−1.5 lb') && (await page.locator('.tline').innerText()).includes('−0.5 in'));
    H.check('empty photo state + ghost "Add photo" pill', await page.locator('.photoempty').count() === 1 && await page.locator('.gpill.add').count() === 1);
    // --- settings
    await page.click('#nav-more');
    H.check('profile banner: 48px avatar monogram, goal chips, vitals', await page.evaluate(() => { const a = document.querySelector('.avatar'); return Math.round(a.getBoundingClientRect().width) === 48 && a.textContent.length >= 1 && document.querySelectorAll('.pchips span').length >= 2 && document.querySelector('.vit').textContent.includes('yrs'); }));
    H.check('three inset grouped cards with 4 + 3 + 3 rows', await page.evaluate(() => [...document.querySelectorAll('.icard')].map(c => c.querySelectorAll('.irow').length).join() === '4,3,3' && [...document.querySelectorAll('.icard')].every(c => getComputedStyle(c).overflow === 'hidden' && getComputedStyle(c).borderRadius === '16px')));
    H.check('footer signature', (await page.locator('.foot').innerText()).includes('Private-First · Zero Tracking'));
    await page.click('[data-a=moreGrp][data-k=display]'); H.check('rows still expand in place', await page.locator('.irow.open:has([data-k=display]) .grpb').count() === 1);
    // --- no sideways scroll at 360
    await page.setViewportSize({ width: 360, height: 780 });
    for (const t of ['workout', 'recovery', 'progress', 'body', 'more']) { await page.click('#nav-' + t); const r = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); H.check(t + ' has no horizontal scroll at 360px', r[0] <= r[1], r); }
    H.check('no page errors', page.errs.length === 0, page.errs);
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
