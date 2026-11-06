'use strict';
/* =====================================================================
   ForgeFit UI: sheets, toasts, workout generator, workout tab, recovery
   ===================================================================== */
const A = {}, F = {};           // click actions / field handlers
let tab = 'workout';
const SPLIT_NAME = { freshness: 'Freshness', push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower', full: 'Full Body' };
const R = {};                   // tab renderers

/* ---------- toast / sheet ---------- */
let toastT, toastFn = null;
function toast(msg, ms = 2600, act) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.toggle('act', !!act); toastFn = null;
  if (act) { const b = document.createElement('button'); b.type = 'button'; b.dataset.a = 'toastAct'; b.textContent = act.label; t.appendChild(b); toastFn = act.fn; }
  t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), act ? Math.max(ms, 6500) : ms);
}
A.toastAct = () => { const f = toastFn; toastFn = null; $('#toast').classList.remove('show'); if (f) f(); };
document.addEventListener('pointerdown', e => {       // an Undo offer expires as soon as you tap anywhere else, so it never sits over a button
  const t = $('#toast'); if (t && t.classList.contains('act') && t.classList.contains('show') && !t.contains(e.target)) t.classList.remove('show');
}, true);
let sheetClose = null;
function openSheet(title, html, o = {}) {
  if (sheetClose) { const f = sheetClose; sheetClose = null; try { f(); } catch (e) { } }
  $('#sheet-t').textContent = title; $('#sheet-b').innerHTML = html;
  const w = $('#sheet'); w.hidden = false; sheetClose = o.onClose || null;
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => w.classList.add('open'));
  $('#sheet-b').scrollTop = 0;
}
function sheetBody(html) { $('#sheet-b').innerHTML = html; }
function closeSheet() {
  const w = $('#sheet'); if (w.hidden) return;
  w.classList.remove('open'); w.hidden = true; document.body.classList.remove('noscroll');
  if (sheetClose) { const f = sheetClose; sheetClose = null; try { f(); } catch (e) { } }
}
function ask(title, label, val, cb, btn = 'Save') {
  openSheet(title, `<div class="col"><div class="field"><label>${esc(label)}</label><input id="ask-in" value="${esc(val || '')}" maxlength="60" autocomplete="off"></div><button class="btn pri" data-a="askOk">${esc(btn)}</button></div>`);
  window.__askCb = cb; setTimeout(() => { const i = $('#ask-in'); i && i.focus(); }, 250);
}
A.askOk = () => { const v = $('#ask-in').value.trim(); const cb = window.__askCb; if (!v) return; closeSheet(); cb && cb(v); };
A.closeSheet = closeSheet;

