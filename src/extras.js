'use strict';
/* =====================================================================
   ForgeFit extras: progression hints, swipe gestures, planning (week view,
   streaks, training blocks, rest advice), backup reminder, profiles,
   exercise library, bodyweight-vs-strength chart
   ===================================================================== */
const fmtN = n => String(Math.round(n * 2) / 2);
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
function copyText(text, okMsg) {
  const done = () => toast(okMsg || 'Copied');
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, () => prompt('Copy this:', text)); return; } } catch (e) { }
  prompt('Copy this:', text);
}
function undoAllDone() { wk().items.forEach(it => (it.sets || []).forEach(s => { if (s.done) { const ex = exById(it.exId); if (ex) undoSet(it, s, ex); } })); }

/* ---------- progression hints on each exercise card ---------- */
function targetReps(ex) {
  const g = GOALS[state.profile.goal] || GOALS.muscle, fixed = ex.bw !== undefined || ex.custom;
  return fixed ? (ex.reps || 10) : (ex.type === 'compound' ? g.cReps : g.iReps);
}
/* Go up when every working set last time reached the rep target without being taken to failure */
function progressHint(ex, it) {
  if (ex.cardio || ex.noE1 || isDeload() || it.bumped) return null;
  const cur = it.sets.filter(s => s.type === 'work' && !s.done); if (!cur.length) return null;
  const l = lastPerf(ex.id, true); if (!l) return null;
  const ws = l.filter(s => s.type === 'work'); if (ws.length < 2) return null;
  const tgt = targetReps(ex);
  if (!ws.every(s => s.r >= tgt) || ws.some(s => s.fail || s.rir === 0)) return null;
  const top = Math.max(...ws.map(s => s.w)), to = top + inc();
  if (cur.some(s => (+s.weight || 0) >= to)) return null;
  return { to, msg: `Hit ${tgt}+ reps on every set last time. Try ${to} ${unit()}` };
}
function fatigueHint(ex, it) {
  if (ex.cardio || ex.noE1 || isDeload() || it.trimmed) return null;
  const p = rec(ex.primary); if (p >= 55) return null;
  if (!it.sets.some(s => s.type === 'work' && !s.done && +s.weight > 0)) return null;
  return { msg: `${ex.primary} is only ${p}% fresh. Tap to lower weights 10%` };
}
A.bump = el => {
  const i = +el.dataset.i, it = wk().items[i]; if (!it) return;
  it.sets.forEach(s => { if (s.type === 'work' && !s.done) s.weight = (+s.weight || 0) + inc(); });
  it.bumped = true; scheduleSave(); refreshCard(i); toast(`Weights up ${inc()} ${unit()}`);
};
A.trim = el => {
  const i = +el.dataset.i, it = wk().items[i]; if (!it) return;
  it.sets.forEach(s => { if (s.type === 'work' && !s.done && +s.weight > 0) s.weight = Math.max(inc(), rnd(s.weight * .9)); });
  it.trimmed = true; scheduleSave(); refreshCard(i); toast('Weights lowered 10%');
};

/* ---------- swipe a set: left = delete (with undo), right = duplicate ---------- */
let sw = null, swBlock = 0;
document.addEventListener('focusin', e => {            // typing replaces the old number instead of editing it
  const el = e.target; if (!el.matches || !el.matches('.srow input, input[data-f=cardio]')) return;
  setTimeout(() => { try { el.select(); el.setSelectionRange(0, String(el.value).length); } catch (x) { } }, 0);
});
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const row = e.target.closest && e.target.closest('.srow'); if (!row || e.target.closest('select')) return;
  const wrap = row.closest('.swrap'); if (!wrap) return;
  sw = { row, wrap, x0: e.clientX, y0: e.clientY, pid: e.pointerId, on: false, dx: 0 };
});
document.addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.pid) return;
  const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
  if (!sw.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }      // vertical scrolling wins
    if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    sw.on = true; sw.row.classList.add('swiping');
    try { sw.row.setPointerCapture(e.pointerId); } catch (x) { }
    try { getSelection().removeAllRanges(); } catch (x) { }
  }
  sw.dx = clamp(dx, -140, 140);
  sw.row.style.transform = `translateX(${sw.dx}px)`;
  sw.wrap.classList.toggle('sw-del', sw.dx < -6); sw.wrap.classList.toggle('sw-dup', sw.dx > 6);
  sw.wrap.classList.toggle('sw-go', Math.abs(sw.dx) >= 90);
});
function swEnd(commit) {
  const s = sw; if (!s) return; sw = null;
  if (!s.on) return;
  swBlock = Date.now() + 400;
  try { s.row.releasePointerCapture(s.pid); } catch (x) { }
  s.row.classList.remove('swiping'); s.wrap.classList.remove('sw-del', 'sw-dup', 'sw-go'); s.row.style.transform = '';
  const card = s.row.closest('.ex'), list = s.wrap.parentNode, i = card ? +card.dataset.ex : -1, j = list ? [...list.children].indexOf(s.wrap) : -1;
  if (!commit || i < 0 || j < 0) return;
  if (s.dx <= -90) swipeDelete(i, j); else if (s.dx >= 90) swipeDup(i, j);
}
document.addEventListener('pointerup', e => { if (sw && e.pointerId === sw.pid) swEnd(true); });
document.addEventListener('pointercancel', e => { if (sw && e.pointerId === sw.pid) swEnd(false); });
document.addEventListener('click', e => {      // the tap that ends a swipe must not also log or edit a set
  if (Date.now() < swBlock && (!e.target.closest || e.target.closest('.swrap') || !document.body.contains(e.target))) { e.stopPropagation(); e.preventDefault(); }
}, true);
function swipeDelete(i, j) {
  const it = wk().items[i]; if (!it || !it.sets[j]) return;
  undoIfDone(i, j);
  const gone = it.sets.splice(j, 1)[0]; scheduleSave(); refreshCard(i);
  toast('Set deleted', 6500, { label: 'Undo', fn: () => { const k = wk().items.findIndex(x => x.id === it.id); if (k < 0) return; wk().items[k].sets.splice(Math.min(j, wk().items[k].sets.length), 0, gone); scheduleSave(); refreshCard(k); } });
}
function swipeDup(i, j) { A.setDup({ dataset: { i, j } }); toast('Set duplicated'); }

/* ---------- repeat last workout ---------- */
A.repeatLast = () => {
  const h = state.history.find(x => (x.items && x.items.length) || (x.cardio && x.cardio.length));
  if (!h) { toast('Finish a workout first, then you can repeat it'); return; }
  if (doneSetCount() && !confirm(`Replace your current session with a repeat of "${h.name || 'your last workout'}"?`)) return;
  undoAllDone();
  const items = (h.items || []).filter(i => exById(i.exId)).map(i => {
    const ex = exById(i.exId);
    return { id: uid(), exId: i.exId, superset: null, tempo: ex.tempo, sets: convSets(i.sets, h.unit).map(s => ({ weight: s.w, reps: s.r, rir: s.rir ?? 2, fail: !!s.fail, done: false, type: s.type || 'work' })) };
  });
  (h.cardio || []).forEach(c => { const ex = exById(c.exId); if (ex) { const it = buildItem(ex, { min: c.min }); it.dist = c.dist || 0; items.push(it); } });
  if (!items.length) { toast('Nothing from that session can be repeated'); return; }
  state.workout = carrySession(wk(), { startedAt: null, name: (h.name || 'Workout').replace(/^Repeat: /, ''), split: h.split || '', note: `Repeat of ${fmtDate(h.t)}. Weights and reps match what you did.`, items });
  normSS(); scheduleSave(); renderWorkout(); window.scrollTo(0, 0); toast('Last workout loaded');
};

