'use strict';
/* ====================================================================
   v8: favorites + recents, exercise notes, full lift history, stalled
   lifts, records, weekly recap, photo compare, friendlier empty screens
   ==================================================================== */

/* ---------- favorites + recents ---------- */
const isFav = id => Array.isArray(state.favs) && state.favs.includes(id);
const CHIPS_EXTRA = [['fav', 'Favorites'], ['recent', 'Recent']];
function recentIds(n = 14) {
  const out = [], seen = new Set();
  for (const h of state.history) {
    for (const i of [...(h.items || []), ...(h.cardio || [])]) {
      if (i && i.exId && !seen.has(i.exId)) { seen.add(i.exId); out.push(i.exId); if (out.length >= n) return out; }
    }
  }
  return out;
}
/* favorites first, then the most recently used, then A–Z (items already in today's workout sink to the bottom) */
function exRank(list, inUse) {
  const ri = new Map(recentIds(80).map((id, k) => [id, k])), far = 999;
  return list.sort((a, b) => (inUse ? inUse.has(a.id) - inUse.has(b.id) : 0) || (isFav(b.id) - isFav(a.id)) || ((ri.has(a.id) ? ri.get(a.id) : far) - (ri.has(b.id) ? ri.get(b.id) : far)) || a.name.localeCompare(b.name));
}
function byChip(list, f) {
  if (f === 'fav') return list.filter(e => isFav(e.id));
  if (f === 'recent') { const r = new Set(recentIds(20)); return list.filter(e => r.has(e.id)); }
  return list.filter(e => e.primary === f);
}
const favLabel = id => isFav(id) ? ic('star', 'fill') + ' Favorite' : ic('star') + ' Add to favorites';
A.favToggle = el => {
  const id = el.dataset.id; if (!id) return;
  if (!Array.isArray(state.favs)) state.favs = [];
  const k = state.favs.indexOf(id); if (k >= 0) state.favs.splice(k, 1); else state.favs.push(id);
  scheduleSave(); el.innerHTML = favLabel(id); toast(k >= 0 ? 'Removed from favorites' : 'Added to favorites');
};

/* ---------- notes that stay with an exercise ---------- */
const noteOf = id => (state.exNotes && state.exNotes[id]) || '';
const noteLine = id => noteOf(id) ? `<button class="exnote" data-a="noteOpen" data-id="${esc(id)}">${ic('pencil')} ${esc(noteOf(id))}</button>` : '';
A.noteOpen = el => {
  const ex = exById(el.dataset.id); if (!ex || ex.cardio) return;
  openSheet('Note · ' + ex.name, `<div class="col"><p class="mut sm">A reminder that shows on this exercise every time you do it: seat height, grip, a cue that works for you.</p>
    <textarea id="note-in" rows="3" maxlength="160" placeholder="e.g. Seat 4, narrow grip, pause at the bottom">${esc(noteOf(ex.id))}</textarea>
    <div class="grid2"><button class="btn sec" data-a="noteClear" data-id="${esc(ex.id)}">Clear</button><button class="btn pri" data-a="noteSave" data-id="${esc(ex.id)}">Save</button></div></div>`);
  setTimeout(() => { const t = $('#note-in'); t && t.focus(); }, 250);
};
function setNote(id, v) {
  if (!state.exNotes || typeof state.exNotes !== 'object') state.exNotes = {};
  if (v) state.exNotes[id] = v; else delete state.exNotes[id];
  scheduleSave(); closeSheet(); if (tab === 'workout') renderWorkout(); toast(v ? 'Note saved' : 'Note cleared');
}
A.noteSave = el => setNote(el.dataset.id, ($('#note-in').value || '').trim().slice(0, 160));
A.noteClear = el => setNote(el.dataset.id, '');
/* the three buttons shown in an exercise's info and menu */
function exTools(ex) {
  return `<div class="grid2"><button class="btn sec" data-a="favToggle" data-id="${esc(ex.id)}">${favLabel(ex.id)}</button>${ex.cardio ? '<div></div>' : `<button class="btn sec" data-a="noteOpen" data-id="${esc(ex.id)}">${ic('pencil')} ${noteOf(ex.id) ? 'Edit note' : 'Add note'}</button>`}</div>
    ${ex.cardio ? '' : `<button class="btn sec full" data-a="exHist" data-id="${esc(ex.id)}">${ic('trend')} Full history &amp; records</button>`}`;
}