/* ---------- workout helpers ---------- */
const wk = () => state.workout;
const manualDeload = () => !!(state.deload && state.deload.until > Date.now());
const isDeload = () => manualDeload() || blockDeload();
function resolveSplit() {
  if (state.split !== 'auto') return state.split;
  const pref = state.profile.splitPref, seq = { ppl: ['push', 'pull', 'legs'], ul: ['upper', 'lower'], full: ['full'] }[pref];
  if (!seq) return 'freshness';
  const last = (state.history.find(h => h.split && h.items && h.items.length) || {}).split;
  const i = seq.indexOf(last); return seq[(i + 1) % seq.length];
}
function buildItem(ex, o = {}) {
  if (ex.cardio) return { id: uid(), exId: ex.id, cardio: true, min: o.min || ex.defaultMin || 20, dist: 0, done: false, sets: [], superset: null };
  const g = GOALS[state.profile.goal] || GOALS.muscle, comp = ex.type === 'compound', fixed = ex.bw !== undefined || ex.custom;
  const reps = o.reps || (fixed ? ex.reps : (comp ? g.cReps : g.iReps));
  const n = Math.max(1, o.sets || (fixed ? ex.sets : (comp ? g.cSets : g.iSets)));
  const rir = o.rir ?? clamp(g.rir + blockRirAdj(), 0, 4);
  const w = o.weight != null ? o.weight : recWeight(ex, reps, rir, o.factor || 1);
  const pf = o.weight == null && !o.reps ? prefillFrom(ex) : null, dlf = isDeload() ? .9 : 1;
  const sets = Array.from({ length: n }, (_, j) => {
    const b = pf && pf[Math.min(j, pf.length - 1)]; let sw = w, sr = reps;
    if (b) {
      sr = b.r > 0 ? b.r : reps;
      sw = (b.w > 0 || ex.noE1 || ex.bw !== undefined) ? b.w : w;
      if (dlf < 1 && sw > 0) sw = Math.max(inc(), rnd(sw * dlf));
    }
    return { weight: sw, reps: sr, rir, fail: false, done: false, type: 'work' };
  });
  return { id: uid(), exId: ex.id, superset: null, tempo: ex.tempo, trimmed: !pf && (o.factor || 1) < 1, sets };
}
/* last session's working sets for this lift (deload weeks skipped, so a light week never lowers the next one) */
function prefillFrom(ex) {
  if (state.settings.prefill === false || ex.cardio) return null;
  const l = lastPerf(ex.id, true); if (!l) return null;
  const w = l.filter(s => s.type === 'work'); return w.length ? w : null;
}
function normSS() {
  const it = wk().items, groups = {};
  it.forEach((x, i) => { if (x.superset) (groups[x.superset[0]] = groups[x.superset[0]] || []).push(i); });
  Object.entries(groups).forEach(([L, idx]) => {
    const ok = idx.length === 2 && idx[1] === idx[0] + 1 && it[idx[0]].superset === L + '1' && it[idx[1]].superset === L + '2';
    if (!ok) idx.forEach(i => it[i].superset = null);
  });
}
function generateWorkout(quiet) {
  updatePassiveRecovery();
  const p = state.profile, g = GOALS[p.goal] || GOALS.muscle, dl = isDeload(), sp = resolveSplit();
  let pool = allEx().filter(e => !e.cardio && !e.noGen && hasGear(e));
  if (sp === 'freshness') {
    const top = [...MUSCLES].sort((a, b) => state.muscles[b].recovery - state.muscles[a].recovery).slice(0, 4);
    pool = pool.filter(e => top.includes(e.primary));
  } else pool = pool.filter(e => e.split.includes(sp));
  const base = { startedAt: null, name: (SPLIT_NAME[sp] || 'Custom') + ' Session', split: sp, note: '', items: [] };
  if (!pool.length) { state.workout = carrySession(wk(), base); state.workout.note = 'No exercises match your equipment. Turn on gear in More → Equipment.'; scheduleSave(); renderWorkout(); return; }
  const recent = new Set(state.history.slice(0, 2).flatMap(h => (h.items || []).map(i => i.exId)));
  const scored = pool.map(ex => ({ ex, sc: rec(ex.primary) * .8 + Math.random() * 15 - (recent.has(ex.id) ? 12 : 0) + (ex.type === 'compound' ? 4 : 0) })).sort((a, b) => b.sc - a.sc);
  const maxEx = clamp(Math.round(p.sessionMin / 12), 3, 8) - (p.experience === 'beginner' ? 1 : 0);
  const sel = [], cnt = {};
  for (const cap of [1, 2]) for (const { ex } of scored) {
    if (sel.length >= maxEx) break;
    if (sel.includes(ex) || (cnt[ex.primary] || 0) >= cap) continue;
    sel.push(ex); cnt[ex.primary] = (cnt[ex.primary] || 0) + 1;
  }
  const rank = { compound: 0, bodyweight: 1, isolation: 2 };
  sel.sort((a, b) => rank[a.type] - rank[b.type]);
  const av = sel.reduce((a, e) => a + rec(e.primary), 0) / sel.length;
  let f = av < 55 ? .9 : av < 75 ? .95 : 1; if (dl) f *= .9;
  const items = sel.map(ex => {
    const comp = ex.type === 'compound', fixed = ex.bw !== undefined || ex.custom;
    let n = fixed ? ex.sets : (comp ? g.cSets : g.iSets);
    if (p.experience === 'beginner') n = Math.min(n, 3);
    if (dl) n = Math.max(2, Math.ceil(n * .6)); else if (av < 55) n = Math.max(2, n - 1);
    return buildItem(ex, { factor: f, sets: n, rir: clamp(g.rir + blockRirAdj() + (dl ? 1 : 0), 0, 4) });
  });
  if (p.cardio || p.goal === 'tone' || p.goal === 'fitness') {
    const lastC = new Set(state.history.slice(0, 3).flatMap(h => (h.cardio || []).map(c => c.exId)));
    const cp = CARDIO_EX.filter(hasGear), pick = cp.find(c => !lastC.has(c.id)) || cp[0];
    if (pick) items.push(buildItem(pick, { min: p.sessionMin >= 75 ? 20 : 12 }));
  }
  const strength = items.filter(i => !i.cardio), pre = strength.filter(i => prefillFrom(exById(i.exId))).length, bits = [], bi = blockInfo();
  if (dl) bits.push('Deload week');
  if (bi && !bi.done && !bi.deload) bits.push(`Block week ${bi.week} of ${bi.weeks}`);
  if (pre && pre === strength.length) bits.push('Pre-filled from your last session');
  else { if (pre) bits.push('Pre-filled from last session where you have history'); bits.push(f < 1 ? `weights trimmed ${Math.round((1 - f) * 100)}% for recovery` : 'calibrated to recovery & e1RM history'); }
  const note = bits.join(' · ');
  state.workout = carrySession(wk(), { ...base, items, note: note.charAt(0).toUpperCase() + note.slice(1) });
  scheduleSave(); if (!quiet) renderWorkout();
}
const doneSetCount = () => wk().items.reduce((a, it) => a + (it.cardio ? (it.done ? 1 : 0) : it.sets.filter(s => s.done).length), 0);
function sessionVolume() {
  let v = 0; wk().items.forEach(it => { const ex = exById(it.exId); if (!ex || it.cardio) return; it.sets.forEach(s => { if (s.done && s.type !== 'warmup') v += loadOf(ex, s) * (+s.reps || 0); }); });
  return Math.round(v);
}
function convSets(sets, u) {          // history saved in the other unit is converted on the fly
  if (!u || u === unit()) return sets;
  const f = unit() === 'kg' ? KG : 1 / KG, st = inc();
  return sets.map(s => ({ ...s, w: s.w ? Math.max(st, Math.round(s.w * f / st) * st) : 0 }));
}
function lastPerf(id, skipDeload) {
  for (const h of state.history) {
    if (skipDeload && h.deload) continue;
    const it = (h.items || []).find(x => x.exId === id);
    if (it) { const w = it.sets.filter(s => s.type !== 'warmup'); if (w.length) return convSets(w, h.unit); }
  }
  return null;
}
const lastLine = id => { const l = lastPerf(id); return l ? l.slice(0, 4).map(s => `${s.w}×${s.r}`).join(' · ') : ''; };