/* ---------- weeks, streaks, schedule ---------- */
const weekStartDow = () => state.settings.weekStart === 0 ? 0 : 1;
function weekStartOf(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() - weekStartDow() + 7) % 7)); return d.getTime(); }
function trainedDays() {
  const set = new Set();
  state.history.forEach(h => { if (h.t && ((h.items && h.items.length) || (h.cardio && h.cardio.length))) set.add(ymd(h.t)); });
  return set;
}
const DEF_DAYS = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
function trainDays() {
  const p = state.profile;
  if (Array.isArray(p.trainDays) && p.trainDays.length) return [...new Set(p.trainDays.map(Number).filter(n => n >= 0 && n <= 6))].sort((a, b) => a - b);
  return DEF_DAYS[clamp(Math.round(p.days) || 4, 1, 7)];
}
function streakInfo() {
  const goal = clamp(Math.round(state.profile.days) || trainDays().length || 3, 1, 7), days = trainedDays();
  const count = ws => { let n = 0; for (let k = 0; k < 7; k++) if (days.has(ymd(addDays(ws, k)))) n++; return n; };
  const cur = weekStartOf(Date.now()), curN = count(cur);
  let streak = curN >= goal ? 1 : 0, w = addDays(cur, -7), g = 0;
  while (g++ < 600 && count(w) >= goal) { streak++; w = addDays(w, -7); }
  const ts = state.history.filter(h => h.t).map(h => h.t);
  let best = 0, run = 0;
  for (let ws = ts.length ? weekStartOf(Math.min(...ts)) : cur, k = 0; ws <= cur && k < 700; ws = addDays(ws, 7), k++) {
    if (count(ws) >= goal) { run++; best = Math.max(best, run); } else if (ws !== cur) run = 0;
  }
  return { streak, best: Math.max(best, streak), curN, goal };
}
function streakLine() {
  const st = streakInfo(); if (!st.streak && !st.curN) return '';
  const left = st.goal - st.curN;
  return `<p class="center sm or">🔥 ${st.streak ? st.streak + '-week streak · ' : ''}${st.curN}/${st.goal} sessions this week${left <= 0 ? ' · goal hit!' : ''}</p>`;
}
const SHORT_SPLIT = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower', full: 'Full' };
function weekCard() {
  const today = sod(Date.now()), ws = weekStartOf(today), td = trainDays(), done = trainedDays(), tk = ymd(today), inProg = doneSetCount() > 0;
  const seq = { ppl: ['push', 'pull', 'legs'], ul: ['upper', 'lower'], full: ['full'] }[state.profile.splitPref];
  const lastSplit = (state.history.find(h => h.split && h.items && h.items.length) || {}).split;
  let li = seq ? (seq.indexOf(lastSplit) + 1) % seq.length : 0;
  const cells = [];
  for (let k = 0; k < 7; k++) {
    const t = addDays(ws, k), d = new Date(t), key = ymd(t), isToday = key === tk, past = t < today, did = done.has(key) || (isToday && inProg), plan = td.includes(d.getDay());
    let cls = 'rest', lab = 'Rest';
    if (did) { cls = 'did'; lab = '✓'; }
    else if (plan && !past) { cls = 'plan'; lab = seq ? SHORT_SPLIT[seq[li % seq.length]] : 'Smart'; li++; }
    else if (plan) { cls = 'miss'; lab = '–'; }
    cells.push(`<div class="wd ${cls} ${isToday ? 'today' : ''}"><span>${d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span><b>${d.getDate()}</b><small>${lab}</small></div>`);
  }
  const st = streakInfo(), adv = restAdvice();
  return `<button class="card week" data-a="planOpen" aria-label="Open weekly plan">
    <div class="row sp"><span class="lbl">This week</span><span class="mut xs">${st.streak ? `<b class="or">🔥 ${st.streak}-week streak</b> · ` : ''}${st.curN}/${st.goal} sessions</span></div>
    <div class="wk7">${cells.join('')}</div>
    <div class="wadv ${adv.tone}">${esc(adv.short)} <i>Plan ›</i></div></button>`;
}

/* ---------- rest-day advice from recovery ---------- */
function bestSplitNow() {
  const grp = { Push: ['Chest', 'Shoulders', 'Triceps'], Pull: ['Back', 'Biceps'], Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] };
  let best = 'Push', bs = -1;
  Object.entries(grp).forEach(([n, ms]) => { const a = ms.reduce((x, m) => x + rec(m), 0) / ms.length; if (a > bs) { bs = a; best = n; } });
  return { name: best, pct: Math.round(bs) };
}
function consecutiveDays() {
  const d = trainedDays(); let n = 0, t = sod(Date.now());
  if (!d.has(ymd(t))) t = addDays(t, -1);
  while (d.has(ymd(t)) && n < 30) { n++; t = addDays(t, -1); }
  return n;
}
function restAdvice() {
  updatePassiveRecovery();
  const avg = avgRecovery(), tired = [...MUSCLES].sort((a, b) => rec(a) - rec(b)).filter(m => rec(m) < 55);
  const planned = trainDays().includes(new Date().getDay()), run = consecutiveDays(), best = bestSplitNow();
  if (trainedDays().has(ymd(Date.now()))) return { tone: 'ok', short: 'Session logged today. Eat well and sleep.', title: 'Done for today', body: 'Today’s work is in the bank. Recovery is when the gains happen, so eat well and sleep.' };
  if (avg < 50 || tired.length >= 4 || (run >= 3 && avg < 75)) return {
    tone: 'rest', short: `Rest day suggested · ${avg}% fresh`, title: 'Take a rest day',
    body: `Average freshness is ${avg}%${tired.length ? `, and ${tired.slice(0, 3).join(', ')} ${tired.length > 1 ? 'are' : 'is'} still low` : ''}${run >= 3 ? `. You have trained ${run} days in a row` : ''}. An easy walk or some stretching is plenty.${planned ? ' Today is on your schedule, but recovery matters more than the calendar.' : ''}`
  };
  if (avg < 70) return { tone: 'light', short: `Light day or ${best.name} · ${avg}% fresh`, title: 'Fine to train, keep it moderate', body: `Average freshness is ${avg}%. ${best.name} muscles are the freshest (${best.pct}%), so that is the smart pick. Keep a rep or two in reserve.` };
  return { tone: 'go', short: `Good to train${planned ? '' : ' (planned rest day, optional)'} · best bet: ${best.name}`, title: 'Green light', body: `You are ${avg}% fresh on average. ${best.name} muscles are the most recovered (${best.pct}%).${planned ? '' : ' Today is a planned rest day, so this session is optional.'}` };
}
function restCard() {
  const a = restAdvice();
  return `<div class="banner ${{ go: 'ok', light: 'note', rest: 'warn', ok: 'info' }[a.tone]}"><div class="grow"><b>${esc(a.title)}</b><div class="mut sm">${esc(a.body)}</div></div></div>`;
}

/* ---------- training blocks (ramp up, then an automatic deload week) ---------- */
function blockInfo() {
  const b = state.block; if (!b || !(b.weeks >= 2) || !b.start) return null;
  const week = Math.floor((Date.now() - b.start) / (7 * DAY)) + 1, end = b.start + b.weeks * 7 * DAY;
  if (week < 1) return null;
  if (week > b.weeks) return { week: b.weeks, weeks: b.weeks, done: true, deload: false, end };
  return { week, weeks: b.weeks, done: false, deload: week === b.weeks && !b.skipDeload, end };
}
const blockDeload = () => { const i = blockInfo(); return !!(i && i.deload); };
function blockRirAdj() {        // early weeks leave more in the tank, late weeks get closer to failure
  const i = blockInfo(); if (!i || i.done || i.deload) return 0;
  const ramp = i.weeks - 1; if (ramp < 2) return 0;
  const p = (i.week - 1) / (ramp - 1);
  return p < .34 ? 1 : p < .8 ? 0 : -1;
}
function checkBlock() {
  const i = blockInfo(); if (!i || !state.block || !i.deload || state.block.deloadMarked) return;
  state.block.deloadMarked = true; state.lastDeload = Date.now(); scheduleSave();
  if (!doneSetCount()) generateWorkout(true);
}
function blockBanner() {
  const i = blockInfo(); if (!i || !i.done || state.block.ackDone) return '';
  return `<div class="banner ok"><div class="grow"><b>Training block complete 🎉</b><div class="mut sm">${i.weeks} weeks done, including the deload. Check your strength curve, then plan the next block.</div></div><div class="col gap6"><button class="mini pri" data-a="planOpen">Plan next</button><button class="mini" data-a="blockAck">Dismiss</button></div></div>`;
}
A.blockAck = () => { if (state.block) { state.block.ackDone = true; scheduleSave(); renderWorkout(); } };
let planWeeks = 8;
function blockHtml() {
  const i = blockInfo(), g = GOALS[state.profile.goal] || GOALS.muscle;
  const start = `<div class="chips">${[4, 6, 8, 10, 12].map(n => `<button class="chip ${planWeeks === n ? 'on' : ''}" data-a="blockWeeks" data-n="${n}">${n} weeks</button>`).join('')}</div>
    <button class="btn pri full mt8" data-a="blockStart">Start ${planWeeks}-week block</button>`;
  if (!i) return `<p class="mut sm">A block builds for a few weeks (early weeks leave more reps in reserve, later weeks push closer to failure), then the last week is an automatic lighter deload.</p>${start}`;
  const dots = Array.from({ length: i.weeks }, (_, k) => `<i class="${k + 1 < i.week || i.done ? 'past' : k + 1 === i.week ? 'cur' : ''} ${k + 1 === i.weeks ? 'dl' : ''}"></i>`).join('');
  if (i.done) return `<p class="mut sm">Your last block finished.</p><div class="bdots">${dots}</div>${start}`;
  const target = clamp(g.rir + blockRirAdj() + (i.deload ? 1 : 0), 0, 4), rpe = state.settings.rpe;
  return `<div class="bdots">${dots}</div>
    <p class="sm"><b>Week ${i.week} of ${i.weeks}</b> · ${i.deload ? 'Deload week: lighter weights, fewer sets' : `building · aim for about ${rpe ? 'RPE ' + (10 - target) : target + ' reps in reserve'}`}</p>
    <p class="mut xs">${i.deload ? 'Ends' : 'Deload starts'} ${fmtDate(i.deload ? i.end : addDays(state.block.start, (i.weeks - 1) * 7), { weekday: 'short', month: 'short', day: 'numeric' })}. New workouts follow the block’s targets.</p>
    <button class="btn danger full mt8" data-a="blockEnd">End block</button>`;
}
A.blockWeeks = el => { planWeeks = +el.dataset.n; sheetBody(planHtml()); };
A.blockStart = () => {
  state.block = { weeks: planWeeks, start: sod(Date.now()) };
  scheduleSave(); sheetBody(planHtml()); toast(`${planWeeks}-week block started. Regenerate to use week-1 targets.`, 4000);
};
A.blockEnd = () => { if (!confirm('End this training block?')) return; state.block = null; scheduleSave(); sheetBody(planHtml()); if (tab === 'workout') renderWorkout(); };

