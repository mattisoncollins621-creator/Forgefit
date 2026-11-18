const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8798); const b = await chromium.launch(); const U = 'http://127.0.0.1:8798/index.html';
  try {
    console.log('== O1 recovery speed per muscle');
    let { page } = await H.newPage(b, { noExpand: true, focus: true });
    await page.goto(U); await H.skipOnboarding(page);
    const ev = f => page.evaluate(f);
    const r24 = await ev(() => { state.profile.age = 30; MUSCLES.forEach(m => { state.muscles[m].recovery = 40; state.muscles[m].pace = 1; }); state.lastTick = Date.now() - 24 * 36e5; updatePassiveRecovery(); return Object.fromEntries(MUSCLES.map(m => [m, Math.round(state.muscles[m].recovery)])); });
    H.check('after 24h big muscles recover slower than small ones (quads < chest < biceps < core)', r24.Quads < r24.Chest && r24.Chest < r24.Biceps && r24.Biceps < r24.Core, r24);
    H.check('average speed stays about the old 1.25%/h', await ev(() => Math.abs(MUSCLES.reduce((a, m) => a + REC_BASE[m], 0) / MUSCLES.length - 1.25) < .02));
    H.check('over-40s and over-55s recover a bit slower', await ev(() => { const r = []; [30, 45, 60].forEach(a => { state.profile.age = a; r.push(recRate('Chest')); }); state.profile.age = 30; return r[0] > r[1] && r[1] > r[2]; }));
    // learning
    await ev(() => { MUSCLES.forEach(m => { state.muscles[m].recovery = 70; state.muscles[m].pace = 1; state.muscles[m].lastTrained = Date.now() - 864e5; }); state.muscles.Calves.lastTrained = Date.now() - 20 * 864e5; scheduleSave(); });
    await page.click('#nav-recovery');
    H.check('each row shows time to full recovery', /full in ~\d+h/.test(await page.locator('.rrow[data-row=Quads] [data-sub]').innerText()));
    const drag = async (m, v) => page.evaluate(([m, v]) => { const s = document.querySelector(`input.rs[data-m=${m}]`); s.value = v - 5; s.dispatchEvent(new Event('input', { bubbles: true })); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, [m, v]);
    await drag('Quads', 40);
    H.check('dragging quads well below the estimate (after training) slows their pace', await ev(() => state.muscles.Quads.pace < 1 && state.muscles.Quads.pace >= .85) && /recover a bit slower/.test(await page.locator('#toast').innerText()));
    H.check('the row says "slower for you"', /slower for you/.test(await page.locator('.rrow[data-row=Quads] [data-sub]').innerText()));
    await drag('Biceps', 95);
    H.check('dragging above the estimate speeds the pace up', await ev(() => state.muscles.Biceps.pace > 1));
    await drag('Chest', 74);
    H.check('tiny corrections are ignored', await ev(() => state.muscles.Chest.pace === 1));
    await drag('Calves', 20);
    H.check('no learning when the muscle was not trained recently', await ev(() => state.muscles.Calves.pace === 1));
    H.check('pace is limited to 0.6–1.5', await ev(() => { let ok = true; for (let k = 0; k < 20; k++) learnPace('Back', 80, 0); ok = state.muscles.Back.pace >= .6; for (let k = 0; k < 30; k++) learnPace('Back', 0, 100); return ok && state.muscles.Back.pace <= 1.5; }));
    H.check('pace survives a save/reload (normalize)', await ev(() => normalize(JSON.parse(JSON.stringify(state))).muscles.Quads.pace === state.muscles.Quads.pace));
    H.check('+24h simulate uses each muscle\'s speed', await ev(() => { MUSCLES.forEach(m => state.muscles[m].recovery = 0); A.simTime(); return state.muscles.Quads.recovery < state.muscles.Core.recovery; }));

    console.log('== O2 main lifts stay for the block');
    await page.click('#nav-workout');
    const an = await ev(() => {
      MUSCLES.forEach(m => { state.muscles[m].recovery = 100; state.muscles[m].pace = 1; }); state.anchors = {}; state.split = 'push';
      const runs = []; for (let k = 0; k < 8; k++) { MUSCLES.forEach(m => state.muscles[m].recovery = 60 + Math.random() * 40); generateWorkout(true); runs.push(wk().items.filter(i => !i.cardio).map(i => ({ id: i.exId, main: !!i.main }))); }
      const mains = runs.map(r => r.filter(x => x.main).map(x => x.id).join()), acc = new Set(runs.flatMap(r => r.filter(x => !x.main).map(x => x.id)));
      return { mains, acc: acc.size, first: runs[0], prim: runs[0].filter(x => x.main).map(x => exById(x.id).primary + ':' + exById(x.id).type) };
    });
    H.check('8 regenerated push days keep the same 2 main lifts', new Set(an.mains).size === 1 && an.mains[0].split(',').length === 2, an.mains);
    H.check('main lifts are a chest and a shoulder compound, listed first', an.prim.join() === 'Chest:compound,Shoulders:compound' && an.first[0].main && an.first[1].main, an);
    H.check('accessories still rotate', an.acc >= 4, an.acc);
    const legs = await ev(() => { state.split = 'legs'; generateWorkout(true); return wk().items.filter(i => i.main).map(i => exById(i.exId).primary); });
    H.check('legs main lifts: a quad lift and a hamstring/glute lift', legs.length === 2 && legs[0] === 'Quads' && ['Hamstrings', 'Glutes'].includes(legs[1]), legs);
    const pl = await ev(() => { state.split = 'pull'; generateWorkout(true); return wk().items.filter(i => i.main).map(i => exById(i.exId)).map(e => e.primary); });
    H.check('pull main lifts are two back movements', pl.join() === 'Back,Back', pl);
    H.check('the note names the main lifts', /Main lifts for this/.test(await ev(() => wk().note)));
    // swap sticks
    const sw = await ev(() => { state.split = 'push'; generateWorkout(true); const i = wk().items.findIndex(x => x.main), old = wk().items[i].exId; const alt = allEx().find(e => e.primary === exById(old).primary && e.type === 'compound' && e.id !== old && hasGear(e) && fitsDay(e, 'push') && !wk().items.some(x => x.exId === e.id)); swapTo(i, alt.id); generateWorkout(true); return { alt: alt.id, now: wk().items.filter(x => x.main).map(x => x.exId) }; });
    H.check('swapping a main lift makes the swap stick on the next regenerate', sw.now.includes(sw.alt), sw);
    await page.evaluate(() => renderWorkout());
    H.check('plan rows show a "Main lift" tag', await page.locator('#exlist .tag.or', { hasText: 'Main lift' }).count() === 2);
    const nm = await ev(() => { const before = wk().items.filter(x => x.main).map(x => x.exId).join(); let changed = false; for (let k = 0; k < 6 && !changed; k++) { A.newMain(); changed = wk().items.filter(x => x.main).map(x => x.exId).join() !== before; } return changed; });
    H.check('"Pick new main lifts" chooses different ones', nm);
    const blk = await ev(() => { const before = state.anchors.push.key; state.block = { start: Date.now(), weeks: 6 }; generateWorkout(true); return state.anchors.push.key !== before && state.anchors.push.key === 'b' + state.block.start; });
    H.check('starting a new training block refreshes the main-lift slot', blk);
    await ev(() => { state.block = null; });

    console.log('== O3 focus mode');
    await ev(() => { state.split = 'push'; MUSCLES.forEach(m => state.muscles[m].recovery = 100); generateWorkout(); });
    await page.click('[data-a=startWorkout]'); await page.waitForTimeout(200);
    H.check('a live workout opens in Focus view with one exercise', await page.locator('#focus').count() === 1 && await page.locator('#exlist').count() === 0 && /Exercise 1 of/.test(await page.locator('#focus').innerText()));
    const w0 = await ev(() => +wk().items[0].sets[0].weight);
    await page.click('#focus [data-a=fStep][data-k=weight][data-d="1"]'); await page.click('#focus [data-a=fStep][data-k=weight][data-d="1"]');
    await page.click('#focus [data-a=fStep][data-k=reps][data-d="-1"]');
    const st = await ev(() => wk().items[0].sets.map(s => [s.weight, s.reps]));
    H.check('+/− change weight by the plate step and reps by 1', st[0][0] === w0 + 10 && st[0][1] === st[2][1], st);
    H.check('later sets follow the change', st.every(x => x[0] === w0 + 10));
    await page.click('#focus [data-a=fRir][data-v="1"]');
    H.check('effort buttons set RIR', await ev(() => wk().items[0].sets[0].rir === 1));
    await page.click('#focus [data-a=toggleSet]'); await page.waitForTimeout(250); await ev(() => { const p = document.querySelector('#pr [data-a=prNext]'); if (p) p.click(); });
    H.check('logging a set moves to the next set and starts the rest timer', await ev(() => wk().items[0].sets[0].done) && /Set 2 of/.test(await page.locator('#focus .fwhat').innerText()) && await page.locator('#tbar').isVisible());
    await ev(() => { for (let j = 1; j < wk().items[0].sets.length; j++) { const b = document.querySelector('#focus [data-a=toggleSet]'); b.click(); const p = document.querySelector('#pr [data-a=prNext]'); if (p) p.click(); } });
    await page.waitForTimeout(1000);
    H.check('after the last set it moves on to the next exercise by itself', await ev(() => focusIdx === 1) && /Exercise 2 of/.test(await page.locator('#focus').innerText()) && /Next up/.test(await page.locator('#toast').innerText()));
    await page.click('#focus .fnav [aria-label="Previous exercise"]');
    H.check('arrows go back to a finished exercise, set chips show it as logged', /Exercise 1 of/.test(await page.locator('#focus').innerText()) && await page.locator('#focus .fs.done').count() === await ev(() => wk().items[0].sets.length));
    await page.click('#focus .fs[data-j="1"]'); await page.click('#focus [data-a=toggleSet]');
    H.check('tapping a logged set lets you undo it', await ev(() => !wk().items[0].sets[1].done));
    const box = await page.locator('#focus .fname').boundingBox();
    await page.mouse.move(box.x + 250, box.y + 10); await page.mouse.down(); await page.mouse.move(box.x + 40, box.y + 14, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
    H.check('swiping left goes to the next exercise', await ev(() => focusIdx === 1));
    // supersets alternate
    await ev(() => { const it = wk().items; it[1].superset = 'A1'; it[2].superset = 'A2'; focusIdx = 1; focusSet = null; renderWorkout(); });
    await page.click('#focus [data-a=toggleSet]'); await page.waitForTimeout(300); await ev(() => { const p = document.querySelector('#pr [data-a=prNext]'); if (p) p.click(); });
    H.check('in a superset, logging A1 jumps straight to A2', await ev(() => focusIdx === 2));
    await page.click('#focus [data-a=toggleSet]'); await page.waitForTimeout(300); await ev(() => { const p = document.querySelector('#pr [data-a=prNext]'); if (p) p.click(); });
    H.check('…and back to A1', await ev(() => focusIdx === 1));
    // remove a set right in Focus
    await ev(() => { focusIdx = 3; focusSet = null; renderWorkout(); });
    const n0 = await ev(() => wk().items[3].sets.length);
    await page.click('#focus .fs[data-j="1"]'); await page.click('#focus [data-a=fDelSet]');
    H.check('Remove set deletes the selected set in Focus', await ev(() => wk().items[3].sets.length) === n0 - 1 && /Set deleted/.test(await page.locator('#toast').innerText()));
    await page.click('#toast button');
    H.check('…and Undo puts it back', await ev(() => wk().items[3].sets.length) === n0);
    const rc = await ev(() => { const it = wk().items[3], ex = exById(it.exId), before = state.muscles[ex.primary].recovery; focusIdx = 3; focusSet = 0; renderWorkout(); document.querySelector('#focus [data-a=toggleSet]').click(); const p = document.querySelector('#pr [data-a=prNext]'); if (p) p.click(); const mid = state.muscles[ex.primary].recovery; focusIdx = 3; focusSet = 0; renderWorkout(); document.querySelector('#focus [data-a=fDelSet]').click(); return { before, mid, after: state.muscles[ex.primary].recovery }; });
    H.check('removing a logged set gives its fatigue back', rc.mid < rc.before && Math.abs(rc.after - rc.before) < .01, rc);
    await ev(() => { const it = wk().items[3]; it.sets.splice(1); focusIdx = 3; focusSet = null; renderWorkout(); });
    H.check('the last remaining set cannot be removed', await page.locator('#focus [data-a=fDelSet]').isDisabled());
    // list toggle
    await page.click('[data-a=viewMode][data-v=list]');
    H.check('List view shows all cards and remembers the choice', await page.locator('#exlist').count() === 1 && await ev(() => state.settings.focus === false));
    H.check('list view highlights the next set to log', await page.locator('#exlist .srow.cur').count() === 1);
    await page.click('[data-a=viewMode][data-v=focus]');
    // finish everything → banner
    await ev(() => { wk().items.forEach(it => { if (it.cardio) it.done = true; else it.sets.forEach(s => { if (!s.done) { s.reps = s.reps || 8; applySetDone(it, s, exById(it.exId)); } }); }); renderWorkout(); });
    H.check('when everything is logged, Focus shows a Finish prompt', await page.locator('#focus .fdone [data-a=endWorkout]').count() === 1);
    await page.setViewportSize({ width: 360, height: 780 });
    H.check('no horizontal scroll in Focus at 360px', await ev(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    H.check('no page errors', page.errs.length === 0, page.errs);
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