/* ---------- workout tab ---------- */
function rirOpts(sel) {
  const rpe = state.settings.rpe;
  const L = rpe ? { F: 'RPE 10 F', 0: 'RPE 10', 1: 'RPE 9', 2: 'RPE 8', 3: 'RPE 7', 4: 'RPE 6' } : { F: 'Fail', 0: '0 RIR', 1: '1 RIR', 2: '2 RIR', 3: '3 RIR', 4: '4 RIR' };
  return ['F', 0, 1, 2, 3, 4].map(v => `<option value="${v}" ${String(sel) === String(v) ? 'selected' : ''}>${L[v]}</option>`).join('');
}
function cardHtml(i) {
  const it = wk().items[i], ex = exById(it.exId);
  if (!ex) return '';
  if (!sessActive() && !planOpen.has(it.id || i)) return planRowHtml(i);
  const ss = it.superset ? `<span class="tag vi">${it.superset}</span>` : '';
  if (it.cardio) {
    return `<article class="card ex" data-ex="${i}"><div class="row sp top gap6"><button class="grip" data-drag aria-label="Drag to reorder" title="Hold and drag to reorder"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button><div class="grow"><div class="row gap6"><span class="tag">Cardio</span>${ss}</div><h3 class="exn">${esc(ex.name)}</h3><div class="mut sm">${esc(ex.cue || '')}</div></div>
      <div class="row gap6">${planCollapse(i)}<button class="ib" data-a="exMenu" data-i="${i}" aria-label="Exercise options">⋯</button></div></div>
      <div class="grid2 pt8"><div class="field"><label>Minutes</label><input inputmode="decimal" value="${it.min || ''}" data-f="cardio" data-k="min" data-i="${i}"></div>
      ${ex.dist ? `<div class="field"><label>Distance (${unit() === 'kg' ? 'km' : 'mi'})</label><input inputmode="decimal" value="${it.dist || ''}" data-f="cardio" data-k="dist" data-i="${i}" placeholder="optional"></div>` : '<div></div>'}</div>
      <button class="btn ${it.done ? 'ok' : 'sec'} full mt8" data-a="cardioDone" data-i="${i}">${it.done ? '✓ Completed' : 'Mark complete'}</button></article>`;
  }
  const pct = rec(ex.primary), bc = pct >= 80 ? 'gr' : pct >= 55 ? 'am' : 'rd', last = lastPerf(ex.id);
  let wn = 0;
  const rows = it.sets.map((s, j) => {
    const lbl = s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : ++wn;
    const ph = last && last[Math.min(j, last.length - 1)];
    return `<div class="swrap"><div class="swbg"><span>⧉ Duplicate</span><span>Delete ✕</span></div><div class="srow ${s.done ? 'done' : ''} ${s.type}">
      <button class="snum t-${s.type}" data-a="setMenu" data-i="${i}" data-j="${j}" aria-label="Set options">${lbl}</button>
      <input inputmode="decimal" value="${s.weight}" placeholder="${ph ? ph.w : ''}" data-f="set" data-k="weight" data-i="${i}" data-j="${j}" aria-label="Weight">
      <input inputmode="numeric" value="${s.reps}" placeholder="${ph ? ph.r : ''}" data-f="set" data-k="reps" data-i="${i}" data-j="${j}" aria-label="Reps">
      <select data-f="set" data-k="rir" data-i="${i}" data-j="${j}" aria-label="Effort">${rirOpts(s.fail ? 'F' : s.rir)}</select>
      <button class="chk ${s.done ? 'on' : ''}" data-a="toggleSet" data-i="${i}" data-j="${j}" aria-label="Log set">${s.done ? '✓' : ''}</button></div></div>`;
  }).join('');
  const hint = progressHint(ex, it), fat = hint ? null : fatigueHint(ex, it);
  const coach = hint ? `<button class="coach up" data-a="bump" data-i="${i}"><b>↑</b> ${esc(hint.msg)}</button>` : fat ? `<button class="coach dn" data-a="trim" data-i="${i}"><b>↓</b> ${esc(fat.msg)}</button>` : '';
  const canWarm = state.settings.warmups && ex.type === 'compound' && !ex.noE1 && !ex.bw && !it.sets.some(s => s.type === 'warmup');
  return `<article class="card ex" data-ex="${i}">
    <div class="row sp top gap6"><button class="grip" data-drag aria-label="Drag to reorder" title="Hold and drag to reorder"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button><div class="grow"><div class="row gap6 wrap"><span class="tag ${bc}">${esc(ex.primary)} ${pct}%</span><span class="mut xs">e1RM <b>${ex.noE1 ? '—' : state.e1rm[ex.id] + ' ' + unit()}</b></span>${stalledTag(ex)}${ss}</div>
      <h3 class="exn">${esc(ex.name)}</h3>${last ? `<div class="mut xs">Last: ${last.slice(0, 4).map(s => `${s.w}×${s.r}`).join(' · ')}</div>` : ''}${noteLine(ex.id)}</div>
      <div class="row gap6">${planCollapse(i)}<button class="ib" data-a="swap" data-i="${i}" aria-label="Swap exercise">⇄</button><button class="ib" data-a="exMenu" data-i="${i}" aria-label="Exercise options">⋯</button></div></div>
    ${coach}
    <div class="shead"><span>Set</span><span>${unit()}</span><span>Reps</span><span>${state.settings.rpe ? 'RPE' : 'RIR'}</span><span></span></div>
    <div class="sets">${rows}</div>
    <div class="row gap6 wrap pt8">
      <button class="mini" data-a="addSet" data-i="${i}">＋ Set</button><button class="mini" data-a="addDrop" data-i="${i}">↘ Drop set</button>
      ${canWarm ? `<button class="mini" data-a="warmup" data-i="${i}">🔥 Warm-up</button>` : ''}
      <button class="mini" data-a="tempo" data-i="${i}">🎵 Tempo ${esc(it.tempo || ex.tempo)}</button>
      ${ex.gear.includes('Barbell') ? `<button class="mini" data-a="plates" data-i="${i}">⚖ Plates</button>` : ''}</div>
    <details class="cue"><summary>Form cue</summary><p>${esc(ex.cue || 'Control the weight, full range of motion.')}</p></details></article>`;
}
function coachBanner() {
  const adv = deloadAdvice();
  if (adv.level === 'none') return '';
  const act = adv.level === 'active' ? `<button class="mini" data-a="endDeload">End deload</button>` : `<button class="mini pri" data-a="startDeload">Start deload week</button>`;
  const cls = adv.level === 'deload' ? 'warn' : adv.level === 'active' ? 'info' : 'note';
  const title = adv.level === 'active' ? 'Deload week active' : adv.level === 'deload' ? 'Smart deload suggested' : 'Keep an eye on fatigue';
  return `<div class="banner ${cls}"><div class="grow"><b>${title}</b><ul>${adv.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>${act}</div>`;
}
function renderWorkout() {
  const w = wk(), tabEl = $('#tab-workout');
  const splits = [['auto', 'Smart'], ['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs'], ['upper', 'Upper'], ['lower', 'Lower'], ['full', 'Full']];
  const sp = resolveSplit(), live = sessActive();
  const list = `<div id="exlist" class="col${sessPaused() ? ' dimmed' : ''}">${w.items.map((_, i) => cardHtml(i)).join('') || emptyWorkout()}</div>
    <div class="row gap6"><button class="btn sec grow" data-a="addEx">＋ Add exercise</button><button class="btn sec grow" data-a="addCardio">🏃 Add cardio</button></div>`;
  if (live) {
    tabEl.innerHTML = `${sessHeader()}${list}
    <button class="btn danger full big" data-a="endWorkout">■ End workout</button>`;
  } else {
    tabEl.innerHTML = `
    ${topBanners()}
    ${weekCard()}
    <div class="card"><div class="row sp"><span class="lbl">Training split</span><span class="tag gr">${state.split === 'auto' ? 'Smart: ' + esc(SPLIT_NAME[sp] || '') : esc(SPLIT_NAME[state.split])}</span></div>
      <div class="chips scrollx">${splits.map(([k, l]) => `<button class="chip ${state.split === k ? 'on' : ''}" data-a="split" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="row gap6 pt8"><button class="btn vio grow" data-a="autoSuper">🔗 Auto-pair supersets</button><button class="btn pri grow" data-a="regen">⚡ Regenerate</button></div>
      <div class="row gap6 pt8"><button class="btn sec grow" data-a="nl">💬 Quick log</button><button class="btn sec grow" data-a="tplOpen">📋 Templates</button></div>
      <div class="row gap6 pt8"><button class="btn sec grow" data-a="repeatLast">↻ Repeat last workout</button><button class="btn sec grow" data-a="planOpen">📅 Plan</button></div></div>
    <div class="row sp px4"><div><h2 class="h2">${esc(w.name)}</h2><p class="mut sm">${esc(w.note || '')}</p></div><div class="right">${planSummary()}</div></div>
    ${w.items.length ? '<button class="btn ok full big" data-a="startWorkout">▶ Start workout</button>' : ''}
    ${list}
    ${w.items.length ? '<button class="btn ok full big" data-a="startWorkout">▶ Start workout</button>' : ''}`;
  }
  paintClock(); tickSess();
}
R.workout = renderWorkout;
function refreshCard(i) {
  const el = $(`#exlist [data-ex="${i}"]`); if (!el) return renderWorkout();
  const t = document.createElement('div'); t.innerHTML = cardHtml(i);
  const open = el.querySelector('details') && el.querySelector('details').open;
  el.replaceWith(t.firstElementChild);
  if (open) { const d = $(`#exlist [data-ex="${i}"] details`); if (d) d.open = true; }
  paintSessStats();
}
function paintClock() {
  const c = $('#clock'); if (!sessActive()) { c.hidden = true; return; }
  c.hidden = false; c.textContent = (sessPaused() ? '⏸ ' : '⏱ ') + fmtClock(sessMs());
}

/* ---------- workout actions ---------- */
A.split = el => { if (doneSetCount() && !confirm('Changing split will replace your current session. Continue?')) return; state.split = el.dataset.v; A.regenForce(); };
A.regenForce = () => { wk().items.forEach(it => (it.sets || []).forEach(s => { if (s.done) { const ex = exById(it.exId); if (ex) undoSet(it, s, ex); } })); generateWorkout(); };
A.tadj = el => adjustTimer(+el.dataset.n);
A.tskip = () => { stopRestTimerQuiet(); LiveActivity.sync(); scheduleSave(); };
A.regen = () => { if (doneSetCount() && !confirm('Regenerate and discard logged sets?')) return; if (doneSetCount()) wk().items.forEach(it => (it.sets || []).forEach(s => { if (s.done) { const ex = exById(it.exId); if (ex) undoSet(it, s, ex); } })); generateWorkout(); };
A.toggleSet = el => {
  const i = +el.dataset.i, j = +el.dataset.j, it = wk().items[i], s = it.sets[j], ex = exById(it.exId), wasLive = sessActive();
  if (!s.done) {
    if (!(+s.reps > 0)) { toast('Enter reps first'); return; }
    audio();
    const pr = applySetDone(it, s, ex);
    ensureStarted();
    buzz('set'); cue('set');
    const g = GOALS[state.profile.goal] || GOALS.muscle, st = state.settings;
    const trans = it.superset && it.superset.endsWith('1');
    let rest = trans ? 30 : s.type === 'warmup' ? 45 : s.type === 'drop' ? 15 : (ex.type === 'compound' ? (st.restC || g.restC) : (st.restI || g.restI));
    startTimer(rest, trans ? `Superset ${it.superset} → next` : `Rest · ${ex.name}`);
    if (pr) showPR(pr);
  } else undoSet(it, s, ex);
  scheduleSave(); if (!wasLive && sessActive()) renderWorkout(); else refreshCard(i);
  if (s.done) { const r = document.querySelectorAll(`#exlist [data-ex="${i}"] .srow`)[j]; if (r) { r.classList.add('pop'); setTimeout(() => r.classList.remove('pop'), 800); } }
};
F.set = el => {
  const i = +el.dataset.i, j = +el.dataset.j, k = el.dataset.k, s = wk().items[i] && wk().items[i].sets[j]; if (!s) return;
  if (k === 'rir') { if (el.value === 'F') { s.fail = true; s.rir = 0; } else { s.fail = false; s.rir = +el.value; } }
  else s[k] = el.value === '' ? 0 : Math.max(0, Number(String(el.value).replace(',', '.')) || 0);
  scheduleSave(); paintSessStats();
};
F.cardio = el => { const it = wk().items[+el.dataset.i]; if (it) { it[el.dataset.k] = Math.max(0, Number(String(el.value).replace(',', '.')) || 0); scheduleSave(); } };
A.cardioDone = el => { const i = +el.dataset.i, it = wk().items[i], wasLive = sessActive(); it.done = !it.done; if (it.done) ensureStarted(); buzz('set'); cue('set'); scheduleSave(); if (!wasLive && sessActive()) renderWorkout(); else refreshCard(i); };
A.addSet = el => {
  const i = +el.dataset.i, it = wk().items[i], last = [...it.sets].reverse().find(s => s.type === 'work') || it.sets[it.sets.length - 1] || { weight: 0, reps: 10, rir: 2 };
  it.sets.push({ weight: last.weight, reps: last.reps, rir: last.rir ?? 2, fail: false, done: false, type: 'work' }); scheduleSave(); refreshCard(i);
};
A.addDrop = el => {
  const i = +el.dataset.i, it = wk().items[i], ex = exById(it.exId), last = it.sets[it.sets.length - 1] || { weight: 0, reps: 10 };
  const w = ex.noE1 && !last.weight ? 0 : Math.max(0, rnd((+last.weight || 0) * .8));
  it.sets.push({ weight: w, reps: (+last.reps || 8) + 2, rir: 0, fail: false, done: false, type: 'drop' }); scheduleSave(); refreshCard(i); toast('Drop set added (−20%)');
};
A.setMenu = el => {
  const i = +el.dataset.i, j = +el.dataset.j, s = wk().items[i].sets[j], n = wk().items[i].sets.length;
  const tp = (t, l) => `<button class="chip ${s.type === t ? 'on' : ''}" data-a="setType" data-i="${i}" data-j="${j}" data-v="${t}">${l}</button>`;
  openSheet(`Set ${j + 1}`, `<div class="col"><div class="chips">${tp('work', 'Working')}${tp('warmup', 'Warm-up')}${tp('drop', 'Drop set')}</div>
    <button class="btn ${s.fail ? 'ok' : 'sec'} full" data-a="setFail" data-i="${i}" data-j="${j}">${s.fail ? '✓ Taken to failure' : 'Mark as failure set'}</button>
    <div class="grid2"><button class="btn sec" data-a="setMove" data-i="${i}" data-j="${j}" data-d="-1" ${j === 0 ? 'disabled' : ''}>↑ Move up</button><button class="btn sec" data-a="setMove" data-i="${i}" data-j="${j}" data-d="1" ${j === n - 1 ? 'disabled' : ''}>↓ Move down</button></div>
    <div class="grid2"><button class="btn sec" data-a="setDup" data-i="${i}" data-j="${j}">⧉ Duplicate</button><button class="btn danger" data-a="setDel" data-i="${i}" data-j="${j}">Delete set</button></div></div>`);
};
function undoIfDone(i, j) { const it = wk().items[i], s = it.sets[j]; if (s.done) undoSet(it, s, exById(it.exId)); }
A.setType = el => { const i = +el.dataset.i, j = +el.dataset.j, s = wk().items[i].sets[j]; if (s.done) undoIfDone(i, j); s.type = el.dataset.v; scheduleSave(); closeSheet(); refreshCard(i); };
A.setFail = el => { const i = +el.dataset.i, j = +el.dataset.j, s = wk().items[i].sets[j]; s.fail = !s.fail; if (s.fail) s.rir = 0; scheduleSave(); closeSheet(); refreshCard(i); };
A.setMove = el => { const i = +el.dataset.i, j = +el.dataset.j, d = +el.dataset.d, a = wk().items[i].sets; if (j + d < 0 || j + d >= a.length) return; [a[j], a[j + d]] = [a[j + d], a[j]]; scheduleSave(); closeSheet(); refreshCard(i); };
A.setDup = el => { const i = +el.dataset.i, j = +el.dataset.j, s = wk().items[i].sets[j]; wk().items[i].sets.splice(j + 1, 0, { weight: s.weight, reps: s.reps, rir: s.rir, fail: false, done: false, type: s.type }); scheduleSave(); closeSheet(); refreshCard(i); };
A.setDel = el => { const i = +el.dataset.i, j = +el.dataset.j; undoIfDone(i, j); wk().items[i].sets.splice(j, 1); scheduleSave(); closeSheet(); refreshCard(i); };

/* exercise menu: move, remove, superset */
A.exMenu = el => {
  const i = +el.dataset.i, n = wk().items.length, it = wk().items[i];
  openSheet((exById(it.exId) || {}).name || 'Exercise', `<div class="col">
    <button class="btn sec full" data-a="swap" data-i="${i}">⇄ Swap exercise</button>
    <button class="btn sec full" data-a="exInfo" data-id="${it.exId}">ℹ How to do it · muscles · your history</button>
    ${exTools(exById(it.exId))}
    <button class="btn sec full" data-a="linkSS" data-i="${i}">🔗 ${it.superset ? 'Unlink superset' : 'Superset with next exercise'}</button>
    <div class="grid2"><button class="btn sec" data-a="moveEx" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑ Move up</button><button class="btn sec" data-a="moveEx" data-i="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''}>↓ Move down</button></div>
    <button class="btn danger full" data-a="removeEx" data-i="${i}">Remove from workout</button></div>`);
};
A.moveEx = el => { const i = +el.dataset.i, d = +el.dataset.d, a = wk().items; if (i + d < 0 || i + d >= a.length) return; [a[i], a[i + d]] = [a[i + d], a[i]]; normSS(); scheduleSave(); closeSheet(); renderWorkout(); };
A.removeEx = el => {
  const i = +el.dataset.i, it = wk().items[i], ex = exById(it.exId);
  if (!it.cardio && it.sets.some(s => s.done) && !confirm('This exercise has logged sets. Remove and undo them?')) return;
  if (!it.cardio) it.sets.forEach(s => { if (s.done && ex) undoSet(it, s, ex); });
  wk().items.splice(i, 1); normSS(); scheduleSave(); closeSheet(); renderWorkout();
};
A.linkSS = el => {
  const i = +el.dataset.i, items = wk().items, it = items[i];
  if (it.superset) { const L = it.superset[0]; items.forEach(x => { if (x.superset && x.superset[0] === L) x.superset = null; }); }
  else {
    const nx = items[i + 1];
    if (!nx || nx.superset || nx.cardio || it.cardio) { toast('Needs a free strength exercise right after this one'); return; }
    const used = new Set(items.filter(x => x.superset).map(x => x.superset[0])), L = [...'ABCDEFGH'].find(c => !used.has(c));
    it.superset = L + '1'; nx.superset = L + '2';
  }
  scheduleSave(); closeSheet(); renderWorkout();
};
A.autoSuper = () => {
  const items = wk().items; items.forEach(x => x.superset = null);
  let k = 0, g = 0;
  for (let i = 0; i < items.length - 1;) { if (!items[i].cardio && !items[i + 1].cardio) { const L = 'ABCDEFGH'[g++]; items[i].superset = L + '1'; items[i + 1].superset = L + '2'; i += 2; k++; } else i++; }
  scheduleSave(); renderWorkout(); toast(k ? `${k} superset pair${k > 1 ? 's' : ''} created` : 'Need at least two strength exercises');
};


/* ---------- drag to reorder exercises ---------- */
let drag = null;
function dragCards() { const l = $('#exlist'); return l ? [...l.children].filter(c => c.classList.contains('ex')) : []; }
function dragUpdate() {
  const d = drag; if (!d) return;
  const card = d.card, list = d.list;
  card.style.transform = '';
  let nat = card.getBoundingClientRect();
  const want = d.lastY - d.grab, center = d.lastY;   // swap when the finger crosses a neighbour's midpoint (cards are tall)
  const others = dragCards().filter(c => c !== card);
  let idx = 0; others.forEach(c => { const r = c.getBoundingClientRect(); if (r.top + r.height / 2 < center) idx++; });
  if (dragCards().indexOf(card) !== idx) { list.insertBefore(card, others[idx] || null); nat = card.getBoundingClientRect(); }
  card.style.transform = `translateY(${Math.round(want - nat.top)}px)`;
}
function dragLoop() {
  const d = drag; if (!d) return;
  const top = 130, bot = innerHeight - 130, y = d.lastY;
  let v = 0; if (y < top) v = -Math.min(16, Math.ceil((top - y) / 8)); else if (y > bot) v = Math.min(16, Math.ceil((y - bot) / 8));
  if (v) { scrollBy(0, v); dragUpdate(); }
  d.raf = requestAnimationFrame(dragLoop);
}
function dragEnd(commit) {
  const d = drag; if (!d) return; drag = null;
  cancelAnimationFrame(d.raf);
  try { d.handle.releasePointerCapture(d.pid); } catch (e) { }
  try { getSelection().removeAllRanges(); } catch (e) { }
  d.list.classList.remove('reordering'); d.card.classList.remove('dragging'); d.card.style.transform = ''; document.body.classList.remove('dragging-body');
  if (!commit) { renderWorkout(); return; }
  const order = dragCards().map(c => +c.dataset.ex);
  if (order.every((v, i) => v === i)) return;
  const old = wk().items, ssBefore = old.filter(x => x.superset).length;
  wk().items = order.map(i => old[i]); normSS();
  scheduleSave(); renderWorkout();
  if (wk().items.filter(x => x.superset).length < ssBefore) toast('Superset unlinked: its two exercises are no longer next to each other');
}
document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('.grip'); if (!h || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const card = h.closest('.ex'); if (!card || !$('#exlist')) return;
  e.preventDefault(); try { getSelection().removeAllRanges(); } catch (x) { }
  const r = card.getBoundingClientRect();
  drag = { card, handle: h, list: $('#exlist'), pid: e.pointerId, grab: e.clientY - r.top, lastY: e.clientY, raf: 0 };
  try { h.setPointerCapture(e.pointerId); } catch (x) { }
  card.classList.add('dragging'); document.body.classList.add('dragging-body');
  drag.list.classList.add('reordering');            // collapse cards to their title rows so the whole list fits on screen
  const nat = card.getBoundingClientRect(); if (nat.top !== r.top) scrollBy(0, nat.top - r.top);
  dragUpdate(); buzz('tap'); drag.raf = requestAnimationFrame(dragLoop);
});
document.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.pid) { drag.lastY = e.clientY; dragUpdate(); } });
document.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pid) dragEnd(true); });
document.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) dragEnd(false); });