/* ---------- plan sheet ---------- */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function planHtml() {
  const a = restAdvice(), st = streakInfo(), td = trainDays(), order = [0, 1, 2, 3, 4, 5, 6].map(k => (weekStartDow() + k) % 7);
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  return `<div class="col">
    <div class="banner ${{ go: 'ok', light: 'note', rest: 'warn', ok: 'info' }[a.tone]}"><div class="grow"><b>${esc(a.title)}</b><div class="mut sm">${esc(a.body)}</div></div></div>
    <div class="tiles">${tile(st.streak ? '🔥 ' + st.streak : '0', 'Week streak')}${tile(st.curN + '/' + st.goal, 'This week')}${tile(st.best, 'Best streak')}</div>
    <div class="field"><label>Training days</label><div class="chips">${order.map(d => `<button class="chip ${td.includes(d) ? 'on' : ''}" data-a="planDay" data-d="${d}">${DOW[d]}</button>`).join('')}</div>
      <p class="mut xs pt8">Tap the days you plan to train. Your weekly goal (${td.length}) and streak follow this. A streak counts weeks where you hit your goal.</p></div>
    <div class="sep"></div>
    <div class="field"><label>Training block</label>${blockHtml()}</div></div>`;
}
A.planOpen = () => openSheet('Plan', planHtml(), { onClose: () => { if (tab === 'workout') renderWorkout(); } });
A.planDay = el => {
  const d = +el.dataset.d, cur = trainDays(), next = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
  if (!next.length) { toast('Pick at least one training day'); return; }
  state.profile.trainDays = next.sort((a, b) => a - b); state.profile.days = next.length; scheduleSave(); sheetBody(planHtml());
};

/* ---------- weekly volume per muscle, targets and nudges ---------- */
function weeklySets(nw = 4) {
  const now = Date.now(), out = {}; MUSCLES.forEach(m => out[m] = Array(nw).fill(0));
  state.history.forEach(h => {
    if (!h.t) return; const k = Math.floor((now - h.t) / (7 * DAY)); if (k < 0 || k >= nw) return; const col = nw - 1 - k;
    (h.items || []).forEach(i => i.sets.forEach(s => {
      if (s.type === 'warmup') return;
      if (out[i.p]) out[i.p][col] += 1;
      (i.s || []).forEach(m => { if (out[m]) out[m][col] += .5; });
    }));
  });
  return out;
}
function setTarget(m) {
  const p = state.profile, base = { strength: [6, 12], muscle: [10, 18], tone: [8, 14], fitness: [6, 12] }[p.goal] || [10, 18];
  const k = ({ Core: .6, Calves: .6, Biceps: .7, Triceps: .7 }[m] || 1) * (p.experience === 'beginner' ? .7 : p.experience === 'advanced' ? 1.15 : 1);
  return [Math.max(3, Math.round(base[0] * k)), Math.max(5, Math.round(base[1] * k))];
}
function nudgeFor() {
  const now = Date.now(); if (now < (state.nudgeSnooze || 0)) return null;
  if (state.history.filter(h => h.t > now - 14 * DAY && h.items && h.items.length).length < 2) return null;
  const ws = weeklySets(1);
  const c = MUSCLES.filter(m => allEx().some(e => e.primary === m && !e.cardio && hasGear(e)))
    .map(m => ({ m, sets: ws[m][0], min: setTarget(m)[0], since: (now - (state.muscles[m].lastTrained || 0)) / DAY }))
    .filter(x => x.sets < x.min * .4 && x.since > 5)
    .sort((a, b) => a.sets / a.min - b.sets / b.min || b.since - a.since);
  return c[0] || null;
}
function nudgeBanner() {
  const n = nudgeFor(); if (!n) return '';
  return `<div class="banner note"><div class="grow"><b>${n.m} is falling behind</b><div class="mut sm">${fmtN(n.sets)} hard sets in the last 7 days. Most people grow best with ${setTarget(n.m)[0]}+ per week.</div></div><div class="col gap6"><button class="mini pri" data-a="nudgeAdd" data-m="${n.m}">Add ${n.m.toLowerCase()} work</button><button class="mini" data-a="nudgeLater">Later</button></div></div>`;
}
A.nudgeAdd = el => openPicker('add', -1, el.dataset.m);
A.nudgeLater = () => { state.nudgeSnooze = Date.now() + DAY; scheduleSave(); renderWorkout(); };

/* ---------- banners at the top of the Workout tab (kept short: at most two) ---------- */
function backupDue() {
  const now = Date.now(), base = Math.max(state.lastExport || 0, state.createdAt || 0);
  if (!(state.history.length || state.measures.length)) return false;
  return now - base > 14 * DAY && now > (state.backupSnooze || 0);
}
function backupBanner() {
  if (!backupDue()) return '';
  const last = state.lastExport, days = Math.floor((Date.now() - Math.max(last || 0, state.createdAt || 0)) / DAY);
  return `<div class="banner note"><div class="grow"><b>Time for a backup</b><div class="mut sm">${last ? `It has been ${days} days since your last backup.` : 'You have not backed up yet.'} Save a copy to Files, Drive or email in about 10 seconds.</div></div><div class="col gap6"><button class="mini pri" data-a="exportJSON">Back up</button><button class="mini" data-a="backupLater">Later</button></div></div>`;
}
A.backupLater = () => { state.backupSnooze = Date.now() + 3 * DAY; scheduleSave(); renderWorkout(); };
function topBanners() {
  const list = [coachBanner(), blockBanner(), backupBanner(), nudgeBanner(), recapBanner()].filter(Boolean).slice(0, 2);
  return list.join('') + whatsNew();
}