/* ---------- stalled lifts ---------- */
function stalledInfo(id) {
  const ex = exById(id); if (!ex || ex.cardio || ex.noE1) return null;
  const a = (state.e1rmHist[id] || []).filter(p => p && p.t && p.v > 0).sort((x, y) => x.t - y.t);
  if (a.length < 4) return null;
  const last = a.slice(-3), before = a.slice(0, -3);
  if (Date.now() - last[2].t > 28 * DAY) return null;                       // not training it lately
  if (last[2].t - last[0].t < 10 * DAY) return null;                        // three sessions in a few days say nothing
  const base = Math.max(...before.slice(-4).map(p => p.v)), top = Math.max(...last.map(p => p.v));
  if (top > base * 1.005) return null;                                       // still creeping up
  let m = a[0].v, at = a[0].t; for (let k = 1; k < a.length; k++) { if (a[k].v > m * 1.005) at = a[k].t; m = Math.max(m, a[k].v); }
  const weeks = Math.round((a[a.length - 1].t - at) / (7 * DAY));
  return weeks >= 2 ? { weeks, best: m } : null;
}
const stalledAdvice = ex => ex.type === 'compound'
  ? 'No new best for a while. Try a lighter week, a close variation, or one more set before adding weight.'
  : 'No new best for a while. Try slower reps with a pause at the stretch, one more set, or a few more reps before adding weight.';
const stalledTag = ex => { const s = stalledInfo(ex.id); return s ? `<span class="tag am" title="No new best in about ${s.weeks} weeks">stalled ${s.weeks}w</span>` : ''; };
function stalledCard() {
  const list = Object.keys(state.e1rmHist).map(id => ({ id, s: stalledInfo(id) })).filter(x => x.s).sort((a, b) => b.s.weeks - a.s.weeks).slice(0, 5);
  if (!list.length) return '';
  return `<div class="card"><h2 class="h2">Stalled lifts</h2><p class="mut xs">No new best estimated 1RM in a few weeks. Stalls are normal. Tap a lift for its history.</p>
    ${list.map(x => `<button class="prow" data-a="exHist" data-id="${esc(x.id)}"><div class="grow"><b>${esc(exById(x.id).name)}</b><div class="mut xs">${esc(stalledAdvice(exById(x.id)))}</div></div><span class="tag am">${x.s.weeks} wks</span></button>`).join('')}</div>`;
}