/* ---------- exercise picker (swap / add) ---------- */
let pick = { mode: 'swap', i: 0, q: '', f: 'all', all: false };
A.swap = el => openPicker('swap', +el.dataset.i);
A.addEx = () => openPicker('add', -1);
A.addCardio = () => openPicker('add', -1, 'Cardio');
function openPicker(mode, i, f) {
  pick = { mode, i, q: '', f: f || (mode === 'swap' ? 'similar' : 'all'), all: false };
  const base = `<div class="col"><input id="pick-q" type="search" placeholder="Search exercises…" data-f="pickq" autocomplete="off">
    <div class="chips scrollx" id="pick-f"></div>
    <label class="check"><input type="checkbox" data-f="pickall"> Show gear I don't have</label>
    <button class="btn sec full" data-a="newCustom">＋ Create custom exercise</button><div id="pick-list" class="col gap6"></div></div>`;
  openSheet(mode === 'swap' ? 'Swap exercise' : 'Add exercise', base); paintPicker();
}
function paintPicker() {
  const cur = pick.mode === 'swap' && wk().items[pick.i] ? exById(wk().items[pick.i].exId) : null;
  const fs = [...(cur ? [['similar', 'Similar']] : []), ['all', 'All'], ...CHIPS_EXTRA, ...MUSCLES.map(m => [m, m]), ['Cardio', 'Cardio']];
  $('#pick-f').innerHTML = fs.map(([k, l]) => `<button class="chip ${pick.f === k ? 'on' : ''}" data-a="pickF" data-v="${k}">${l}</button>`).join('');
  const q = pick.q.trim().toLowerCase(), inUse = new Set(wk().items.map(x => x.exId));
  let list = allEx().filter(e => pick.all || hasGear(e));
  if (pick.f === 'similar' && cur) list = list.filter(e => e.primary === cur.primary && e.id !== cur.id);
  else if (pick.f !== 'all' && pick.f !== 'similar') list = byChip(list, pick.f);
  if (q) list = list.filter(e => (e.name + ' ' + e.primary + ' ' + (e.alias || '')).toLowerCase().includes(q));
  exRank(list, inUse);
  $('#pick-list').innerHTML = list.slice(0, 400).map(e => `<button class="prow" data-a="pickEx" data-id="${e.id}"><div><b>${isFav(e.id) ? '★ ' : ''}${esc(e.name)}</b><div class="mut xs">${esc(e.primary)} · ${e.gear.length ? e.gear.map(gearLabel).join(', ') : 'No equipment'}${hasGear(e) ? '' : ' · 🔒'}</div></div><span class="mut xs">${inUse.has(e.id) ? 'in workout' : (!e.noE1 && state.e1rm[e.id] ? state.e1rm[e.id] + ' ' + unit() : '')}</span></button>`).join('')
    || `<div class="empty">${pick.f === 'fav' && !q ? 'No favorites yet. Open any exercise’s ⋯ menu and tap ☆ Add to favorites.' : pick.f === 'recent' && !q ? 'Exercises you have logged lately show up here.' : 'No matches.'}${q ? ` Tap “Create custom exercise” to add “${esc(pick.q)}”.` : ''}</div>`;
}
A.pickF = el => { pick.f = el.dataset.v; paintPicker(); };
F.pickq = el => { pick.q = el.value; paintPicker(); };
F.pickall = el => { pick.all = el.checked; paintPicker(); };
A.pickEx = el => {
  const ex = exById(el.dataset.id); if (!ex) return;
  if (pick.mode === 'swap') swapTo(pick.i, ex.id); else { wk().items.push(buildItem(ex, { factor: 1 })); normSS(); toast(ex.name + ' added'); }
  scheduleSave(); closeSheet(); renderWorkout();
};
function swapTo(i, id) {
  const it = wk().items[i], nex = exById(id), old = exById(it.exId);
  if (it.cardio || nex.cardio) { const n = buildItem(nex, {}); n.superset = it.superset; wk().items[i] = n; normSS(); return; }
  const done = it.sets.filter(s => s.done), total = Math.max(1, it.sets.length - done.length) || 1;
  const fresh = buildItem(nex, { sets: done.length ? total : it.sets.length, factor: 1 });
  fresh.superset = it.superset;
  if (done.length) { it.sets = done; it.superset = null; wk().items.splice(i + 1, 0, fresh); toast('Logged sets kept; new exercise added below'); }
  else { wk().items[i] = fresh; toast(`Swapped to ${nex.name}`); }
  normSS();
}

