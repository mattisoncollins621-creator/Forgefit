/* ---------- focus mode: one exercise at a time during a live workout ---------- */
let focusIdx = null, focusSet = null;          // which exercise / which set is on screen
const focusOn = () => state.settings.focus !== false;
const itemLeft = it => it.cardio ? !it.done : it.sets.some(s => !s.done);
function nextOpen(from) {                      // next exercise that still has work, starting at `from`
  const items = wk().items, n = items.length;
  for (let k = 0; k < n; k++) { const i = (from + k) % n; if (itemLeft(items[i])) return i; }
  return -1;
}
function curSet() {                            // first unlogged set of the workout, in order
  const items = wk().items;
  for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.cardio) { if (!it.done) return { i, j: -1 }; continue; } const j = it.sets.findIndex(s => !s.done); if (j >= 0) return { i, j }; }
  return null;
}
function rirSeg(i, j, s) {
  const rpe = state.settings.rpe, L = rpe ? { F: 'RPE 10F', 0: '10', 1: '9', 2: '8', 3: '7', 4: '6' } : { F: 'Fail', 0: '0', 1: '1', 2: '2', 3: '3', 4: '4' };
  const cur = s.fail ? 'F' : String(s.rir);
  return `<div class="frir"><span class="flab">${rpe ? 'RPE' : 'Reps in reserve'}</span><div class="segp full">${['F', 0, 1, 2, 3, 4].map(v => `<button class="${cur === String(v) ? 'on' : ''}" data-a="fRir" data-i="${i}" data-j="${j}" data-v="${v}">${L[v]}</button>`).join('')}</div></div>`;
}
const stepper = (i, j, k, label, val, ph, mode) => `<div class="stepper"><span class="flab">${label}</span><div class="sctl">
  <button data-a="fStep" data-i="${i}" data-j="${j}" data-k="${k}" data-d="-1" aria-label="Less ${label}">${ic('minus')}</button>
  <input inputmode="${mode}" value="${val || ''}" placeholder="${ph ?? ''}" data-f="set" data-k="${k}" data-i="${i}" data-j="${j}" aria-label="${label}">
  <button data-a="fStep" data-i="${i}" data-j="${j}" data-k="${k}" data-d="1" aria-label="More ${label}">${ic('plus')}</button></div></div>`;