/* ---------- full history of one lift ---------- */
function exSessions(ex) {
  const out = [];
  for (const h of state.history) {
    const it = (h.items || []).find(x => x.exId === ex.id); if (!it) continue;
    const sets = convSets((it.sets || []).filter(s => s.type !== 'warmup'), h.unit); if (!sets.length) continue;
    let e1 = 0;
    if (!ex.noE1) sets.forEach(s => { const e = est1(ex, { weight: s.w, reps: s.r, rir: s.rir || 0, fail: s.fail }); if (e > e1) e1 = e; });
    out.push({ t: h.t, deload: !!h.deload, sets, e1: Math.round(e1) });
  }
  return out;                                                                // newest first
}
A.exHist = el => {
  const ex = exById(el.dataset.id); if (!ex || ex.cardio) return;
  const ss = exSessions(ex), st = stalledInfo(ex.id), pr = state.prs[ex.id];
  const pts = ex.noE1 ? [] : (state.e1rmHist[ex.id] || []).filter(p => p && p.t && p.v > 0);
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  const bestReps = ss.reduce((m, s) => Math.max(m, ...s.sets.map(x => +x.r || 0)), 0);
  const day = t => fmtDate(t, { month: 'short', day: 'numeric', year: 'numeric' });
  const rows = ss.slice(0, 40).map((s, k) => {
    const prev = ss[k + 1], d = prev && !ex.noE1 && prev.e1 && s.e1 ? s.e1 - prev.e1 : null;
    return `<div class="prow static"><div class="grow"><b>${day(s.t)}${s.deload ? ' <span class="tag">deload</span>' : ''}</b><div class="mut xs">${s.sets.map(x => (x.w ? x.w : 'BW') + '×' + (+x.r || 0)).join(' · ')}</div></div>${ex.noE1 ? '' : `<div class="right"><b>${s.e1}</b>${d === null ? '' : `<div class="xs ${d > 0 ? 'gr' : d < 0 ? 'rd' : 'mut'}">${d > 0 ? '+' : ''}${d}</div>`}</div>`}</div>`;
  }).join('');
  openSheet(ex.name + ' · history', `<div class="col">
    <div class="tiles">${tile(ss.length, 'Sessions')}${ex.noE1 ? tile(bestReps || '—', 'Best reps') : tile(state.e1rm[ex.id] ? state.e1rm[ex.id] + ' ' + unit() : '—', 'Est. 1RM')}${ex.noE1 ? tile(ss.length ? fmtDate(ss[0].t) : '—', 'Last done') : tile(pr ? Math.round(pr.weight) + '×' + pr.reps : '—', 'Best set')}</div>
    ${st ? `<div class="banner note"><div class="grow"><b>Stalled for about ${st.weeks} weeks</b><div class="mut sm">${esc(stalledAdvice(ex))}</div></div></div>` : ''}
    ${noteLine(ex.id)}
    ${pts.length >= 2 ? lineChart(pts) : ''}
    ${ss.length ? `<div class="lbl">Every session</div>${ex.noE1 ? '' : '<p class="mut xs">Right column: estimated 1RM from your best set that day, and the change from the session before.</p>'}${rows}`
      : '<div class="empty">No sessions logged with this exercise yet. Finish a workout that includes it and its history appears here.</div>'}
    <div class="grid2"><button class="btn sec" data-a="closeSheet">Close</button><button class="btn pri" data-a="libAdd" data-id="${esc(ex.id)}">${ic('plus')} Add to workout</button></div></div>`);
};