/* ---------- warm-up calculator ---------- */
function warmupPlan(ex, top) {
  const bar = state.settings.bar, barbell = ex.gear.includes('Barbell'), sch = barbell ? [[0, 10], [.5, 5], [.7, 3], [.85, 1]] : [[.5, 8], [.7, 5], [.85, 2]];
  const out = []; sch.forEach(([p, r]) => {
    let w = p === 0 ? bar : Math.max(barbell ? bar : inc(), rnd(top * p));
    if (w < top && !out.some(o => o.weight === w)) out.push({ weight: w, reps: r });
  });
  return out;
}
A.warmup = el => {
  const i = +el.dataset.i, it = wk().items[i], ex = exById(it.exId), top = Math.max(...it.sets.filter(s => s.type === 'work').map(s => +s.weight || 0), 0);
  const plan = warmupPlan(ex, top);
  if (!plan.length) { toast('Working weight is too light to need warm-ups'); return; }
  window.__wu = { i, plan };
  openSheet('Smart warm-up', `<div class="col"><p class="mut sm">Ramp to ${top} ${unit()} for ${esc(ex.name)} with minimal fatigue.</p>
    ${plan.map(p => `<div class="prow static"><b>${p.weight} ${unit()}</b><span>× ${p.reps}</span><span class="mut xs">${Math.round(p.weight / top * 100)}%</span></div>`).join('')}
    <button class="btn pri full" data-a="warmupAdd">Add ${plan.length} warm-up sets</button></div>`);
};
A.warmupAdd = () => {
  const { i, plan } = window.__wu, it = wk().items[i];
  it.sets = it.sets.filter(s => !(s.type === 'warmup' && !s.done));
  it.sets.unshift(...plan.map(p => ({ weight: p.weight, reps: p.reps, rir: 4, fail: false, done: false, type: 'warmup' })));
  scheduleSave(); closeSheet(); refreshCard(i);
};

