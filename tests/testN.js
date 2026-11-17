const H = require('./h'); const { chromium } = require('playwright');
(async () => {
  H.sync(); const srv = await H.serve(8796); const b = await chromium.launch(); const U = 'http://127.0.0.1:8796/index.html';
  try {
    console.log('== N muscle involvement + coherent workouts');
    const { page } = await H.newPage(b, { noExpand: true });
    await page.goto(U); await H.skipOnboarding(page);
    await page.evaluate(() => { state.seen.v8 = true; Object.keys(state.gear).forEach(k => state.gear[k] = true); });
    const ev = f => page.evaluate(f);
    // --- data corrections
    H.check('upright rows are a Back (traps) exercise with some Shoulders, tagged for Pull', await ev(() => { const e = exById('bb_upright_row'), c = exById('cable_upright_row'); return e.primary === 'Back' && c.primary === 'Back' && exW(e).Shoulders > 0 && exW(e).Shoulders < .6 && e.split.includes('pull') && !e.split.includes('push'); }));
    H.check('shrugs are Back, squat is Quads-led with glutes/hamstrings, leg curl works glutes a little', await ev(() => exById('bb_shrug').primary === 'Back' && exById('bb_squat').primary === 'Quads' && exW(exById('bb_squat')).Glutes >= .5 && exW(exById('bb_squat')).Hamstrings > 0 && exW(exById('leg_curl')).Glutes > 0 && exW(exById('leg_curl')).Glutes < .5));
    H.check('every exercise has a sane muscle map (primary = 1, others 0–1, known muscles)', await ev(() => allEx().filter(e => !e.cardio).every(e => { const w = exW(e); return w[e.primary] === 1 && Object.keys(w).every(m => MUSCLES.includes(m) && w[m] > 0 && w[m] <= 1); })));
    // --- recovery uses the shares
    const fx = await ev(() => { MUSCLES.forEach(m => state.muscles[m].recovery = 100); const ex = exById('bb_squat'), it = buildItem(ex, {}), s = it.sets[0]; applySetDone(it, s, ex); const o = { ...s.fx }; o.after = rec('Quads'); undoSet(it, s, ex); o.undo = MUSCLES.every(m => state.muscles[m].recovery === 100); return o; });
    H.check('one squat set: quads take the most, glutes ~60%, hamstrings ~30%, core and calves a little', fx.Quads === 6 && fx.Glutes === 4 && fx.Hamstrings === 2 && fx.Core >= 1 && fx.Calves >= 1 && !fx.Chest, fx);
    H.check('undoing the set restores every muscle', fx.undo);
    const ur = await ev(() => { MUSCLES.forEach(m => state.muscles[m].recovery = 100); const ex = exById('bb_upright_row'), it = buildItem(ex, {}), s = it.sets[0]; applySetDone(it, s, ex); return s.fx; });
    H.check('upright row set: Back takes the main hit, Shoulders a smaller one', ur.Back > ur.Shoulders && ur.Shoulders >= 1, ur);
    const lc = await ev(() => { MUSCLES.forEach(m => state.muscles[m].recovery = 100); const ex = exById('leg_curl'), it = buildItem(ex, {}), s = it.sets[0]; applySetDone(it, s, ex); return { fx: s.fx, g: rec('Glutes') }; });
    H.check('hamstring curl set also tires the glutes', lc.fx.Hamstrings > lc.fx.Glutes && lc.g < 100, lc);
    // --- weekly sets / heat use the shares; old history still counts half
    const ws = await ev(() => {
      state.history = [{ id: 'a', t: Date.now() - 864e5, name: 'x', split: 'legs', sets: 3, vol: 1, dur: 30, unit: 'lb', items: [{ exId: 'bb_squat', name: 'S', p: 'Quads', s: ['Glutes', 'Hamstrings'], mw: { Quads: 1, Glutes: .6, Hamstrings: .3 }, sets: [{ w: 100, r: 5, type: 'work' }, { w: 100, r: 5, type: 'work' }] }, { exId: 'old', name: 'O', p: 'Back', s: ['Biceps'], sets: [{ w: 1, r: 1, type: 'work' }] }], cardio: [] }];
      const w = weeklySets(4); return { q: w.Quads[3], g: w.Glutes[3], h: w.Hamstrings[3], bk: w.Back[3], bi: w.Biceps[3] };
    });
    H.check('weekly sets: new sessions count shares (2 squat sets → glutes 1.2), old ones fall back to ½', Math.abs(ws.q - 2) < .01 && Math.abs(ws.g - 1.2) < .01 && Math.abs(ws.h - .6) < .01 && ws.bk === 1 && ws.bi === .5, ws);
    // --- finish saves shares
    await ev(() => { state.history = []; MUSCLES.forEach(m => state.muscles[m].recovery = 100); state.split = 'push'; generateWorkout(true); const w = wk(); w.items.forEach(it => it.sets && it.sets.forEach(s => { s.reps = s.reps || 8; s.weight = s.weight || 50; })); });
    // --- workouts stay on their day
    const bad = await ev(() => {
      const out = [], seen = {};
      for (let n = 0; n < 40; n++) {
        MUSCLES.forEach(m => state.muscles[m].recovery = 30 + Math.random() * 70);
        for (const sp of ['push', 'pull', 'legs', 'upper', 'lower']) {
          state.split = sp; generateWorkout(true);
          (seen[sp] = seen[sp] || new Set()); wk().items.forEach(it => { const ex = exById(it.exId); if (ex.cardio) return; seen[sp].add(ex.id);
            if (!fitsDay(ex, sp)) out.push([sp, ex.id, ex.primary]);
            const w = exW(ex); if (sp === 'pull' && (['Hamstrings', 'Glutes', 'Quads', 'Chest', 'Triceps', 'Calves'].some(m => w[m] >= .5))) out.push(['pull-lean', ex.id]);
            if (sp === 'push' && (['Hamstrings', 'Glutes', 'Quads', 'Back', 'Biceps', 'Calves'].some(m => w[m] >= .5))) out.push(['push-lean', ex.id]);
            if (sp === 'legs' && (['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'].some(m => w[m] >= .5))) out.push(['legs-lean', ex.id]); });
        }
      }
      return { out: out.slice(0, 8), n: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.size])) };
    });
    H.check('40 random push/pull/legs/upper/lower workouts: nothing from the wrong day', bad.out.length === 0, bad);
    H.check('each day still has plenty of variety (not starved by the new rules)', bad.n.push >= 15 && bad.n.pull >= 12 && bad.n.legs >= 15, bad.n);
    // --- smart
    const sm = await ev(() => {
      const res = []; state.split = 'auto'; state.profile.splitPref = 'freshness';
      const check = (setup, label) => { MUSCLES.forEach(m => { state.muscles[m].recovery = 100; state.muscles[m].lastTrained = 0; }); setup(); state.lastTick = Date.now(); generateWorkout(true);
        const w = wk(), prim = w.items.filter(i => !i.cardio).map(i => exById(i.exId).primary), day = w.split;
        const ok = prim.every(p => DAY_ALLOW[day].includes(p));
        res.push({ label, day, name: w.name, ok, prim: prim.join(), note: w.note }); };
      check(() => { ['Chest', 'Shoulders', 'Triceps', 'Back', 'Biceps'].forEach(m => state.muscles[m].recovery = 25); }, 'upper tired');
      check(() => { ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Back', 'Biceps'].forEach(m => state.muscles[m].recovery = 25); }, 'legs+pull tired');
      check(() => { ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Chest', 'Shoulders', 'Triceps'].forEach(m => state.muscles[m].recovery = 25); }, 'legs+push tired');
      for (let i = 0; i < 25; i++) check(() => MUSCLES.forEach(m => state.muscles[m].recovery = 20 + Math.random() * 80), 'random');
      return res;
    });
    H.check('Smart: a tired upper body gives a legs day', sm[0].day === 'legs' && sm[0].name === 'Legs Session', sm[0]);
    H.check('Smart: tired legs + back gives a push day', sm[1].day === 'push', sm[1]);
    H.check('Smart: tired legs + push gives a pull day', sm[2].day === 'pull', sm[2]);
    H.check('Smart: every generated day is one coherent group (25 random states)', sm.every(r => r.ok), sm.filter(r => !r.ok).slice(0, 3));
    H.check('Smart: the note explains the pick', /Smart pick: Legs day/.test(sm[0].note), sm[0].note);
  } catch (e) { throw e; } finally { await b.close(); srv.kill(); H.summary(); }
})().catch(e => { console.error('TEST CRASH', e.stack.split('\n').slice(0, 6).join(' | ')); process.exit(1); });