/* ---------- profiles (several people on one phone) ---------- */
const profName = id => (PROFILES.list.find(p => p.id === id) || {}).name || 'Me';
function paintChrome() {
  const b = $('#pname'); if (!b) return;
  b.hidden = PROFILES.list.length < 2; b.textContent = '👤 ' + profName(PROFILES.active);
}
async function switchProfile(id) {
  flushSave();
  try { await Promise.race([idbPut('kv', { key: IDB_STATE, value: JSON.stringify(state) }), new Promise(r => setTimeout(r, 700))]); } catch (e) { }
  PROFILES.active = id; writeProfiles(); location.reload();
}
function profCard(inner) {
  const cur = PROFILES.active;
  return `${inner ? '' : '<div class="card col">'}<div class="row sp">${inner ? '<b>People on this phone</b>' : '<h2 class="h2">People on this phone</h2>'}<button class="mini pri" data-a="profAdd">＋ Add</button></div>
    <p class="mut sm">Each person gets their own workouts, history, photos and settings. Switching reloads the app.</p>
    ${PROFILES.list.map(p => `<div class="prow static"><div class="grow"><b>${esc(p.name)}</b></div>${p.id === cur ? '<span class="tag gr">Active</span>' : `<button class="mini pri" data-a="profSwitch" data-id="${esc(p.id)}">Switch</button>`}<button class="mini" data-a="profRename" data-id="${esc(p.id)}">Rename</button>${PROFILES.list.length > 1 && p.id !== cur ? `<button class="mini" data-a="profDel" data-id="${esc(p.id)}" aria-label="Delete profile">✕</button>` : ''}</div>`).join('')}${inner ? '' : '</div>'}`;
}
A.profSwitch = el => { if (el.dataset.id !== PROFILES.active) switchProfile(el.dataset.id); };
A.profMenu = () => openSheet('Switch person', `<div class="col">${PROFILES.list.map(p => `<button class="prow" data-a="profSwitch" data-id="${esc(p.id)}"><b>${esc(p.name)}</b>${p.id === PROFILES.active ? '<span class="tag gr">Active</span>' : ''}</button>`).join('')}</div>`);
A.profAdd = () => ask('New person', 'Name', '', n => { const id = 'p' + uid().slice(0, 6); PROFILES.list.push({ id, name: n.slice(0, 24) }); writeProfiles(); switchProfile(id); }, 'Create & switch');
A.profRename = el => { const p = PROFILES.list.find(x => x.id === el.dataset.id); if (!p) return; ask('Rename', 'Name', p.name, n => { p.name = n.slice(0, 24); writeProfiles(); paintChrome(); if (tab === 'more') renderMore(); }); };
A.profDel = async el => {
  const id = el.dataset.id, p = PROFILES.list.find(x => x.id === id); if (!p || id === PROFILES.active) return;
  if (!confirm(`Delete ${p.name} and all of their data on this phone?`) || !confirm('This cannot be undone. Delete?')) return;
  const k = keysFor(id);
  try { const o = JSON.parse(localStorage.getItem(k.ls) || 'null'); if (o && Array.isArray(o.photos)) for (const ph of o.photos) await idbDel('photos', ph.id).catch(() => { }); } catch (e) { }
  try { localStorage.removeItem(k.ls); localStorage.removeItem(k.bak); await idbDel('kv', k.idb); } catch (e) { }
  PROFILES.list = PROFILES.list.filter(x => x.id !== id); writeProfiles(); paintChrome(); renderMore();
};