/* ---------- plate calculator ---------- */
function platePlan(total, bar, plates) {
  let side = Math.round((total - bar) / 2 * 100) / 100; if (side < 0) return null;
  const out = []; [...plates].sort((a, b) => b - a).forEach(p => { const c = Math.floor(side / p + 1e-9); if (c > 0) { out.push([p, c]); side = Math.round((side - c * p) * 100) / 100; } });
  return { out, rem: Math.round(side * 2 * 100) / 100 };
}
function calcPlates() {
  const out = $('#plate-out'); if (!out) return;
  const total = Number(String($('#plate-in').value).replace(',', '.')) || 0, st = state.settings, plan = platePlan(total, st.bar, st.plates);
  if (!total) { out.innerHTML = ''; return; }
  if (!plan) { out.innerHTML = `<p class="mut">Less than the empty bar (${st.bar} ${unit()}).</p>`; return; }
  const mx = Math.max(...st.plates);
  const vis = plan.out.map(([p, c]) => Array.from({ length: c }, () => `<i style="height:${26 + p / mx * 44}px">${p}</i>`).join('')).join('');
  out.innerHTML = `<div class="plates-vis"><span class="barend"></span>${vis || '<em class="mut xs">Bar only</em>'}</div>
    <div class="row wrap gap6">${plan.out.map(([p, c]) => `<span class="tag or">${c} × ${p} ${unit()}</span>`).join('') || ''}</div>
    <p class="mut xs">Per side · ${st.bar} ${unit()} bar${plan.rem > .01 ? ` · closest loadable: <b>${Math.round((total - plan.rem) * 100) / 100} ${unit()}</b>` : ''}</p>`;
}
function openPlates(w) {
  const bars = unit() === 'kg' ? [20, 15, 10] : [45, 35, 15];
  openSheet('Plate calculator', `<div class="col"><div class="field"><label>Target total (${unit()})</label><input id="plate-in" inputmode="decimal" value="${w || ''}" data-f="plateIn" placeholder="${unit() === 'kg' ? 100 : 225}"></div>
    <div class="chips" id="bar-chips">${bars.map(b => `<button class="chip ${state.settings.bar === b ? 'on' : ''}" data-a="barPick" data-v="${b}">${b} ${unit()} bar</button>`).join('')}</div><div id="plate-out" class="col"></div></div>`);
  calcPlates();
}
F.plateIn = calcPlates;
A.barPick = el => { state.settings.bar = +el.dataset.v; scheduleSave(); $$('#bar-chips .chip').forEach(c => c.classList.toggle('on', c === el)); calcPlates(); };
A.plates = el => { const it = wk().items[+el.dataset.i], s = it.sets.filter(x => x.type === 'work'); openPlates(Math.max(...s.map(x => +x.weight || 0), 0) || ''); };
A.plateTop = () => { let w = ''; const it = wk().items.find(x => !x.cardio && x.sets.length); if (it) w = Math.max(...it.sets.map(s => +s.weight || 0)) || ''; openPlates(w); };

