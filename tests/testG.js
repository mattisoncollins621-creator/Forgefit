const H = require('./h'); const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  H.sync(); execSync('cp /tmp/t/index_v_delivered.html /tmp/t/www/delivered.html'); const srv = await H.serve(8771); const b = await chromium.launch(); const URL = 'http://127.0.0.1:8771/';
  const NEW = require('fs').readFileSync('/tmp/claude-0/-home-claude/8511f1a4-314a-557a-bb2d-890526ff1006/scratchpad/newex.py', 'utf8').match(/^\("([a-z0-9_]+)"/gm).map(s => s.slice(2, -1));
  try {
    console.log('== G1 data integrity (' + NEW.length + ' new exercises)');
    let { ctx, page } = await H.newPage(b);
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    const d = await page.evaluate(ids => {
      const bad = [], all = allEx(); const seen = new Set(); let dup = [];
      all.forEach(e => { if (seen.has(e.id)) dup.push(e.id); seen.add(e.id); });
      ids.forEach(id => {
        const e = exById(id); if (!e) { bad.push(id + ':missing'); return; }
        if (!MUSCLES.includes(e.primary)) bad.push(id + ':primary');
        if ((e.secondary || []).some(m => !MUSCLES.includes(m) || m === e.primary)) bad.push(id + ':secondary');
        if (!e.gear.every(g => g in state.gear)) bad.push(id + ':gearkey ' + e.gear);
        if (!HOW[id] || HOW[id].length !== 3 || HOW[id].some(t => !t || t.length < 20)) bad.push(id + ':how');
        if (!e.cue || !e.name) bad.push(id + ':text');
        if (!e.split.length || e.split.some(s => !['push', 'pull', 'legs', 'upper', 'lower', 'full'].includes(s))) bad.push(id + ':split');
        if (!e.noE1 && !(state.e1rm[id] > 0)) bad.push(id + ':noe1rm');
      });
      const basePlus = all.filter(e => !e.cardio).length;
      return { bad, dup, total: basePlus, nameDup: all.map(e => e.name).filter((n, i, a) => a.indexOf(n) !== i) };
    }, NEW);
    H.check('all 64 new ids exist, valid muscles/gear/split, 3-step how-to, seeded e1RM', NEW.length === 64 && d.bad.length === 0, d.bad);
    H.check('no duplicate ids or names across the whole library', d.dup.length === 0 && d.nameDup.length === 0, d);
    console.log('   library strength exercises:', d.total);

    console.log('== G2 every exercise builds, logs and undoes cleanly');
    const g2 = await page.evaluate(ids => {
      const errs = [];
      Object.keys(state.gear).forEach(k => state.gear[k] = true);
      ids.forEach(id => {
        try {
          const ex = exById(id), it = buildItem(ex, { factor: 1 });
          if (!it.sets.length) errs.push(id + ':nosets');
          it.sets.forEach(s => { if (!Number.isFinite(+s.weight) || +s.weight < 0 || !(+s.reps > 0)) errs.push(id + ':badset ' + JSON.stringify(s)); });
          if (!ex.noE1 && !ex.bw && !(+it.sets[0].weight > 0)) errs.push(id + ':zeroweight');
          const s = it.sets[0]; s.done = false;
          const pr = applySetDone(it, s, ex); undoSet(it, s, ex);
          const card = (() => { state.workout.items = [it]; renderWorkout(); return document.querySelector('#exlist').innerText; })();
          if (!card.includes(ex.name.slice(0, 12))) errs.push(id + ':notrendered');
        } catch (e) { errs.push(id + ':throw ' + e.message); }
      });
      state.workout.items = []; renderWorkout();
      return errs;
    }, NEW);
    H.check('buildItem / log a set / undo / render card for all 64', g2.length === 0, g2);
    const rep = await page.evaluate(() => ['plank', 'side_plank', 'farmers_walk', 'bench_dips', 'inverted_row', 'rack_pull', 'hack_squat', 'tbar_row'].map(id => { const it = buildItem(exById(id)); return id + ' ' + it.sets.length + 'x' + it.sets[0].reps + '@' + it.sets[0].weight; }));
    console.log('   sample defaults:', rep.join(' | '));

    console.log('== G3 library, add-exercise picker and quick log show everything');
    await page.click('#nav-more'); await page.click('[data-a=libOpen]');
    let n = await page.locator('#lib-list .prow').count();
    const totalAll = await page.evaluate(() => allEx().length);
    H.check('exercise library "All" lists every exercise (no 90 cap)', n === totalAll, { n, totalAll });
    for (const m of ['Chest', 'Back', 'Shoulders', 'Triceps', 'Biceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core']) {
      await page.click(`#lib-f [data-v=${m}]`); const c = await page.locator('#lib-list .prow').count(); const exp = await page.evaluate(m => allEx().filter(e => e.primary === m).length, m);
      H.check(`library ${m}: ${exp} listed`, c === exp && c > 0, { c, exp });
    }
    await page.click('#lib-f [data-v=all]');
    const searches = [['plank', 'Plank Hold'], ["farmer's", "Farmer's Walk"], ['farmers carry', "Farmer's Walk"], ['wood chop', 'Woodchopper'], ['t bar', 'T-Bar'], ['nordic', 'Nordic'], ['tibialis', 'Tibialis'], ['captain', "Captain's Chair"], ['jm press', 'JM Press'], ['rope', 'Overhead Cable Triceps']];
    for (const [q, name] of searches) { await page.fill('#lib-q', q); const t = await page.locator('#lib-list').innerText(); H.check(`search "${q}" finds ${name}`, t.includes(name), t.slice(0, 120)); }
    await page.fill('#lib-q', 'plank'); await page.locator('#lib-list .prow').first().click();
    const info = await page.locator('#sheet').innerText();
    H.check('info sheet shows set up / move / watch for + seconds hint', /set up/i.test(info) && /move/i.test(info) && /watch for/i.test(info) && /seconds/i.test(info), info.slice(0, 200));
    await page.click('#sheet .ib[data-a=closeSheet]');
    // add-exercise picker
    await page.click('#nav-workout'); await page.click('[data-a=addEx]'); await page.check('[data-f=pickall]');
    n = await page.locator('#pick-list .prow').count();
    H.check('Add exercise → All (with locked gear shown) lists everything', n === totalAll, { n, totalAll });
    await page.fill('#pick-q', 'sissy'); await page.locator('#pick-list .prow').first().click(); await page.waitForTimeout(200);
    H.check('adding a new exercise puts it in the workout', await page.evaluate(() => wk().items.some(i => i.exId === 'sissy_squat')));
    // quick log
    await page.evaluate(() => { document.querySelector('#nav-more').click(); });
    const ql = await page.evaluate(() => { const e = [...document.querySelectorAll('[data-a]')].map(x => x.dataset.a); return e.filter(a => /quick|ql/i.test(a)).slice(0, 5); });
    console.log('   quick log hooks:', ql.join(','));
    H.check('no JS errors in library/picker flows', page.errs.length === 0, page.errs);
    await ctx.close();

    console.log('== G4 workout generator with the bigger library');
    ({ ctx, page } = await H.newPage(b, { seed: false }));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    const g4 = await page.evaluate(ids => {
      const out = { errs: [], seen: new Set(), carry: 0, runs: 0, empty: 0, dupes: 0 };
      Object.keys(state.gear).forEach(k => state.gear[k] = true);
      ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'freshness'].forEach(sp => {
        state.profile.splitPref = sp;
        for (let i = 0; i < 40; i++) {
          try {
            generateWorkout(true); out.runs++;
            const its = state.workout.items; if (!its.filter(x => !x.cardio).length) out.empty++;
            const idsIn = its.map(x => x.exId); if (new Set(idsIn).size !== idsIn.length) out.dupes++;
            its.forEach(x => { if (ids.includes(x.exId)) out.seen.add(x.exId); if (x.exId === 'farmers_walk') out.carry++; x.sets.forEach(s => { if (!Number.isFinite(+s.weight) || !(+s.reps > 0)) out.errs.push(x.exId + ' bad set'); }); });
          } catch (e) { out.errs.push(sp + ':' + e.message); }
        }
      });
      out.seen = out.seen.size; return out;
    }, NEW);
    H.check('280 generated workouts across all splits: no errors, no empty, no duplicates', g4.errs.length === 0 && g4.empty === 0 && g4.dupes === 0, g4);
    H.check('farmer’s walk is never auto-generated (weight can’t be suggested)', g4.carry === 0, g4.carry);
    H.check('new exercises do get picked by the generator', g4.seen >= 25, g4.seen);
    console.log('   distinct new exercises the generator used:', g4.seen);
    // bodyweight-only gear
    const g5 = await page.evaluate(() => {
      applyGearPreset('Bodyweight Only'); const bad = [], used = new Set();
      for (const sp of ['push', 'pull', 'legs', 'full']) { state.profile.splitPref = sp; for (let i = 0; i < 25; i++) { generateWorkout(true); state.workout.items.forEach(x => { used.add(x.exId); const e = exById(x.exId); if (!e.gear.every(g => g === 'Bodyweight')) bad.push(x.exId); }); } }
      return { bad: [...new Set(bad)], used: [...used] };
    });
    H.check('bodyweight-only gear never gets barbell/cable/bench exercises', g5.bad.length === 0, g5.bad);
    console.log('   bodyweight-only pool used:', g5.used.join(', '));
    H.check('no JS errors while generating', page.errs.length === 0, page.errs);
    await ctx.close();

    console.log('== G5 upgrade from the build you are using now keeps everything');
    ({ ctx, page } = await H.newPage(b));
    await page.goto(URL + 'delivered.html'); await H.skipOnboarding(page);
    await page.evaluate(() => {
      const n = Date.now(); state.history = [{ id: 'h1', t: n - 2 * 864e5, name: 'Push', split: 'push', sets: 3, vol: 5000, dur: 50, unit: 'lb', prs: 1, items: [{ exId: 'bb_bench', name: 'Barbell Bench Press', p: 'Chest', s: [], sets: [{ w: 185, r: 8, rir: 2, type: 'work' }, { w: 185, r: 8, rir: 2, type: 'work' }, { w: 185, r: 7, rir: 1, type: 'work' }] }], cardio: [] }];
      state.e1rm.bb_bench = 233; state.prs.bb_bench = { e1rm: 233, weight: 185, reps: 8, t: n }; state.profile.name = 'Test'; state.templates = [{ id: 't1', name: 'My routine', t: n, items: [{ exId: 'bb_bench', sets: [{ w: 185, r: 8 }] }] }];
      flushSave();
    });
    await page.waitForTimeout(300);
    await page.goto(URL + 'index.html'); await page.waitForTimeout(600);
    const g6 = await page.evaluate(() => ({ hist: state.history.length, e1: state.e1rm.bb_bench, pr: !!state.prs.bb_bench, tpl: state.templates.length, seeded: state.e1rm.rack_pull > 0 && state.e1rm.hack_squat > 0, onboard: !document.querySelector('#onboard').hidden, plank: !!exById('plank') }));
    H.check('history, e1RM, PR and routine survive the update', g6.hist === 1 && g6.e1 === 233 && g6.pr && g6.tpl === 1, g6);
    H.check('new exercises get starting weights for the existing user, no onboarding re-run', g6.seeded && !g6.onboard && g6.plank, g6);
    H.check('no JS errors on upgrade', page.errs.length === 0, page.errs);
    await ctx.close();

    console.log('== G6 screenshots');
    ({ ctx, page } = await H.newPage(b, { opts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } }));
    await page.goto(URL + 'index.html'); await H.skipOnboarding(page);
    await page.evaluate(() => { Object.keys(state.gear).forEach(k => state.gear[k] = true); state.workout.items = ['plank', 'bench_dips', 'tbar_row', 'farmers_walk'].map(id => buildItem(exById(id))); state.workout.name = 'Test'; renderWorkout(); });
    await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/t/out/new-workout.png' });
    await page.click('[data-a=addEx]'); await page.click('#pick-f [data-v=Core]'); await page.waitForTimeout(200); await page.screenshot({ path: '/tmp/t/out/new-picker.png' }); await page.click('#sheet .ib[data-a=closeSheet]');
    await page.click('#nav-more'); await page.click('[data-a=libOpen]'); await page.fill('#lib-q', "farmer"); await page.locator('#lib-list .prow').first().click(); await page.waitForTimeout(200); await page.screenshot({ path: '/tmp/t/out/new-info.png' });
    H.check('no JS errors while taking screenshots', page.errs.length === 0, page.errs);
    await ctx.close();
  } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 8).join(' | ')); process.exit(1); });