/* ---------- exercise library ---------- */
const HOW = {
  bb_bench: ['Lie back with your eyes under the bar, feet planted, shoulder blades pinched down and back.', 'Unrack, lower the bar to your lower chest with forearms vertical, then press up and slightly back over your shoulders.', 'Keep your butt on the bench. Use safety arms or a spotter near failure.'],
  incline_bb_bench: ['Set the bench to about 30 degrees and lie back with your shoulder blades pinched.', 'Lower the bar to your upper chest, elbows about 45 degrees from your torso, then press straight up.', 'A steeper bench shifts work to the shoulders, so stay near 30 degrees.'],
  db_press: ['Sit with the dumbbells on your thighs, lie back and kick them up to chest height.', 'Lower with control until you feel a stretch across the chest, then press up and slightly in.', 'The app logs both dumbbells combined (2 × 50 lb = 100).'],
  incline_db_press: ['Set the bench to about 30 degrees and start with the dumbbells at your upper chest.', 'Press up and slightly in, lower slowly to a deep stretch.', 'The app logs both dumbbells combined.'],
  machine_chest_press: ['Adjust the seat so the handles line up with mid-chest.', 'Press forward until your arms are almost straight, pause, and return slowly.', 'Keep your shoulders down and back against the pad.'],
  cable_fly: ['Set the pulleys at chest height and take a staggered stance with a slight forward lean.', 'With soft elbows, sweep your hands together in a hugging arc, squeeze, and return slowly.', 'The elbow bend stays the same the whole time. This is not a press.'],
  pushups: ['Hands just wider than your shoulders, body in one line from head to heels.', 'Lower until your chest nearly touches the floor with elbows about 45 degrees, then push the floor away.', 'The weight field is extra load only (plate or backpack). Your bodyweight is counted for you.'],
  dips: ['Support yourself on parallel bars or sturdy chairs with straight arms.', 'Lean slightly forward, lower until your shoulders are just below your elbows, then press back up.', 'If your shoulders pinch at the bottom, shorten the range.'],
  ohp: ['Bar at collarbone height, grip just outside shoulders, glutes and abs tight.', 'Press the bar straight up, moving your head back then through once the bar passes your forehead.', 'Do not lean back. Keep your ribs down.'],
  db_shoulder_press: ['Sit with back support and the dumbbells at shoulder height, palms forward.', 'Press up until your arms are nearly straight, then lower to about ear height.', 'The app logs both dumbbells combined.'],
  db_lat_raise: ['Stand tall with a dumbbell in each hand and a slight bend in your elbows.', 'Raise your arms out to the sides to shoulder height, leading with the elbows, then lower slowly.', 'Go lighter than you think and do not swing. The app logs both dumbbells combined.'],
  cable_lat_raise: ['Stand side-on to a low pulley with the handle in the far hand.', 'Raise your arm out to the side to shoulder height with a slight elbow bend, then lower slowly.', 'The cable keeps tension at the bottom, so do not rest there.'],
  landmine_press: ['Wedge the end of the barbell in a corner and hold the free end at your shoulder.', 'Press up and forward along the arc until your arm is straight.', 'Keep your ribs stacked over your hips and do not lean back.'],
  face_pull: ['Set a rope at upper-chest to eye height and step back until the cable is tight.', 'Pull the rope toward your face, spreading the ends apart and rotating your hands up.', 'Light weight and slow reps. Think back of the shoulders, not biceps.'],
  rear_delt_fly: ['Hinge forward with a flat back and the dumbbells hanging under your chest.', 'Raise your arms out wide with soft elbows until level with your torso, then lower slowly.', 'Keep it light. The app logs both dumbbells combined.'],
  bb_row: ['Hinge to about 45 degrees with a flat back, bar hanging below your shoulders.', 'Pull the bar to your lower ribs, squeeze your shoulder blades, then lower with control.', 'Do not jerk upright to move the weight.'],
  pendlay_row: ['Set the bar on the floor with your torso parallel to the ground and a flat back.', 'Pull the bar quickly to your lower chest and return it to the floor each rep.', 'Reset your back position on every rep.'],
  pullups: ['Hang from the bar with hands just outside shoulder width.', 'Pull your chest toward the bar by driving your elbows down, then lower to a full hang.', 'The weight field is added load only (belt or dumbbell). Bodyweight is counted for you.'],
  db_row: ['Brace one hand and one knee on a bench with a dumbbell in the other hand.', 'Pull the dumbbell toward your hip, keep your torso still, and lower until your arm is straight.', 'The app counts both sides together (one dumbbell × 2).'],
  lat_pulldown: ['Adjust the thigh pad, take a grip slightly wider than shoulders and lean back a touch.', 'Pull the bar to your upper chest by driving your elbows down and back, then let it rise slowly.', 'Do not swing your torso to move the weight.'],
  seated_cable_row: ['Sit tall with feet braced and knees slightly bent, handle in both hands.', 'Row to your navel, squeeze your shoulder blades together, then extend your arms slowly.', 'Your torso barely moves. Keep your chest tall.'],
  deadlift: ['Bar over mid-foot, hands just outside your legs, hips back, chest up, back flat.', 'Brace hard and push the floor away, keeping the bar against your legs until you stand tall.', 'Lower by pushing your hips back first. Never round your lower back.'],
  superman: ['Lie face down with your arms extended in front of you.', 'Lift your arms, chest and legs a few inches, pause one second, then lower.', 'Move slowly and keep your neck neutral.'],
  bb_squat: ['Bar on your upper back, feet shoulder width, toes slightly out, abs braced.', 'Sit down and back until your thighs are at least parallel, then drive up through your whole foot.', 'Knees track over toes. Do not let them cave in.'],
  front_squat: ['Bar across the front of your shoulders with elbows high, feet shoulder width.', 'Sit straight down keeping your chest up and elbows high, then stand.', 'If the bar rolls forward, your elbows dropped.'],
  bulgarian_split: ['Put your back foot on a bench, front foot about two feet ahead, dumbbells at your sides.', 'Lower straight down until the front thigh is parallel, then drive up through the front heel.', 'The app logs both dumbbells combined.'],
  goblet_squat: ['Hold one dumbbell vertically against your chest.', 'Squat down between your hips with elbows inside your knees, then stand.', 'A great warm-up and form drill for any squat.'],
  leg_press: ['Sit with your feet mid-platform, shoulder width apart.', 'Lower until your knees are around 90 degrees without your hips curling off the pad, then press.', 'Never lock your knees hard at the top.'],
  leg_extension: ['Set the pad just above your ankles and the back so your knees line up with the pivot.', 'Extend your legs until almost straight, squeeze, then lower slowly.', 'Do not swing the weight up.'],
  walking_lunge: ['Stand tall with dumbbells at your sides.', 'Step forward into a long stride, lower the back knee close to the floor, then step through.', 'The app logs both dumbbells combined.'],
  bw_squat: ['Stand with feet shoulder width apart, arms in front for balance.', 'Sit between your hips until your thighs are parallel, then stand tall.', 'Keep your heels on the floor.'],
  rdl: ['Stand with the bar at your hips, feet hip width, soft knees.', 'Push your hips back, sliding the bar down your thighs until you feel a hamstring stretch, then stand tall.', 'Your spine stays flat and the bar never leaves your legs.'],
  db_rdl: ['Stand with a dumbbell in each hand in front of your thighs, soft knees.', 'Push your hips back, lower the dumbbells along your legs to a hamstring stretch, then stand tall.', 'The app logs both dumbbells combined.'],
  leg_curl: ['Adjust the pad just above your heels and pin your hips down.', 'Curl your heels toward your glutes, squeeze, and lower slowly.', 'Do not let your hips lift off the pad.'],
  bb_hip_thrust: ['Sit with your upper back against a bench and the bar over your hips (use a pad).', 'Drive through your heels until your hips are fully extended, squeeze, then lower.', 'Tuck your chin and keep your ribs down so the work stays in your glutes.'],
  glute_bridge: ['Lie on your back with knees bent and feet flat.', 'Drive through your heels and lift your hips until your body forms a straight line, squeeze, then lower.', 'Tilt your pelvis back at the top to avoid arching your lower back.'],
  standing_calf_raise: ['Place the balls of your feet on the platform with your heels hanging off.', 'Lower your heels for a full stretch, then rise as high as you can and pause at the top.', 'Slow reps with a pause beat bouncing.'],
  db_calf_raise: ['Stand on a step with the balls of your feet on the edge, dumbbells at your sides.', 'Lower your heels for a stretch, then rise as high as you can and hold the top.', 'The app logs both dumbbells combined.'],
  bw_calf_raise: ['Stand on one foot on a step with your heel hanging off, hand on a wall for balance.', 'Lower for a full stretch, then rise as high as you can.', 'Switch legs after each set.'],
  bb_curl: ['Stand tall with an underhand grip, elbows pinned at your sides.', 'Curl the bar up to shoulder height, squeeze, and lower slowly.', 'No swinging. If you need momentum, the weight is too heavy.'],
  incline_curl: ['Lie back on a 45-degree bench with your arms hanging straight down.', 'Curl both dumbbells up without moving your upper arms, then lower to a deep stretch.', 'The app logs both dumbbells combined.'],
  hammer_curl: ['Stand with dumbbells at your sides, palms facing in.', 'Curl up keeping your palms facing in and your elbows still, then lower slowly.', 'The app logs both dumbbells combined.'],
  cable_curl: ['Stand facing a low pulley with a straight or EZ bar.', 'Curl up with your elbows pinned, squeeze, and lower under control.', 'The cable keeps tension at the bottom.'],
  cgbp: ['Lie on a bench and grip the bar about shoulder width.', 'Lower to your lower chest with elbows tucked, then press up.', 'Gripping too narrow stresses your wrists, so stay near shoulder width.'],
  skullcrusher: ['Lie on a bench holding the bar over your chest with straight arms.', 'Bend only at the elbows to lower the bar toward your forehead, then extend.', 'Keep your upper arms still and pointed at the ceiling.'],
  tri_pushdown: ['Stand at a high pulley with elbows pinned to your sides.', 'Push down until your arms are fully straight, squeeze, and return slowly.', 'Do not lean over the bar to cheat the weight.'],
  oh_tri_ext: ['Hold one dumbbell overhead with both hands and elbows pointing forward.', 'Lower the dumbbell behind your head, then extend your arms back up.', 'Keep your elbows from flaring out.'],
  ab_rollout: ['Kneel with the barbell in front of you, hands shoulder width, pelvis tucked.', 'Roll forward as far as you can while keeping your pelvis tucked, then pull back with your abs.', 'Stop before your lower back sags.'],
  hanging_leg_raise: ['Hang from a bar with a firm grip and shoulders engaged.', 'Curl your pelvis up as you raise your legs, then lower slowly.', 'Do not swing. Control the descent.'],
  cable_crunch: ['Kneel under a high pulley holding the rope beside your head.', 'Round your spine and bring your elbows toward your knees, then return slowly.', 'The movement is spinal flexion, not hip hinging.'],
  crunch: ['Lie on your back with knees bent and hands beside your head.', 'Curl your ribs toward your hips, pause, and lower slowly.', 'Do not pull on your neck.'],
  decline_bb_bench: ["Set a decline bench (about 15 to 30 degrees), hook your legs under the pads and pinch your shoulder blades together before unracking.", "Lower the bar to your lower chest, then press it back up over your shoulders.", "Use a spotter or safety arms. Getting stuck on a decline is harder to escape."],
  decline_db_press: ["Lie on a decline bench with your feet locked in and the dumbbells at your lower chest. Have them handed to you if they are heavy.", "Press up and slightly in until your arms are straight, then lower slowly to a stretch.", "The app logs both dumbbells combined."],
  db_chest_fly: ["Lie on a flat bench with a dumbbell in each hand over your chest, palms facing each other and a slight bend in your elbows.", "Open your arms in a wide arc until you feel a deep chest stretch, then bring the dumbbells back together.", "Keep the elbow bend the same the whole way and go lighter than a press. The app logs both dumbbells combined."],
  low_high_cable_fly: ["Set both pulleys low and stand in the middle with a staggered stance and a slight forward lean.", "Sweep your hands up and together to about chin height, squeeze your upper chest, then lower slowly.", "Keep a soft elbow bend and do not shrug. This is not a front raise."],
  high_low_cable_fly: ["Set both pulleys high and stand in the middle with a staggered stance, leaning slightly forward.", "Sweep your hands down and together toward your hips, squeezing your lower chest, then return slowly.", "Keep your elbows softly bent and your ribs down."],
  floor_press: ["Lie on the floor with your knees bent. Set the bar on low rack pins or lift it into position, with your upper arms ready to rest on the floor.", "Lower until your triceps touch the floor, pause for a second, then press up.", "The floor limits your range, which is easy on the shoulders. Do not bounce off the floor."],
  landmine_chest_press: ["Wedge one end of the barbell in a corner or landmine base and hold the other end at your chest with both hands.", "Press up and forward until your arms are straight, then lower with control.", "Keep your feet planted and your ribs down. Log the weight you load on the bar."],
  tbar_row: ["Wedge one end of the barbell in a corner or landmine base, straddle it and take hold of the bar or a close-grip handle. Hinge to about 45 degrees with a flat back.", "Row the bar toward your lower chest, squeeze your shoulder blades, then lower with control.", "Do not jerk with your hips. Keep your spine flat and log the weight you load on the bar."],
  cs_db_row: ["Lie face down on a bench set to about 30 degrees with a dumbbell in each hand hanging below you.", "Row both dumbbells toward your hips, squeeze your shoulder blades, then lower to a full stretch.", "The bench removes momentum, so it is a strict back builder. The app logs both dumbbells combined."],
  straight_arm_pulldown: ["Stand facing a high pulley with a bar or rope in your hands and your arms straight, hinged slightly at the hips.", "Keeping your arms straight, sweep the handle down to your thighs by squeezing your lats, then let it rise slowly.", "The movement comes from your shoulders, not your elbows. Do not bend your arms."],
  meadows_row: ["Wedge one end of a barbell in a corner or landmine base and stand side-on to it, holding the thick end near the plates with one hand.", "Hinge forward, row the bar toward your hip and squeeze your upper back, then lower to a stretch.", "Log the weight loaded on the bar. Do the same reps on each side."],
  rack_pull: ["Set the bar on pins at about knee height. Stand close with a hip-width stance, grip just outside your legs, chest up and back flat.", "Brace and stand up, driving your hips forward until you are fully upright, then lower under control.", "You can lift more than from the floor, so keep your back flat and use straps if your grip fails first."],
  inverted_row: ["Set a bar at about waist height in a rack (or lie under a sturdy table) and hang below it with your body in a straight line and your heels on the floor.", "Pull your chest to the bar by squeezing your shoulder blades together, then lower to straight arms.", "Walk your feet forward to make it harder. The weight field is extra load only (vest or plate)."],
  bb_shrug: ["Stand holding a barbell in front of your thighs with your hands just outside your hips.", "Lift your shoulders straight up toward your ears, pause at the top, then lower slowly.", "Do not roll your shoulders. Straps help if your grip gives out before your traps do."],
  db_shrug: ["Stand holding a dumbbell in each hand at your sides.", "Lift your shoulders straight up, pause for a second at the top, and lower slowly.", "Keep your arms straight and your head neutral. The app logs both dumbbells combined."],
  cable_upright_row: ["Stand facing a low pulley with a bar or rope held at your thighs, hands about shoulder width apart.", "Pull the handle up the front of your body to chest height, leading with your elbows, then lower under control.", "Stop at chest height. If your shoulders pinch, use a wider grip or a shorter range."],
  db_front_raise: ["Stand tall with a dumbbell in each hand in front of your thighs.", "Raise your arms straight in front of you to shoulder height, then lower slowly.", "No swinging or leaning back. The app logs both dumbbells combined."],
  arnold_press: ["Sit with back support and hold the dumbbells at chest height with your palms facing you.", "Press up while rotating your palms to face forward, finish with your arms nearly straight, then reverse the motion on the way down.", "Use a lighter weight than a regular press. The app logs both dumbbells combined."],
  cable_y_raise: ["Set the pulleys low and stand with a handle in each hand, arms crossed in front of your thighs.", "Raise your arms up and out into a Y shape to about ear height with your thumbs up, then lower slowly.", "Go light and keep your ribs down. Think rear and side shoulders, not upper traps."],
  cable_egyptian_raise: ["Stand beside a low pulley with the cable running behind your back. Take the handle with your far hand and hold a post with the other to lean slightly away.", "Raise your arm out to the side to just above shoulder height, then lower slowly.", "Leaning away keeps tension on the side delt at the bottom. Log the weight of one side."],
  bb_upright_row: ["Stand holding a barbell in front of your thighs with a grip about shoulder width.", "Pull the bar up to chest height, leading with your elbows, then lower under control.", "Keep the bar close and stop at chest height. A wider grip is easier on the shoulders."],
  face_pull_press: ["Set a rope at upper-chest height and step back until the cable is tight.", "Pull the rope toward your face with the ends apart, rotate your hands up, then press overhead. Reverse the motion back to the start.", "Use light weight and slow reps. Keep your ribs down as you press."],
  bench_dips: ["Sit on the edge of a bench with your hands beside your hips, then slide forward with your legs out in front.", "Lower until your elbows are about 90 degrees, then press back up.", "If your shoulders feel pinched, bend your knees or shorten the range. The weight field is extra load only."],
  db_skullcrusher: ["Lie on a bench with a dumbbell in each hand, arms straight over your chest and palms facing each other.", "Bend only at the elbows to lower the dumbbells beside your head, then extend again.", "Keep your upper arms still. The app logs both dumbbells combined."],
  oh_cable_tri_ext: ["Set a rope on a low or mid pulley, face away from the stack and hold the rope behind your head with your elbows pointing forward.", "Extend your arms overhead until they are straight, then lower slowly to a stretch.", "Keep your elbows from flaring out and your ribs down."],
  jm_press: ["Lie on a bench and grip the bar just inside shoulder width, with the bar over your upper chest.", "Lower the bar toward your upper chest and chin by letting your elbows travel forward, halfway between a skullcrusher and a close-grip bench, then press up.", "It is a technical lift. Start light and use a spotter or safety arms."],
  tate_press: ["Lie on a bench with the dumbbells held over your chest, elbows flared out to the sides.", "Bend at the elbows to lower the dumbbells toward your chest, then extend them back up.", "Keep the weight light and your upper arms steady. The app logs both dumbbells combined."],
  single_arm_cable_curl: ["Stand facing a low pulley with a single handle in one hand.", "Curl up with your elbow pinned to your side, squeeze at the top, then lower slowly.", "Do the same reps on each arm. Log the weight of one side."],
  reverse_bb_curl: ["Stand holding a barbell with an overhand grip, hands shoulder width apart.", "Curl the bar up with your elbows pinned to your sides, then lower slowly.", "This works your forearms and the brachialis. Go lighter than a regular curl and keep your wrists straight."],
  preacher_curl: ["Set up on a preacher bench so your upper arms rest flat on the pad, and hold the bar with an underhand grip. No preacher pad? Rest your upper arm on the top of an incline bench and curl one arm at a time.", "Curl up, squeeze, then lower to nearly straight arms.", "Do not drop at the bottom, which stresses the elbow. Stop just short of locking out."],
  incline_hammer_curl: ["Lie back on a bench set to about 45 to 60 degrees with the dumbbells hanging at your sides, palms facing in.", "Curl up keeping your palms facing in and your upper arms still, then lower to a full stretch.", "Works the biceps and brachialis (forearm). The app logs both dumbbells combined."],
  bayesian_curl: ["Set a low pulley and face away from it, holding a single handle behind you with your arm extended back.", "Curl the handle forward, keeping your upper arm behind your torso, squeeze at the top, then lower slowly.", "The stretch is the point, so keep your arm behind you. Log the weight of one side."],
  spider_curl: ["Lie chest-down on a bench set to about 45 degrees with the dumbbells hanging straight down, palms forward.", "Curl up, squeeze, and lower to a full stretch without swinging.", "Your chest stays on the pad. The app logs both dumbbells combined."],
  farmers_walk: ["Pick up a heavy dumbbell in each hand, stand tall with your shoulders back and your ribs down.", "Walk about 20 yards with quick, controlled steps, then turn around. Each rep in the app is one trip.", "Do not lean or let the weights swing. Log both dumbbells combined. The app does not suggest a weight for this one, so pick one you can carry with good posture."],
  box_squat: ["Set a box or bench at a height where your thighs are about parallel when seated. Bar on your upper back, feet slightly wider than shoulders.", "Sit back and down until you touch the box with control, pause briefly, then drive up.", "Do not rock or collapse onto the box. Stay braced the whole time."],
  zercher_squat: ["Hold the bar in the crooks of your elbows against your upper stomach with your arms crossed. Use a pad if it digs in.", "Sit down between your hips with your chest tall, then stand up.", "Keep your elbows pointing forward and your torso upright. Start light because the bar is uncomfortable until you are used to it."],
  hack_squat: ["Set your shoulders against the pads and your feet about shoulder width, mid-platform.", "Lower until your thighs are at least parallel, then drive up through your whole foot without locking your knees.", "Do not let your hips peel off the seat. A lower foot position hits the quads harder. A barbell hack squat (bar held behind your legs) works too, but start light."],
  heel_goblet_squat: ["Hold one dumbbell against your chest and stand with your heels on a small plate or wedge.", "Squat down between your hips keeping your chest tall and your knees forward, then stand.", "The raised heels let your knees travel forward to load the quads. Use a small, stable plate."],
  db_step_up: ["Stand facing a bench or box with a dumbbell in each hand at your sides. The box should put your thigh about parallel when your foot is on it.", "Step up with one foot, drive through that heel until you stand tall, then step down with control.", "Do all reps on one leg, then switch. Do not push off the back foot. The app logs both dumbbells combined."],
  sissy_squat: ["Stand near a wall or post for balance with your feet hip width apart.", "Rise onto your toes and lean back while bending your knees forward and lowering your hips, then come back up.", "This is a hard stretch for the knees. Go slowly, only as deep as is comfortable, and skip it if your knees hurt. Hold a plate to make it harder."],
  good_morning: ["Set the bar on your upper back as for a squat, with your feet shoulder width and your knees soft.", "Push your hips back and hinge forward until your torso is close to parallel, then drive your hips forward to stand.", "Keep your back flat and the weight light. Stop if your back starts to round."],
  seated_leg_curl: ["Adjust the pad above your heels and the seat so your knees line up with the pivot, then secure the thigh pad.", "Curl your heels down and back, squeeze, then let the weight rise slowly.", "Do not lift your hips off the seat."],
  nordic_curl: ["Kneel on a pad with your ankles secured under a bar, a heavy object, or a partner, and your body straight from knees to head.", "Lower yourself forward as slowly as you can with your hips extended, catch yourself with your hands, then push back up.", "Use a band for help at first and go slowly. It is very hard on the hamstrings, so build up the reps gradually."],
  sl_db_rdl: ["Stand on one leg holding dumbbells in front of you with a slight bend in the standing knee.", "Hinge at the hip, lowering the dumbbells while your free leg extends behind you, until you feel a hamstring stretch, then stand.", "Keep your hips square to the floor. Do the same reps on each side and log the total weight you hold."],
  ghr: ["Set up on the glute-ham raise station with your ankles secured and your hips just past the pad.", "Lower your torso toward the floor under control, then curl yourself back up by squeezing your hamstrings and glutes.", "Do not hyperextend at the top. Cross your arms on your chest, or hold a plate to make it harder."],
  cable_kickback: ["Attach an ankle strap to a low pulley, face the machine and hold on for balance.", "With your knee slightly bent, kick your leg straight back, squeeze your glute at the end, then return slowly.", "Do not arch your lower back. Log the weight of one side."],
  cable_pull_through: ["Set a rope on a low pulley and stand facing away from the stack, holding the rope between your legs.", "Push your hips back to hinge, letting the rope pass between your legs, then drive your hips forward and squeeze your glutes to stand.", "It is a hip hinge, not a squat. Keep your back flat and your arms straight."],
  deficit_reverse_lunge: ["Stand on a low step or a plate with dumbbells at your sides.", "Step one foot back and down off the step, lower your back knee close to the floor, then drive through the front heel to return.", "Keep your torso slightly forward and your front knee over your toes. The app logs both dumbbells combined."],
  db_sumo_squat: ["Stand with your feet wider than shoulders and your toes turned out, holding one dumbbell hanging between your legs.", "Sit straight down with your knees tracking over your toes, then stand and squeeze your glutes.", "Keep your chest tall. The app logs the weight of the dumbbell."],
  sl_hip_thrust: ["Sit with your upper back against a bench, one foot flat on the floor and the other leg extended or held in the air.", "Drive through your heel to lift your hips until your body forms a straight line, squeeze, then lower.", "Keep your ribs down and your hips level. Hold a dumbbell on your hips to make it harder. Do both sides."],
  curtsy_lunge: ["Stand holding dumbbells at your sides.", "Step one foot back and across behind your front leg, bending both knees, then stand back up.", "Keep your front knee tracking over your toes and your chest tall. The app logs both dumbbells combined."],
  seated_calf_raise: ["Sit at the machine with the pad on your lower thighs and the balls of your feet on the platform.", "Lower your heels for a deep stretch, then rise as high as you can and pause at the top.", "Slow reps and a full stretch matter more than the weight. The bent knee works the soleus."],
  donkey_calf_raise: ["Position yourself on a donkey calf raise machine, or hinge at the hips with your hips against the pad and the balls of your feet on the edge.", "Lower your heels for a full stretch, then rise as high as possible and pause.", "Keep your knees straight and your back flat. Slow, full-range reps."],
  tib_raise: ["Stand with your back against a wall and your feet about a foot ahead of you.", "Lift your toes toward your shins as high as you can, hold for a second, then lower slowly.", "Go slowly for higher reps. This works the muscle on the front of your lower leg."],
  bicycle_crunch: ["Lie on your back with your hands beside your head and your legs raised.", "Bring one elbow toward the opposite knee while extending the other leg, then switch sides in a pedaling motion.", "Move slowly and do not pull on your neck. Count each twist as one rep."],
  plank: ["Rest on your forearms and toes with your elbows under your shoulders and your body in a straight line.", "Squeeze your glutes and abs, tuck your pelvis slightly and breathe steadily.", "The app counts this in seconds. Type the seconds you held into the Reps box, and stop when your hips sag."],
  situp: ["Lie on your back with your knees bent and your feet flat (anchor them if needed), arms crossed on your chest.", "Curl up until your chest reaches your knees, then lower slowly.", "Do not yank on your neck. Control the way down."],
  side_plank: ["Lie on your side with your elbow under your shoulder and your legs stacked.", "Lift your hips so your body forms a straight line and hold.", "Type the seconds you held into the Reps box. Do the same on both sides."],
  pallof_press: ["Set a cable at chest height and stand sideways to it, holding the handle at your chest with both hands.", "Press your hands straight out in front of you and hold for a second without letting your torso rotate, then bring them back in.", "The cable tries to rotate you and your job is to resist it. Do the same reps on both sides."],
  captains_chair_raise: ["Rest your forearms on the pads with your back against the backrest and your legs hanging.", "Raise your knees (or straight legs for more challenge) to hip height while curling your pelvis up, then lower slowly.", "Do not swing. Curl your pelvis rather than only lifting your legs."],
  cable_woodchop: ["Set a pulley high (or low) and stand sideways to it, holding the handle with both hands.", "Rotate your torso and pull the handle diagonally across your body to the opposite hip (or shoulder), pivoting your back foot, then return under control.", "The power comes from your torso and hips, not your arms. Do the same reps on both sides."],
  russian_twist: ["Sit with your knees bent and your torso leaned back about 45 degrees, holding a dumbbell with both hands at your chest.", "Rotate your torso to tap the weight beside one hip, then to the other side.", "Keep your chest up and your back from rounding. Lift your feet for more challenge. Count each side as one rep."],
  dragon_flag: ["Lie on a bench and grip it behind your head. Lift your hips and legs until you are balanced on your upper back.", "Keeping your body straight, lower slowly until your legs are just above the bench, then bring them back up (or do the lowering part only).", "This is very hard. Bend your knees to make it easier, and stop if you feel it in your neck or lower back."],
  decline_situp: ["Hook your feet under the pads of a decline bench and hold a plate or dumbbell against your chest.", "Curl up until your chest reaches your knees, then lower slowly.", "Do not pull on your neck. Start with no weight if the decline is new to you."],
  cardio_run: ['Start with a few minutes of easy jogging or walking.', 'Hold a conversational pace, or alternate hard and easy efforts for intervals.', 'Build distance gradually to protect your joints.'],
  cardio_walk: ['Walk at a brisk pace and swing your arms.', 'Add incline on a treadmill to raise the effort.', 'Easy to do on rest days.'],
  cardio_bike: ['Adjust the seat so your knee has a slight bend at the bottom of the pedal stroke.', 'Hold a smooth cadence around 80 to 100 rpm.', 'Raise resistance for harder efforts.'],
  cardio_row: ['Sit with your feet strapped in, shins vertical, arms straight.', 'Drive with your legs first, then lean back and pull the handle to your ribs. Reverse on the way back.', 'Legs, hips, arms on the way out. Arms, hips, legs on the way back.'],
  cardio_rope: ['Hold the handles at hip height with elbows close to your sides.', 'Turn the rope with your wrists and make small, light hops.', 'Land softly on the balls of your feet.'],
  cardio_stairs: ['Stand tall and step steadily.', 'Keep a light touch on the rails for balance only.', 'Do not lean your weight on the rails.'],
  cardio_elliptical: ['Stand tall with a light grip on the handles.', 'Use smooth, full strides at a steady pace.', 'Change resistance or direction for variety.'],
  cardio_swim: ['Breathe steadily and keep a relaxed kick.', 'Alternate easy and faster laps if you like.', 'Rest between laps as needed.'],
  cardio_hiit: ['Pick four to six bodyweight moves such as burpees, mountain climbers and jumps.', 'Work 30 seconds, rest 30 seconds, and cycle through the list.', 'Quality over speed. Stop if your form falls apart.']
};
let lib = { q: '', f: 'all' };
A.libOpen = () => {
  lib = { q: '', f: 'all' };
  openSheet('Exercise library', `<div class="col"><input id="lib-q" type="search" placeholder="Search exercises…" data-f="libq" autocomplete="off">
    <div class="chips scrollx" id="lib-f"></div><div id="lib-list" class="col gap6"></div></div>`); paintLib();
};
function paintLib() {
  const fs = [['all', 'All'], ...CHIPS_EXTRA, ...MUSCLES.map(m => [m, m]), ['Cardio', 'Cardio']];
  $('#lib-f').innerHTML = fs.map(([k, l]) => `<button class="chip ${lib.f === k ? 'on' : ''}" data-a="libF" data-v="${k}">${l}</button>`).join('');
  const q = lib.q.trim().toLowerCase();
  let list = allEx(); if (lib.f !== 'all') list = byChip(list, lib.f);
  if (q) list = list.filter(e => (e.name + ' ' + e.primary + ' ' + (e.alias || '')).toLowerCase().includes(q));
  list.sort((a, b) => a.name.localeCompare(b.name));
  $('#lib-list').innerHTML = list.slice(0, 400).map(e => `<button class="prow" data-a="exInfo" data-id="${e.id}" data-from="lib"><div class="grow"><b>${isFav(e.id) ? '★ ' : ''}${esc(e.name)}</b><div class="mut xs">${esc(e.primary)}${(e.secondary || []).length ? ' + ' + esc(e.secondary.join(', ')) : ''}</div></div><span class="mut xs">${hasGear(e) ? '' : '🔒'}</span></button>`).join('') || '<div class="empty">No matches.</div>';
}
A.libF = el => { lib.f = el.dataset.v; paintLib(); };
F.libq = el => { lib.q = el.value; paintLib(); };
A.exInfo = el => {
  const ex = exById(el.dataset.id); if (!ex) return; const fromLib = el.dataset.from === 'lib';
  const steps = HOW[ex.id] || [ex.cue || 'Control the weight and use a full range of motion.'];
  const labels = ['Set up', 'Move', 'Watch for'], l = ex.cardio ? null : lastPerf(ex.id), pr = state.prs[ex.id];
  const q = encodeURIComponent(ex.name.replace(/\s*\((?:Total|Added Wt|Bars \/ Chairs|seconds)[^)]*\)/gi, '') + ' proper form');
  const missing = (ex.gear || []).filter(g => !state.gear[g]);
  openSheet(ex.name, `<div class="col">
    <div class="row gap6 wrap"><span class="tag or">${esc(ex.primary)}</span>${(ex.secondary || []).map(m => `<span class="tag">${esc(m)}</span>`).join('')}<span class="tag">${ex.cardio ? 'Cardio' : esc(ex.type)}</span></div>
    <p class="mut sm">${ex.gear.length ? 'Equipment: ' + esc(ex.gear.map(gearLabel).join(', ')) : 'No equipment needed'}${missing.length ? ` · <span class="am">you have ${esc(missing.map(gearLabel).join(', '))} switched off</span>` : ''}</p>
    <ol class="how">${steps.map((t, k) => `<li><b>${steps.length > 1 ? labels[k] || 'Tip' : 'Cue'}</b><span>${esc(t)}</span></li>`).join('')}</ol>
    ${ex.cardio ? '' : `<div class="prow static"><div class="grow"><b>Your numbers</b><div class="mut xs">${state.e1rm[ex.id] ? 'Estimated 1RM ' + state.e1rm[ex.id] + ' ' + unit() : 'No estimate yet'}${pr ? ' · best ' + Math.round(pr.weight) + ' × ' + pr.reps : ''}${l ? ' · last ' + l.slice(0, 4).map(s => s.w + '×' + s.r).join(', ') : ''}</div></div></div>`}
    ${exTools(ex)}
    <a class="btn sec full" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener noreferrer">▶ Watch form videos</a>
    <div class="grid2">${fromLib ? '<button class="btn sec" data-a="libOpen">‹ Library</button>' : '<button class="btn sec" data-a="closeSheet">Close</button>'}<button class="btn pri" data-a="libAdd" data-id="${ex.id}">＋ Add to workout</button></div></div>`);
};
A.libAdd = el => {
  const ex = exById(el.dataset.id); if (!ex) return;
  wk().items.push(buildItem(ex, { factor: 1 })); normSS(); scheduleSave(); closeSheet(); toast(ex.name + ' added');
  if (tab === 'workout') renderWorkout(); else go('workout');
};