/* ---------- tempo coach ---------- */
let tempoRun = null;
function stopTempo() { if (tempoRun) { clearInterval(tempoRun.int); tempoRun = null; } }
A.tempo = el => {
  const i = +el.dataset.i, it = wk().items[i], ex = exById(it.exId);
  openSheet('Tempo coach', `<div class="col"><p class="mut sm">${esc(ex.name)} · lower – pause – lift – squeeze (seconds)</p>
    <div class="grid2"><div class="field"><label>Tempo</label><input id="tp-in" value="${esc(it.tempo || ex.tempo)}" placeholder="3-1-1-0"></div><div class="field"><label>Reps</label><input id="tp-reps" inputmode="numeric" value="8"></div></div>
    <div id="tp-view" class="tempo-view"><div id="tp-phase">Ready</div><div id="tp-count">—</div><div id="tp-rep" class="mut"> </div></div>
    <div class="grid2"><button class="btn pri" data-a="tpStart" data-i="${i}">▶ Start</button><button class="btn sec" data-a="tpStop">■ Stop</button></div>
    <p class="mut xs">Audio cues mark each phase so you can keep your eyes on your form. Phone vibration works on Android browsers.</p></div>`, { onClose: stopTempo });
};
A.tpStop = () => { stopTempo(); $('#tp-phase').textContent = 'Stopped'; };
A.tpStart = el => {
  stopTempo(); audio();
  const i = +el.dataset.i, raw = $('#tp-in').value.trim(), ph = raw.split(/[-,\s]+/).map(n => Math.max(0, Math.min(9, parseInt(n) || 0)));
  while (ph.length < 4) ph.push(0);
  if (ph.slice(0, 4).every(n => !n)) { toast('Enter a tempo like 3-1-1-0'); return; }
  wk().items[i].tempo = ph.slice(0, 4).join('-'); scheduleSave();
  const reps = clamp(parseInt($('#tp-reps').value) || 8, 1, 30), names = ['Lower', 'Pause', 'Lift', 'Squeeze'], seq = [];
  for (let r = 1; r <= reps; r++) ph.slice(0, 4).forEach((s, k) => { if (s > 0) seq.push({ r, name: names[k], s, k }); });
  let k = 0, left = 0;
  const show = () => { const c = seq[k]; $('#tp-phase').textContent = c.name; $('#tp-count').textContent = left; $('#tp-rep').textContent = `Rep ${c.r} of ${reps}`; };
  const begin = () => { left = seq[k].s; show(); cue(seq[k].k === 0 ? 'phase' : 'phase2'); buzz('phase'); };
  begin();
  tempoRun = { int: setInterval(() => {
    left--;
    if (left <= 0) { k++; if (k >= seq.length) { stopTempo(); $('#tp-phase').textContent = 'Done'; $('#tp-count').textContent = '✓'; cue('timer'); buzz('set'); refreshCard(i); return; } begin(); }
    else $('#tp-count').textContent = left;
  }, 1000) };
};