function focusHtml() {
  const items = wk().items, n = items.length;
  if (focusIdx == null || focusIdx >= n) { const c = curSet(); focusIdx = c ? c.i : 0; }
  const i = focusIdx, it = items[i], ex = exById(it.exId);
  const dots = items.map((x, k) => `<button class="fdot ${k === i ? 'on' : ''} ${itemLeft(x) ? '' : 'done'}" data-a="fGo" data-i="${k}" aria-label="Exercise ${k + 1}"></button>`).join('');
  const nav = `<div class="row sp fnav"><button class="ib" data-a="fGo" data-i="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="Previous exercise">${ic('back')}</button>
    <div class="fdots">${dots}</div><button class="ib" data-a="fGo" data-i="${i + 1}" ${i === n - 1 ? 'disabled' : ''} aria-label="Next exercise">${ic('right')}</button></div>`;
  const all = nextOpen(0) < 0 ? `<div class="banner ok fdone"><div class="grow"><b>Every set is logged</b><div class="mut sm">Nice work. End the workout to see your summary.</div></div><button class="btn pri" data-a="endWorkout">Finish</button></div>` : '';
  if (!ex) return `<div class="card focus" id="focus">${nav}</div>`;
  if (it.cardio) {
    return `<div class="card focus" id="focus">${nav}<div class="mut xs fcount">Exercise ${i + 1} of ${n}</div><div class="row gap6 wrap"><span class="tag">Cardio</span></div><h2 class="fname">${esc(ex.name)}</h2>
      <div class="steps one">${`<div class="stepper"><span class="flab">Minutes</span><div class="sctl"><button data-a="fStepC" data-i="${i}" data-d="-1" aria-label="Fewer minutes">${ic('minus')}</button><input inputmode="decimal" value="${it.min || ''}" data-f="cardio" data-k="min" data-i="${i}" aria-label="Minutes"><button data-a="fStepC" data-i="${i}" data-d="1" aria-label="More minutes">${ic('plus')}</button></div></div>`}</div>
      <button class="btn ${it.done ? 'sec' : 'pri hero'} full mt8" data-a="cardioDone" data-i="${i}">${it.done ? ic('check') + ' Completed · tap to undo' : ic('check') + ' Mark complete'}</button>${all}</div>`;
  }
  let j = focusSet != null && it.sets[focusSet] ? focusSet : it.sets.findIndex(s => !s.done); if (j < 0) j = it.sets.length - 1;
  const s = it.sets[j], last = lastPerf(ex.id), ph = last && last[Math.min(j, last.length - 1)], pct = rec(ex.primary);
  let wn = 0; const lbls = it.sets.map(x => x.type === 'warmup' ? 'W' : x.type === 'drop' ? 'D' : String(++wn)), work = wn;
  const hint = progressHint(ex, it), fat = hint ? null : fatigueHint(ex, it);
  const coach = hint ? `<button class="coach up" data-a="bump" data-i="${i}">${ic('arrow-up')} ${esc(hint.msg)}</button>` : fat ? `<button class="coach dn" data-a="trim" data-i="${i}">${ic('arrow-down')} ${esc(fat.msg)}</button>` : '';
  const setList = it.sets.map((x, k) => `<button class="fs ${k === j ? 'on' : ''} ${x.done ? 'done' : ''} t-${x.type}" data-a="fPick" data-i="${i}" data-j="${k}"><span class="fsn">${lbls[k]}</span><span class="fsv">${x.weight || '–'}<i>×</i>${x.reps || '–'}</span>${x.done ? ic('check', 'sm') : ''}</button>`).join('');
  const what = s.type === 'warmup' ? 'Warm-up set' : s.type === 'drop' ? 'Drop set' : `Set ${lbls[j]} of ${work}`;
  return `<div class="card focus${sessPaused() ? ' dimmed' : ''}" id="focus" data-i="${i}">${nav}
    <div class="mut xs fcount">Exercise ${i + 1} of ${n}</div>
    <div class="row gap6 wrap"><span class="tag ${recCol(pct)}">${esc(ex.primary)} ${pct}%</span>${mainTag(it)}${stalledTag(ex)}${it.superset ? `<span class="tag vi">Superset ${esc(it.superset)}</span>` : ''}</div>
    <h2 class="fname">${esc(ex.name)}</h2>${last ? `<div class="mut sm">Last time: ${last.slice(0, 4).map(x => `${x.w}×${x.r}`).join(' · ')}</div>` : ''}
    ${coach}
    <div class="fset ${s.done ? 'done' : ''}"><div class="row sp"><b class="fwhat">${what}</b>${s.done ? `<span class="tag gr">${ic('check', 'sm')} Logged</span>` : ''}</div>
      <div class="steps">${stepper(i, j, 'weight', unit(), s.weight, ph ? ph.w : '', 'decimal')}${stepper(i, j, 'reps', 'Reps', s.reps, ph ? ph.r : '', 'numeric')}</div>
      ${rirSeg(i, j, s)}
      <button class="btn ${s.done ? 'sec' : 'pri hero'} full" data-a="toggleSet" data-i="${i}" data-j="${j}">${s.done ? 'Undo this set' : ic('check') + ' Log set'}</button></div>
    <div class="fsets">${setList}</div>
    <div class="row gap6 wrap pt8"><button class="mini" data-a="addSet" data-i="${i}">${ic('plus')} Set</button><button class="mini" data-a="swap" data-i="${i}">${ic('swap')} Swap</button>
      <button class="mini" data-a="tempo" data-i="${i}">${ic('music')} Tempo ${esc(it.tempo || ex.tempo)}</button>${ex.gear.includes('Barbell') ? `<button class="mini" data-a="plates" data-i="${i}">${ic('plates')} Plates</button>` : ''}</div>
    <details class="cue"><summary>Form cue</summary><p>${esc(ex.cue || 'Control the weight, full range of motion.')}</p></details>${all}</div>`;
}
const viewBar = fo => `<div class="row sp viewbar"><span class="lbl">${fo ? 'One exercise at a time' : 'All exercises'}</span><div class="segp"><button class="${fo ? 'on' : ''}" data-a="viewMode" data-v="focus">Focus</button><button class="${fo ? '' : 'on'}" data-a="viewMode" data-v="list">List</button></div></div>`;
A.viewMode = el => { state.settings.focus = el.dataset.v === 'focus'; focusSet = null; scheduleSave(); renderWorkout(); };
A.fGo = el => { const k = +el.dataset.i; if (k < 0 || k >= wk().items.length) return; focusIdx = k; focusSet = null; renderWorkout(); };
A.fPick = el => { focusIdx = +el.dataset.i; focusSet = +el.dataset.j; renderWorkout(); };
A.fStep = el => {
  const i = +el.dataset.i, j = +el.dataset.j, k = el.dataset.k, d = +el.dataset.d, it = wk().items[i], s = it && it.sets[j]; if (!s) return;
  const inp = el.parentElement.querySelector('input'), ph = inp && inp.placeholder !== '' ? +inp.placeholder : 0;
  const step = k === 'weight' ? inc() : 1, base = +s[k] > 0 ? +s[k] : ph, was = +s[k] || 0;
  s[k] = Math.max(0, Math.round((base + d * step) * 100) / 100);
  it.sets.forEach((x, n) => { if (n > j && !x.done && x.type === s.type && (+x[k] || 0) === was) x[k] = s[k]; });   // later sets follow the change
  if (inp) inp.value = s[k] || ''; buzz('tap'); scheduleSave(); paintSessStats();
  it.sets.forEach((x, n) => { const chip = document.querySelector(`#focus .fs[data-j="${n}"] .fsv`); if (chip) chip.innerHTML = `${x.weight || '–'}<i>×</i>${x.reps || '–'}`; });
};
A.fStepC = el => { const it = wk().items[+el.dataset.i]; if (!it) return; it.min = Math.max(0, (+it.min || 0) + 5 * +el.dataset.d); const inp = el.parentElement.querySelector('input'); if (inp) inp.value = it.min || ''; scheduleSave(); };
A.fRir = el => {
  const s = wk().items[+el.dataset.i].sets[+el.dataset.j], v = el.dataset.v; if (!s) return;
  if (v === 'F') { s.fail = true; s.rir = 0; } else { s.fail = false; s.rir = +v; }
  el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); scheduleSave();
};
/* after a set is logged: stay on this exercise until its sets are done (alternating inside a superset), then move on */
function afterLog(i) {
  const items = wk().items, it = items[i];
  if (!focusOn()) {                                   // list view: bring the next set into view
    requestAnimationFrame(() => { const c = curSet(); if (!c) return; const card = $(`#exlist [data-ex="${c.i}"]`); if (!card) return;
      const row = c.j >= 0 ? card.querySelectorAll('.srow')[c.j] : card; const r = row.getBoundingClientRect();
      if (r.top < 90 || r.bottom > innerHeight - 90) row.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); });
    return;
  }
  focusSet = null;
  if (it.superset) {                                  // A1 → A2 → A1 …
    const letter = it.superset[0], mate = items.findIndex((x, k) => k !== i && x.superset && x.superset[0] === letter && itemLeft(x));
    if (mate >= 0) { focusIdx = mate; renderWorkout(); return; }
  }
  if (itemLeft(it)) { renderWorkout(); return; }      // more sets here: show the next one
  const nx = nextOpen(i + 1); if (nx < 0 || nx === i) return;
  setTimeout(() => { if (!sessActive() || !focusOn()) return; focusIdx = nx; renderWorkout(); const e = exById(items[nx].exId); if (e) toast('Next up: ' + e.name); }, 650);
}
/* swipe sideways on the exercise to move between exercises; vertical scrolling is left alone */
(function () {
  let sw = null;
  document.addEventListener('pointerdown', e => { const f = e.target.closest && e.target.closest('#focus'); sw = f && !e.target.closest('input,select,textarea,.segp') ? { x: e.clientX, y: e.clientY } : null; });
  document.addEventListener('pointerup', e => {
    if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { const k = focusIdx + (dx < 0 ? 1 : -1); if (k >= 0 && k < wk().items.length) { focusIdx = k; focusSet = null; renderWorkout(); } }
  });
  document.addEventListener('pointercancel', () => sw = null);
})();
const _cardioDone = A.cardioDone;
A.cardioDone = el => { _cardioDone(el); const it = wk().items[+el.dataset.i]; if (it && it.done && sessActive()) afterLog(+el.dataset.i); };