/* ---------- bodyweight vs strength chart ---------- */
function multiChart(series) {
  const all = series.flatMap(s => s.pts); if (all.length < 2) return '';
  const w = 340, h = 190, pl = 40, pr = 12, pt = 12, pb = 22;
  let x0 = Math.min(...all.map(p => p.t)), x1 = Math.max(...all.map(p => p.t)); if (x0 === x1) { x0 -= DAY; x1 += DAY; }
  let y0 = Math.min(0, ...all.map(p => p.v)), y1 = Math.max(0, ...all.map(p => p.v)); const py = (y1 - y0) * .15 || 1; y0 -= py; y1 += py;
  const X = t => pl + (t - x0) / (x1 - x0) * (w - pl - pr), Y = v => pt + (1 - (v - y0) / (y1 - y0)) * (h - pt - pb);
  const fmt = v => (v > 0 ? '+' : '') + Math.round(v) + '%';
  const ticks = [y0 + py, 0, y1 - py].map(v => `<text x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${fmt(v)}</text><line x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}" ${v === 0 ? 'class="zero"' : ''}/>`).join('');
  const lines = series.map(s => s.pts.length ? `<path d="${s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ')}" class="ln ${s.cls}"/>${s.pts.map(p => `<circle class="${s.cls}" cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.6"/>`).join('')}` : '').join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Bodyweight and strength change over time"><g class="grid">${ticks}</g>${lines}
    <text class="xl" x="${pl}" y="${h - 5}">${fmtDate(x0)}</text><text class="xl" x="${w - pr}" y="${h - 5}" text-anchor="end">${fmtDate(x1)}</text></svg>
    <div class="legend">${series.map(s => `<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}
function bodyVsStrength() {
  const now = Date.now(), from = prog.range ? now - prog.range * DAY : 0, cvt = (v, u) => !u || u === unit() ? v : v * (unit() === 'kg' ? KG : 1 / KG);
  const bwp = state.measures.filter(m => +m.weight > 0 && m.t >= from).sort((a, b) => a.t - b.t).map(m => ({ t: m.t, v: cvt(+m.weight, m.unit) }));
  const lifts = Object.keys(state.e1rmHist).map(id => ({ id, ex: exById(id), pts: state.e1rmHist[id].filter(p => p.t >= from).sort((a, b) => a.t - b.t) })).filter(l => l.ex && !l.ex.bw && !l.ex.noE1 && l.pts.length >= 2);
  const head = '<div class="row sp"><h2 class="h2">Bodyweight vs strength</h2></div>';
  if (bwp.length < 2 || !lifts.length) return `<div class="card">${head}<div class="empty">${!lifts.length ? 'Log a few sessions with the same lifts to see your strength trend.' : 'Log your weight on at least two days in the Body tab to compare it with your strength.'}</div></div>`;
  const times = [...new Set(lifts.flatMap(l => l.pts.map(p => p.t)))].sort((a, b) => a - b), step = Math.max(1, Math.ceil(times.length / 60)), sample = times.filter((_, i) => i % step === 0 || i === times.length - 1);
  const idx = sample.map(t => {
    let sum = 0, n = 0; lifts.forEach(l => { let v = null; for (const p of l.pts) { if (p.t <= t) v = p.v; else break; } if (v != null) { sum += v / l.pts[0].v; n++; } });
    return n ? { t, v: (sum / n - 1) * 100 } : null;
  }).filter(Boolean);
  const b0 = bwp[0].v, bwLine = bwp.map(p => ({ t: p.t, v: (p.v / b0 - 1) * 100 }));
  const lastBw = bwp[bwp.length - 1].v, dBw = lastBw - b0, sGain = idx.length ? idx[idx.length - 1].v : 0;
  const sel = prog.ex && exById(prog.ex) && !exById(prog.ex).bw && state.e1rm[prog.ex] ? exById(prog.ex) : null, rel = sel ? (state.e1rm[sel.id] / lastBw).toFixed(2) : null;
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  return `<div class="card">${head}<p class="mut xs">Both lines show % change since the start of the range. Strength is the average across your logged lifts (estimated 1RM).</p>
    ${multiChart([{ name: 'Strength', cls: 'a', pts: idx }, { name: 'Bodyweight', cls: 'b', pts: bwLine }])}
    <div class="tiles pt8">${tile((dBw > 0 ? '+' : '') + (Math.round(dBw * 10) / 10) + ' ' + unit(), 'Bodyweight')}${tile((sGain > 0 ? '+' : '') + Math.round(sGain) + '%', 'Strength')}${rel ? tile(rel + '×', esc(sel.name.split(' ').slice(0, 2).join(' ')) + ' ÷ BW') : ''}</div></div>`;
}