/* ---------- PR celebration ---------- */
let prQueue = [], prShowing = false;
function showPR(p) {
  const q = prQueue.find(x => x.ex.id === p.ex.id); if (q) Object.assign(q, p, { old: q.old }); else prQueue.push(p);
  if (!prShowing) nextPR();
}
function nextPR() {
  const p = prQueue.shift(), el = $('#pr');
  if (!p) { prShowing = false; el.hidden = true; return; }
  prShowing = true; cue('pr'); buzz('pr');
  $('#pr-body').innerHTML = `<div class="trophy">🏆</div><div class="prtag">${p.milestone ? p.milestone + ' ' + unit() + ' CLUB' : 'NEW PERSONAL RECORD'}</div>
    <h2>${esc(p.ex.name)}</h2><div class="prbig">${p.weight} ${unit()} × ${p.reps}</div>
    <div class="mut">Estimated 1RM <b>${p.old}</b> → <b class="or">${p.now} ${unit()}</b> (+${Math.max(1, p.now - p.old)})</div>
    <div class="row gap6 pt8"><button class="btn pri grow" data-a="prNext">Keep lifting</button><button class="btn sec" data-a="prShare">Share</button></div>`;
  window.__pr = p; el.hidden = false;
  const conf = $('#confetti'); conf.innerHTML = '';
  if (!reduceMotion()) for (let k = 0; k < 34; k++) { const s = document.createElement('span'); s.style.cssText = `left:${Math.random() * 100}%;background:hsl(${Math.random() * 60 + 10},95%,60%);animation-delay:${Math.random() * .6}s;animation-duration:${1.8 + Math.random() * 1.4}s`; conf.appendChild(s); }
}
A.prNext = nextPR;
A.prShare = () => { const p = window.__pr; shareText(`New PR on ${p.ex.name}: ${p.weight} ${unit()} × ${p.reps} (est. 1RM ${p.now} ${unit()}) 🏆 #ForgeFit`, 'New PR'); };
async function shareText(text, title) {
  try { if (navigator.share) { await navigator.share({ title, text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); } catch (e) { prompt('Copy this:', text); }
}

/* ---------- smart deload / auto-regulation ---------- */
function deloadAdvice() {
  if (isDeload()) { const bd = !manualDeload(), until = bd ? (blockInfo() || {}).end : state.deload.until; return { level: 'active', reasons: ['Weights ~10% lighter, ~40% fewer sets, +1 reps in reserve' + (until ? ' until ' + fmtDate(until) : '') + (bd ? ' (final week of your training block)' : '')] }; }
  const reasons = [], H = state.history.filter(h => h.items && h.items.length);
  if (H.length < 3) return { level: 'none', reasons };
  const avg = avgRecovery(); if (avg < 50) reasons.push(`Average muscle freshness is only ${avg}%`);
  let hard = 0, tot = 0; H.slice(0, 3).forEach(h => h.items.forEach(i => i.sets.forEach(s => { if (s.type === 'warmup') return; tot++; if (s.fail || s.rir === 0) hard++; })));
  if (tot >= 12 && hard / tot > .35) reasons.push(`${Math.round(hard / tot * 100)}% of your last sets went to failure`);
  let reg = 0; Object.values(state.e1rmHist).forEach(a => { if (a.length >= 4) { const l = a.slice(-3).map(p => p.v), prev = a[a.length - 4].v; if (l[2] < prev * .98 && l[2] <= l[0]) reg++; } });
  if (reg >= 2) reasons.push(`${reg} lifts have trended down over their last sessions`);
  const weeks = new Set(H.filter(h => h.t > (state.lastDeload || 0) && h.t > Date.now() - 56 * DAY).map(h => Math.floor(h.t / (7 * DAY))));
  if (weeks.size >= 6) reasons.push(`${weeks.size} training weeks since your last deload`);
  return { level: reasons.length >= 2 ? 'deload' : reasons.length === 1 ? 'watch' : 'none', reasons };
}
A.startDeload = () => { state.deload = { until: Date.now() + 7 * DAY }; state.lastDeload = Date.now(); scheduleSave(); if (!doneSetCount()) generateWorkout(); else renderWorkout(); toast('Deload week started'); if (tab === 'recovery') renderRecovery(); };
A.endDeload = () => { state.deload = null; if (state.block && blockDeload()) state.block.skipDeload = true; scheduleSave(); renderWorkout(); if (tab === 'recovery') renderRecovery(); toast('Deload ended'); };

/* ---------- finish session ---------- */
const setVol = (ex, s) => loadOf(ex, s) * (+s.reps || 0);
/* A.finish lives in session.js */
function stopRestTimerQuiet() { state.timer = null; clearInterval(tInt); clearTimeout(tBg); $('#tbar').hidden = true; }
A.sessTpl = () => { const s = window.__lastSession; ask('Save routine', 'Routine name', s.rec.name.replace(' Session', ''), n => saveTemplate(n, s.tpl)); };
/* ---------- recovery tab ---------- */
function renderRecovery() {
  updatePassiveRecovery();
  const adv = deloadAdvice(), avg = avgRecovery();
  const col = p => p >= 80 ? 'gr' : p >= 55 ? 'am' : 'rd';
  $('#tab-recovery').innerHTML = `
    <div class="card"><div class="row sp"><div><h2 class="h2">Readiness</h2><p class="mut sm">Recovers ~1.25% per hour. Drag a slider if you feel sore.</p></div><b class="big ${col(avg)}">${avg}%</b></div>
      <div class="row gap6 pt8"><button class="mini" data-a="resetRec">Reset all to 100%</button><button class="mini" data-a="simTime">+24h simulate</button></div></div>
    ${restCard()}
    ${coachBanner() || `<div class="banner ok"><div class="grow"><b>Recovery looks good</b><div class="mut sm">No deload needed right now. Auto-regulation trims weights when muscles are under ~75% fresh.</div></div><button class="mini" data-a="startDeload">Deload anyway</button></div>`}
    <div class="card col">${MUSCLES.map(m => { const p = rec(m); return `<div class="rcell"><div class="row sp"><b>${m}</b><b class="${col(p)}">${p}% fresh</b></div><div class="bar"><i class="bg-${col(p)}" style="width:${p}%"></i></div>
      <div class="row sp mut xs"><span>Manual override</span><input type="range" min="0" max="100" value="${p}" data-f="recSlide" data-m="${m}" aria-label="${m} freshness"></div></div>`; }).join('')}</div>`;
}
R.recovery = renderRecovery;
F.recSlide = el => { state.muscles[el.dataset.m].recovery = +el.value; scheduleSave(); };
A.resetRec = () => { MUSCLES.forEach(m => state.muscles[m].recovery = 100); scheduleSave(); renderRecovery(); };
A.simTime = () => { MUSCLES.forEach(m => state.muscles[m].recovery = Math.min(100, state.muscles[m].recovery + 24 * 1.25)); scheduleSave(); renderRecovery(); };

/* ---------- navigation ---------- */
function go(t) {
  tab = t;
  ['workout', 'recovery', 'progress', 'body', 'more'].forEach(k => { $('#tab-' + k).hidden = k !== t; $('#nav-' + k).classList.toggle('on', k === t); });
  R[t] && R[t](); window.scrollTo(0, 0);
}
A.go = el => go(el.dataset.t);
