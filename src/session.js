'use strict';
/* ---------- v10: plan → start → pause → end, with a calorie estimate and achievements ---------- */
const planOpen = new Set();
const fmtClock = ms => { const t = Math.floor(Math.max(0, ms) / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'); };
const planCollapse = i => sessActive() ? '' : `<button class="ib" data-a="planExp" data-i="${i}" aria-label="Collapse exercise">${ic('up')}</button>`;

/* ----- plan screen ----- */
function setsSummary(it) {
  if (it.cardio) return `${+it.min || 0} min${+it.dist ? ' · ' + it.dist + ' ' + (unit() === 'kg' ? 'km' : 'mi') : ''}`;
  const ws = it.sets.filter(s => s.type !== 'warmup'), wm = it.sets.length - ws.length;
  if (!ws.length) return wm ? `${wm} warm-up` : 'No sets';
  const same = ws.every(s => +s.weight === +ws[0].weight && +s.reps === +ws[0].reps);
  const base = same ? `${ws.length} × ${ws[0].reps}${+ws[0].weight ? ' @ ' + ws[0].weight + ' ' + unit() : ''}` : ws.slice(0, 4).map(s => `${+s.weight || 'BW'}×${s.reps}`).join(' · ') + (ws.length > 4 ? ' …' : '');
  return base + (wm ? ` · +${wm} warm-up` : '');
}
function planStats() {
  let sets = 0, cm = 0; wk().items.forEach(it => { if (it.cardio) cm += +it.min || 0; else sets += it.sets.length; });
  return { min: Math.max(5, Math.round((sets * 2.5 + cm) / 5) * 5) };
}
function planSummary() {
  const its = wk().items; if (!its.length) return '<b class="or">—</b><div class="mut xs">Planned</div>';
  let sets = 0, cm = 0; its.forEach(it => { if (it.cardio) cm += +it.min || 0; else sets += it.sets.length; });
  const min = Math.max(5, Math.round((sets * 2.5 + cm) / 5) * 5);
  return `<b class="or">~${min} min</b><div class="mut xs">${its.length} exercise${its.length === 1 ? '' : 's'}</div>`;
}
function planRowHtml(i) {
  const it = wk().items[i], ex = exById(it.exId); if (!ex) return '';
  const ss = it.superset ? `<span class="tag vi">${it.superset}</span>` : '';
  const pct = it.cardio ? 0 : rec(ex.primary), bc = recCol(pct);
  const tag = it.cardio ? '<span class="tag">Cardio</span>' : `<span class="tag ${bc}">${esc(ex.primary)} ${pct}%</span>`;
  return `<article class="card ex plan" data-ex="${i}"><div class="row gap6 top">
    <button class="grip" data-drag aria-label="Drag to reorder" title="Hold and drag to reorder"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
    <button class="planmain grow" data-a="planExp" data-i="${i}" aria-label="Edit sets for ${esc(ex.name)}"><div class="row gap6 wrap">${tag}${it.cardio ? '' : stalledTag(ex)}${ss}</div><h3 class="exn">${esc(ex.name)}</h3><div class="mut xs">${esc(setsSummary(it))} · tap to edit sets</div>${!it.cardio && noteOf(ex.id) ? `<div class="planote">${ic('pencil', 'sm')} ${esc(noteOf(ex.id))}</div>` : ''}</button>
    <div class="row gap6">${it.cardio ? '' : `<button class="ib" data-a="swap" data-i="${i}" aria-label="Swap exercise">${ic('swap')}</button>`}<button class="ib" data-a="exMenu" data-i="${i}" aria-label="Exercise options">${ic('more')}</button></div></div></article>`;
}
A.planExp = el => {
  const i = +el.dataset.i, it = wk().items[i]; if (!it) return; const k = it.id || i;
  if (planOpen.has(k)) planOpen.delete(k); else planOpen.add(k);
  refreshCard(i);
};

/* ----- live session ----- */
function ensureStarted() {
  const w = wk();
  if (!w.startedAt) { w.startedAt = Date.now(); w.pausedAt = null; w.pausedMs = 0; LiveActivity.sync(); }
  else if (w.pausedAt) resumeCore();
}
function resumeCore() {
  const w = wk(); if (!w.pausedAt) return;
  w.pausedMs = (w.pausedMs || 0) + (Date.now() - w.pausedAt); w.pausedAt = null;
  if (w.pausedRest > 0) startTimer(w.pausedRest, w.pausedLabel || 'Rest');
  delete w.pausedRest; delete w.pausedLabel; LiveActivity.sync();
}
function sessHeader() {
  const w = wk(), paused = sessPaused();
  const hard = doneSetCount();
  return `<div class="card sess ${paused ? 'paused' : ''}">
    <div class="row sp top"><div class="grow"><span class="lbl ${paused ? '' : 'live'}">${paused ? ic('pause') + ' Paused' : '<i class="dot"></i> In progress'}</span><h2 class="h2">${esc(w.name)}</h2></div>
      <div class="right"><b class="sess-time" id="sess-time">${fmtClock(sessMs())}</b><div class="mut xs">Active time</div></div></div>
    ${w.note ? `<p class="mut sm">${esc(w.note)}</p>` : ''}
    <div class="row sp pt8"><span class="mut sm"><b id="sdone" class="or">${hard}</b> set${hard === 1 ? '' : 's'} logged</span><span class="mut sm"><b class="or" id="svol">${sessionVolume().toLocaleString()} ${unit()}</b> volume</span></div>
    <div class="grid3 pt8">
      ${paused ? `<button class="btn pri" data-a="resumeWorkout">${ic('play', 'fill')} Resume</button>` : `<button class="btn sec" data-a="pauseWorkout">${ic('pause')} Pause</button>`}
      <button class="btn sec" data-a="editWorkout">${ic('pencil')} Edit</button>
      <button class="btn danger" data-a="endWorkout">${ic('stop')} End</button></div>
    ${paused ? '<p class="mut xs pt8">Your timer is stopped. Logging a set resumes it automatically.</p>' : ''}</div>`;
}
function paintSessStats() {
  const v = $('#svol'); if (v) v.textContent = sessionVolume().toLocaleString() + ' ' + unit();
  const d = $('#sdone'); if (d) d.textContent = doneSetCount();
}
function tickSess() {
  try {
    if (!state || !sessActive()) return;
    paintClock(); const e = $('#sess-time'); if (e && !sessPaused()) e.textContent = fmtClock(sessMs());
  } catch (e) { }
}
setInterval(() => { if (!document.hidden) tickSess(); }, 1000);

A.startWorkout = () => {
  const w = wk(); if (!w.items.length) { toast('Add an exercise first'); return; }
  audio(); w.startedAt = Date.now(); w.pausedAt = null; w.pausedMs = 0; delete w.pausedRest; delete w.pausedLabel; planOpen.clear();
  LiveActivity.sync(); cue('set'); buzz('set'); scheduleSave(); renderWorkout(); window.scrollTo(0, 0);
  toast('Workout started. Have a great session.', 2200);
};
A.pauseWorkout = () => {
  const w = wk(); if (!w.startedAt || w.pausedAt) return;
  w.pausedAt = Date.now();
  if (state.timer) { w.pausedRest = timerLeft(); w.pausedLabel = state.timer.label; stopRestTimerQuiet(); }
  LiveActivity.sync(); scheduleSave(); renderWorkout();
};
A.resumeWorkout = () => { resumeCore(); scheduleSave(); renderWorkout(); toast('Workout resumed', 1500); };

/* edit the plan without leaving the session */
A.editWorkout = () => {
  const splits = [['auto', 'Smart'], ['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs'], ['upper', 'Upper'], ['lower', 'Lower'], ['full', 'Full']];
  const b = (x, l, c = 'sec') => `<button class="btn ${c}" data-a="editDo" data-x="${x}">${l}</button>`;
  openSheet('Edit workout', `<div class="col"><p class="mut sm">Your timer keeps running. Reorder with the drag handle on each exercise, or swap and remove from its menu.</p>
    <div class="grid2">${b('addEx', ic('plus') + ' Add exercise')}${b('addCardio', ic('activity') + ' Add cardio')}</div>
    <div class="field"><label>Switch training split (replaces unfinished exercises)</label><div class="chips scrollx">${splits.map(([k, l]) => `<button class="chip ${state.split === k ? 'on' : ''}" data-a="editDo" data-x="split" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="grid2">${b('regen', ic('zap') + ' Regenerate')}${b('autoSuper', ic('link') + ' Auto-pair supersets')}</div>
    <div class="grid2">${b('nl', ic('message') + ' Quick log')}${b('tplOpen', ic('clipboard') + ' Templates')}</div>
    <div class="grid2">${b('repeatLast', ic('repeat') + ' Repeat last workout')}${b('planOpen', ic('calendar') + ' Plan')}</div></div>`);
};
A.editDo = el => { closeSheet(); const f = A[el.dataset.x]; if (f) f(el); };

/* ending */
const fmtDur = ms => { const m = Math.max(1, Math.round(ms / 6e4)); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min'; };
A.endWorkout = () => {
  const n = doneSetCount();
  openSheet('End workout?', n ? `<div class="col"><p class="mut">You have logged <b>${n}</b> set${n === 1 ? '' : 's'} in <b>${fmtDur(sessMs())}</b>. Save it to your history?</p>
      <button class="btn pri hero full" data-a="finish">${ic('check')} Finish &amp; save</button>
      <button class="btn danger full" data-a="discardWorkout">Discard this workout</button>
      <button class="btn sec full" data-a="closeSheet">Keep going</button></div>`
    : `<div class="col"><p class="mut">Nothing is logged yet, so there is nothing to save. Ending now takes you back to your plan.</p>
      <button class="btn danger full" data-a="discardWorkout">End workout</button>
      <button class="btn sec full" data-a="closeSheet">Keep going</button></div>`);
};
A.discardWorkout = () => {
  undoAllDone(); clearSession(wk()); planOpen.clear(); stopRestTimerQuiet(); LiveActivity.end();
  scheduleSave(); closeSheet(); go('workout'); toast('Workout ended. Your plan is ready when you are.', 2600);
};

/* ----- calories (a rough estimate: MET × body weight × time) ----- */
const CARDIO_MET = { cardio_run: 8.5, cardio_walk: 3.8, cardio_bike: 6.8, cardio_row: 7, cardio_rope: 10, cardio_stairs: 8.5, cardio_elliptical: 5, cardio_swim: 7, cardio_hiit: 8 };
function estKcal({ min, workSets, cardio }) {
  const kg = unit() === 'kg' ? bw() : bw() * KG;
  const cm = cardio.reduce((a, c) => a + (+c.min || 0), 0);
  let sm = Math.max(0, (min || 0) - cm);
  if (sm < workSets * 1.2) sm = workSets * 2.5;                 // sets were tapped in quickly or logged after the fact
  const pace = sm > 0 ? workSets / (sm / 10) : 0;                // working sets per 10 minutes
  const met = clamp(2.8 + pace * 0.9, 3, 6);
  let k = met * kg * (sm / 60);
  cardio.forEach(c => { k += (CARDIO_MET[c.exId] || 6) * kg * ((+c.min || 0) / 60); });
  return clamp(Math.round(k / 5) * 5, 0, 2500);
}

/* ----- achievements ----- */
function sessAchievements(rec, prior, prs, stBefore) {
  const out = [], u = rec.unit, n = prior.length + 1;
  prs.filter(p => p.prev).forEach(p => out.push({ ic: 'trophy', t: `New PR: ${p.name}`, d: `${p.w} ${u} × ${p.r} · est. 1RM ${p.prev} → ${p.now} ${u}` }));
  prs.filter(p => !p.prev).slice(0, 3).forEach(p => out.push({ ic: 'flag', t: `First record: ${p.name}`, d: `${p.w ? p.w + ' ' + u + ' × ' : ''}${p.r} is your starting mark. Beat it next time.` }));
  const same = prior.filter(h => h.unit === u && h.vol > 0 && !h.deload);
  if (same.length >= 3 && rec.vol > 0 && !rec.deload) {
    const best = Math.max(...same.map(h => h.vol));
    if (rec.vol > best) out.push({ ic: 'trend', t: 'Biggest session ever by volume', d: `${rec.vol.toLocaleString()} ${u} vs your previous best of ${best.toLocaleString()}` });
  }
  const before = same.reduce((a, h) => a + h.vol, 0), after = before + rec.vol;
  const crossed = [1e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6, 2.5e6, 5e6, 1e7].filter(x => before < x && after >= x).pop();
  if (crossed) out.push({ ic: 'dumbbell', t: `${crossed.toLocaleString()} ${u} lifted all-time`, d: `Lifetime total is now ${after.toLocaleString()} ${u}` });
  if (n === 1) out.push({ ic: 'sparkles', t: 'Your first workout is in the books', d: 'Every streak starts with one.' });
  else if ([5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 350].includes(n) && prior.length < 400) out.push({ ic: 'target', t: `Workout #${n}`, d: 'Consistency is the whole game.' });
  const st = streakInfo();
  if (stBefore.curN < st.goal && st.curN >= st.goal) out.push({ ic: 'check-circle', t: 'Weekly goal hit', d: `${st.curN} of ${st.goal} sessions this week${st.streak >= 2 ? ` · ${st.streak}-week streak` : ''}` });
  (rec.cardio || []).forEach(c => {
    const prev = Math.max(0, ...prior.flatMap(h => (h.cardio || []).filter(x => x.exId === c.exId).map(x => +x.min || 0)));
    if (prev > 0 && c.min > prev) out.push({ ic: 'activity', t: `Longest ${c.name.split(' (')[0]} yet`, d: `${c.min} min vs your previous best of ${prev} min` });
  });
  return out.slice(0, 8);
}

/* ----- finishing: save, then the summary ----- */
A.finish = () => {
  const w = wk(), now = Date.now();
  if (!doneSetCount()) { toast('Log at least one set or cardio first'); return; }
  cue('finish'); buzz('finish');
  const items = [], cardio = [], prMap = new Map(); let sets = 0, vol = 0;
  const prior = state.history.slice(), stBefore = streakInfo();
  w.items.forEach(it => {
    const ex = exById(it.exId); if (!ex) return;
    if (it.cardio) { if (it.done) cardio.push({ exId: ex.id, name: ex.name, min: +it.min || 0, dist: +it.dist || 0 }); return; }
    const done = it.sets.filter(s => s.done); if (!done.length) return;
    done.forEach(s => {
      if (s.type !== 'warmup') { sets++; vol += setVol(ex, s); }
      if (s.pr) { const e = Math.round(est1(ex, s)), cur = prMap.get(ex.id); if (!cur || e > cur.now) prMap.set(ex.id, { name: ex.name, w: loadOf(ex, s), r: +s.reps || 0, now: e, prev: s.prevPR ? s.prevPR.e1rm : null }); }
    });
    items.push({ exId: ex.id, name: ex.name, p: ex.primary, s: ex.secondary || [], sets: done.map(s => ({ w: +s.weight || 0, r: +s.reps || 0, rir: +s.rir || 0, fail: !!s.fail, type: s.type || 'work', pct: s.pct ?? null })) });
    if (!ex.noE1) { const best = Math.max(0, ...done.filter(s => s.type === 'work').map(s => est1(ex, s))); if (best > 0) { (state.e1rmHist[ex.id] = state.e1rmHist[ex.id] || []).push({ t: now, v: Math.round(best) }); if (state.e1rmHist[ex.id].length > 400) state.e1rmHist[ex.id].shift(); } }
  });
  const dur = w.startedAt ? Math.max(1, Math.round(sessMs(now) / 6e4)) : 0;
  const kcal = estKcal({ min: dur, workSets: sets, cardio });
  const rec = { id: uid(), t: now, name: w.name, split: w.split || '', sets, vol: Math.round(vol), dur, unit: unit(), prs: prMap.size, kcal, items, cardio };
  if (isDeload()) rec.deload = true;
  state.history.unshift(rec); state.history = state.history.slice(0, 400);
  const ach = sessAchievements(rec, prior, [...prMap.values()], stBefore);
  rec.ach = ach.map(a => a.t);
  HealthBridge.writeWorkout({ start: w.startedAt || now, end: now, name: w.name, calories: kcal });
  LiveActivity.end(); stopRestTimerQuiet();
  window.__lastSession = { rec, ach, tpl: w.items.filter(it => !it.cardio).map(it => ({ exId: it.exId, superset: it.superset, sets: it.sets.filter(s => s.type !== 'warmup').map(s => ({ w: +s.weight, r: +s.reps })) })) };
  clearSession(wk()); planOpen.clear();
  scheduleSave(); flushSave(); generateWorkout(true);
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  openSheet('Workout complete', `<div class="col"><div class="tiles">${tile(rec.dur ? rec.dur + 'm' : '—', 'Active time')}${tile('≈ ' + kcal.toLocaleString(), 'kcal burned')}${tile(sets, 'Hard sets')}${tile(rec.vol.toLocaleString(), unit() + ' volume')}${tile(rec.prs, 'PRs')}</div>
    <p class="mut xs center">Calories are a rough estimate from your body weight, active time and effort (pauses are not counted). Real burn can differ by about 25%.</p>
    ${ach.length ? `<h4 class="subh">Achievements</h4>${ach.map(a => `<div class="ach"><span class="aic">${ic(a.ic)}</span><div class="grow"><b>${esc(a.t)}</b><div class="mut xs">${esc(a.d)}</div></div></div>`).join('')}` : '<p class="mut sm center">No records this time. Showing up and logging the work is what builds them.</p>'}
    ${streakLine()}
    <h4 class="subh">What you did</h4>
    ${items.map(i => `<div class="prow static"><b>${esc(i.name)}</b><span class="mut xs">${i.sets.filter(s => s.type !== 'warmup').map(s => s.w + '×' + s.r).join(' · ')}</span></div>`).join('')}
    ${cardio.map(c => `<div class="prow static"><b>${esc(c.name)}</b><span class="mut xs">${c.min} min${c.dist ? ' · ' + c.dist : ''}</span></div>`).join('')}
    <div class="grid2"><button class="btn sec" data-a="sessTpl">Save as routine</button><button class="btn sec" data-a="sessShare">Share summary</button></div>
    <button class="btn pri full" data-a="closeSheet">Done</button></div>`, { onClose: () => go('workout') });
};
A.sessShare = () => {
  const s = window.__lastSession, r = s.rec, lines = [`ForgeFit · ${r.name} · ${fmtDate(r.t)}`, `${r.sets} sets · ${r.vol.toLocaleString()} ${r.unit} volume${r.dur ? ' · ' + r.dur + ' min' : ''}${r.kcal ? ' · ~' + r.kcal + ' kcal' : ''}`];
  if (s.ach.length) lines.push('', ...s.ach.map(a => '• ' + a.t));
  lines.push('');
  r.items.forEach(i => lines.push(`${i.name}: ${i.sets.filter(x => x.type !== 'warmup').map(x => x.w + '×' + x.r).join(', ')}`));
  r.cardio.forEach(c => lines.push(`${c.name}: ${c.min} min${c.dist ? ', ' + c.dist : ''}`));
  shareText(lines.join('\n'), 'My workout');
};