/* ---------- records ---------- */
let recSort = 'recent';
function paintRec(first) {
  const rows = Object.entries(state.prs).map(([id, p]) => ({ id, p, ex: exById(id) })).filter(r => r.ex && !r.ex.cardio && r.p && r.p.e1rm > 0);
  if (recSort === 'heavy') rows.sort((a, b) => b.p.weight - a.p.weight);
  else if (recSort === 'az') rows.sort((a, b) => a.ex.name.localeCompare(b.ex.name));
  else rows.sort((a, b) => (b.p.t || 0) - (a.p.t || 0));
  const chip = (k, l) => `<button class="chip ${recSort === k ? 'on' : ''}" data-a="recSort" data-v="${k}">${l}</button>`;
  const html = `<div class="col"><p class="mut sm">Your best set on every lift, kept automatically. Tap one for its full history.</p><div class="chips">${chip('recent', 'Newest')}${chip('heavy', 'Heaviest')}${chip('az', 'A–Z')}</div>
    ${rows.length ? rows.map(r => `<button class="prow" data-a="exHist" data-id="${esc(r.id)}"><div class="grow"><b>${esc(r.ex.name)}</b><div class="mut xs">${esc(r.ex.primary)}${r.p.t ? ' · ' + fmtDate(r.p.t, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div></div><div class="right"><b class="or">${Math.round(r.p.weight)} ${unit()} × ${r.p.reps}</b><div class="mut xs">est. 1RM ${r.p.e1rm}</div></div></button>`).join('')
      : '<div class="empty">No records yet. Log a few sets and your best lifts collect here automatically.</div>'}</div>`;
  if (first) openSheet('Records', html); else sheetBody(html);
}
A.recOpen = () => paintRec(true);
A.recSort = el => { recSort = el.dataset.v; paintRec(false); };

/* ---------- weekly recap ---------- */
let recapOff = 1;
function weekStats(ws) {
  const we = addDays(ws, 7), hs = state.history.filter(h => h.t >= ws && h.t < we && ((h.items && h.items.length) || (h.cardio && h.cardio.length)));
  const f = u => (!u || u === unit()) ? 1 : (unit() === 'kg' ? KG : 1 / KG);
  let sets = 0, vol = 0, prs = 0; const days = new Set(), mus = {}; MUSCLES.forEach(m => mus[m] = 0);
  hs.forEach(h => {
    sets += h.sets || 0; vol += (h.vol || 0) * f(h.unit); prs += h.prs || 0; days.add(ymd(h.t));
    (h.items || []).forEach(i => (i.sets || []).forEach(s => { if (s.type === 'warmup') return; if (mus[i.p] != null) mus[i.p] += 1; (i.s || []).forEach(m => { if (mus[m] != null) mus[m] += .5; }); }));
  });
  return { sessions: hs.length, days: days.size, sets, vol: Math.round(vol), prs, mus };
}
function weekMover(ws) {
  const we = addDays(ws, 7); let best = null;
  Object.entries(state.e1rmHist).forEach(([id, a]) => {
    const ex = exById(id); if (!ex || ex.noE1) return;
    const inW = a.filter(p => p.t >= ws && p.t < we), before = a.filter(p => p.t < ws);
    if (!inW.length || !before.length) return;
    const b = Math.max(...before.slice(-3).map(p => p.v)), n = Math.max(...inW.map(p => p.v)), pct = (n - b) / b * 100;
    if (n > b && (!best || pct > best.pct)) best = { ex, pct, now: n };
  });
  return best;
}
function recapHtml() {
  const cur = weekStartOf(Date.now()), ws = addDays(cur, -7 * recapOff), S = weekStats(ws), P = weekStats(addDays(ws, -7));
  const lab = fmtDate(ws) + ' – ' + fmtDate(addDays(ws, 6));
  const tile = (v, l, d) => `<div class="tile"><b>${v}</b><span>${l}${d ? ` <em class="${d[0] === '+' ? 'gr' : 'rd'}">${d}</em>` : ''}</span></div>`;
  const pct = (a, b) => b > 0 && a !== b ? (a > b ? '+' : '') + Math.round((a - b) / b * 100) + '%' : '';
  const nav = `<div class="row sp"><button class="mini" data-a="recapGo" data-d="1" ${recapOff >= 26 ? 'disabled' : ''}>${ic('back')} Older</button><b>${recapOff === 0 ? 'This week so far' : recapOff === 1 ? 'Last week' : lab}</b><button class="mini" data-a="recapGo" data-d="-1" ${recapOff <= 0 ? 'disabled' : ''}>Newer ${ic('right')}</button></div><div class="mut xs center">${lab}</div>`;
  if (!S.sessions) return `<div class="col">${nav}<div class="empty">${recapOff === 0 ? 'Nothing logged yet this week.' : 'No sessions logged that week.'}</div></div>`;
  const mover = weekMover(ws), planned = trainDays().length, st = streakInfo();
  const low = MUSCLES.map(m => ({ m, n: S.mus[m], t: setTarget(m) })).filter(x => x.n < x.t[0]).sort((a, b) => a.n / a.t[0] - b.n / b.t[0]).slice(0, 4);
  const ok = MUSCLES.filter(m => S.mus[m] >= setTarget(m)[0]);
  return `<div class="col">${nav}
    <div class="tiles t4">${tile(S.sessions, 'Sessions', pct(S.sessions, P.sessions))}${tile(S.sets, 'Hard sets', pct(S.sets, P.sets))}${tile(S.vol.toLocaleString(), unit() + ' volume', pct(S.vol, P.vol))}${tile(S.prs, 'PRs')}</div>
    <div class="prow static"><div class="grow"><b>Training days</b><div class="mut xs">You trained on ${S.days} day${S.days > 1 ? 's' : ''}${recapOff > 0 ? ` (your plan is ${planned}). ${S.days >= planned ? 'Goal hit.' : 'A little short of the plan.'}` : ' so far.'}</div></div></div>
    ${mover ? `<div class="prow static"><div class="grow"><b>Biggest gain</b><div class="mut xs">${esc(mover.ex.name)}: estimated 1RM up ${Math.round(mover.pct * 10) / 10}% to ${mover.now} ${unit()}</div></div></div>` : ''}
    ${ok.length ? `<div class="prow static"><div class="grow"><b>On target</b><div class="mut xs">${ok.join(', ')} got enough hard sets.</div></div></div>` : ''}
    ${low.length ? `<div class="prow static"><div class="grow"><b>Skipped or light</b><div class="mut xs">${low.map(x => `${x.m} ${fmtN(x.n)} of ${x.t[0]}+ sets`).join(' · ')}</div></div></div>` : ''}
    ${recapOff === 1 && st.streak ? `<p class="center sm or">${ic('flame')} ${st.streak}-week streak</p>` : ''}</div>`;
}
A.recapOpen = () => {
  const cur = weekStartOf(Date.now());
  state.seen['recap' + ymd(cur)] = true; scheduleSave();
  recapOff = weekStats(addDays(cur, -7)).sessions ? 1 : 0;
  openSheet('Weekly recap', recapHtml(), { onClose: () => { if (tab === 'workout') renderWorkout(); } });
};
A.recapGo = el => { recapOff = clamp(recapOff + (+el.dataset.d || 0), 0, 26); sheetBody(recapHtml()); };
A.recapDismiss = () => { state.seen['recap' + ymd(weekStartOf(Date.now()))] = true; scheduleSave(); renderWorkout(); };
function recapBanner() {
  if (!state.profile.done || !state.history.length) return '';
  const cur = weekStartOf(Date.now()); if (state.seen['recap' + ymd(cur)]) return '';
  const S = weekStats(addDays(cur, -7)); if (!S.sessions) return '';
  return `<div class="banner ok"><div class="grow"><b>Your week in review</b><div class="mut sm">${S.sessions} session${S.sessions > 1 ? 's' : ''} · ${S.sets} sets · ${S.vol.toLocaleString()} ${unit()}${S.prs ? ' · ' + S.prs + ' PR' + (S.prs > 1 ? 's' : '') : ''}</div></div><div class="col gap6"><button class="mini pri" data-a="recapOpen">See recap</button><button class="mini" data-a="recapDismiss">Later</button></div></div>`;
}

/* ---------- progress photos side by side ---------- */
let cmp = { a: 0, b: 0 }, cmpUrls = [], cmpTok = 0;
const sortedPhotos = () => [...state.photos].sort((x, y) => x.t - y.t);
function nearWeight(t) {
  const m = state.measures.filter(x => x.weight != null && x.weight !== '' && Math.abs(x.t - t) <= 10 * DAY).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
  if (!m) return null; const f = (!m.unit || m.unit === unit()) ? 1 : (unit() === 'kg' ? KG : 1 / KG);
  return Math.round(+m.weight * f * 10) / 10;
}
A.photoCmp = () => {
  const ps = sortedPhotos(); if (ps.length < 2) { toast('Add at least two photos to compare'); return; }
  cmp = { a: 0, b: ps.length - 1 };
  const opts = sel => ps.map((p, k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${fmtDate(p.t, { month: 'short', day: 'numeric', year: 'numeric' })}</option>`).join('');
  openSheet('Compare photos', `<div class="col"><div class="grid2"><div class="field"><label>Before</label><select id="cmp-a" data-f="cmpA">${opts(cmp.a)}</select></div><div class="field"><label>After</label><select id="cmp-b" data-f="cmpB">${opts(cmp.b)}</select></div></div>
    <div id="cmp-view"><div class="empty">Loading…</div></div><button class="btn sec full" data-a="cmpSwap">${ic('swap')} Swap sides</button></div>`,
    { onClose: () => { cmpTok++; cmpUrls.forEach(u => URL.revokeObjectURL(u)); cmpUrls = []; } });
  paintCmp();
};
F.cmpA = el => { cmp.a = +el.value; paintCmp(); };
F.cmpB = el => { cmp.b = +el.value; paintCmp(); };
A.cmpSwap = () => { [cmp.a, cmp.b] = [cmp.b, cmp.a]; const a = $('#cmp-a'), b = $('#cmp-b'); if (a) a.value = cmp.a; if (b) b.value = cmp.b; paintCmp(); };
async function paintCmp() {
  const tok = ++cmpTok, ps = sortedPhotos(), A_ = ps[cmp.a], B_ = ps[cmp.b]; if (!A_ || !B_) return;
  const mine = [], day = t => fmtDate(t, { month: 'short', day: 'numeric', year: 'numeric' });
  const fig = async (p, lab) => {
    try { const r = await idbGet('photos', p.id); if (r && r.blob) { const u = URL.createObjectURL(r.blob); mine.push(u); return `<figure><img src="${u}" alt="${lab} photo"><figcaption>${lab} · ${day(p.t)}</figcaption></figure>`; } } catch (e) { }
    return `<figure><div class="phmiss">Photo unavailable</div><figcaption>${lab} · ${day(p.t)}</figcaption></figure>`;
  };
  const h = (await fig(A_, 'Before')) + (await fig(B_, 'After'));
  if (tok !== cmpTok || !$('#cmp-view')) { mine.forEach(u => URL.revokeObjectURL(u)); return; }
  cmpUrls.forEach(u => URL.revokeObjectURL(u)); cmpUrls = mine;
  const days = Math.abs(Math.round((B_.t - A_.t) / DAY)), wA = nearWeight(A_.t), wB = nearWeight(B_.t), dw = wA != null && wB != null ? Math.round((wB - wA) * 10) / 10 : null;
  $('#cmp-view').innerHTML = `<div class="cmp2">${h}</div><p class="mut sm center">${days} day${days === 1 ? '' : 's'} apart${dw !== null ? ` · weight ${wA} → ${wB} ${unit()} (${dw > 0 ? '+' : ''}${dw})` : ''}</p>`;
}

/* ---------- friendlier empty screens + first-run help ---------- */
const emptyWorkout = () => `<div class="card center col"><div class="emptyico">${ic('dumbbell')}</div><b>Nothing planned yet</b><p class="mut sm">Let ForgeFit build today’s session from how recovered each muscle is, or pick the exercises yourself.</p><div class="grid2"><button class="btn pri" data-a="regen">${ic('zap')} Build a workout</button><button class="btn sec" data-a="addEx">${ic('plus')} Add exercise</button></div></div>`;
const progTools = () => `${state.history.length ? '' : `<div class="card center col"><div class="emptyico">${ic('trend')}</div><b>Your charts start with your first workout</b><p class="mut sm">Finish a session on the Workout tab and this screen fills in: strength curves, a muscle heatmap, weekly sets and your records.</p><button class="btn pri" data-a="go" data-t="workout">Go to Workout</button></div>`}
  <div class="grid2"><button class="btn sec" data-a="recOpen">${ic('trophy')} Records</button><button class="btn sec" data-a="recapOpen">${ic('chart')} Weekly recap</button></div>${stalledCard()}`;
function whatsNew() {
  if (!state.profile.done) return '';
  if (!state.history.length) {
    if (state.seen.tips) return '';
    return `<div class="card"><div class="row sp"><h2 class="h2">Getting started</h2><button class="mini" data-a="seenNew">Got it</button></div>
      <ul class="newlist"><li>Do a set, then tap its ${ic('check')}. Your rest timer starts by itself.</li><li>Tap any <b>weight or reps</b> box to change it. <b>Swipe a set</b> left to delete, right to copy.</li><li>When you finish, tap <b>Complete &amp; log session</b>. That is what saves your progress.</li><li>Every couple of weeks, use <b>More → Back up now</b> so your history is safe.</li></ul></div>`;
  }
  if (state.seen.v8) return '';
  return `<div class="card"><div class="row sp"><h2 class="h2">What’s new</h2><button class="mini" data-a="seenNew">Got it</button></div>
    <ul class="newlist"><li><b>Favorites and recents</b>: star a lift (its menu) and it floats to the top of the exercise lists.</li><li><b>Notes</b> on any exercise, like “seat 4”, show on its card every time.</li><li><b>Full history</b> for every lift, <b>stalled-lift</b> flags and a <b>Records</b> page in Progress.</li><li>A <b>weekly recap</b> each new week, and <b>photo compare</b> in Body.</li></ul></div>`;
}
A.seenNew = () => { state.seen.v4 = true; state.seen.v8 = true; state.seen.tips = true; scheduleSave(); renderWorkout(); };
