/* ---------- guided calibration: find your working weight for a lift ForgeFit hasn't seen you do ---------- */
/* 1–3 short sets of 5 reps. You say how many more reps you had in you; ForgeFit estimates your one-rep max from the
   hardest honest set and sets today's working weight from it. Nothing here counts as a working set. */
const isNewLift = ex => ex && !ex.noE1 && !ex.cardio && !state.prs[ex.id] && !lastPerf(ex.id) && !(state.calib && state.calib[ex.id]);
const calibBtn = (ex, i) => isNewLift(ex) ? `<button class="coach cal" data-a="calib" data-id="${ex.id}" data-i="${i}">${ic('target')} New lift: find your working weight</button>` : '';
let cal = null;
const CAL_REPS = 5;
function calStart(id, i) {
  const ex = exById(id); if (!ex) return;
  const g = GOALS[state.profile.goal] || GOALS.muscle, w0 = ex.noE1 ? 0 : Math.max(ex.bw ? 0 : inc(), rnd(recWeight(ex, CAL_REPS, 5) * .85));
  cal = { id, i: Number.isFinite(i) ? i : null, sets: [], w: w0, r: CAL_REPS, rir: null, g };
  calPaint();
}
function calEst(s) { const ex = exById(cal.id); return est1(ex, { weight: s.w, reps: s.r, rir: Math.min(s.rir, 5), fail: false }); }
function calBest() {                                   // the hardest set is the most accurate; ties go to the heavier one
  if (!cal.sets.length) return null;
  return [...cal.sets].sort((a, b) => a.rir - b.rir || b.w - a.w)[0];
}
function calPaint() {
  const ex = exById(cal.id), u = unit(), k = cal.sets.length, best = calBest();
  const easy = best && best.rir >= 4, done = k >= 3 || (best && !easy);
  const rirChips = [0, 1, 2, 3, 4, 5].map(v => `<button class="${cal.rir === v ? 'on' : ''}" data-a="calRir" data-v="${v}">${v === 5 ? '5+' : v}</button>`).join('');
  const hist = cal.sets.map((s, n) => `<div class="calrow"><span>Set ${n + 1}</span><b>${s.w ? s.w + ' ' + u : 'Bodyweight'} × ${s.r}</b><span class="mut">${s.rir >= 5 ? '5+' : s.rir} left</span></div>`).join('');
  let body;
  if (done && best) {
    const e = Math.round(calEst(best)), g = cal.g, comp = ex.type === 'compound', reps = comp ? g.cReps : g.iReps, rir = clamp(g.rir + blockRirAdj(), 0, 4);
    const L = e / (1 + Math.min(reps + rir, 15) / 30), ww = ex.bw ? Math.max(0, rnd(L - ex.bw * bw())) : Math.max(inc(), rnd(L));
    cal.result = { e, ww, reps };
    body = `<div class="calres"><span class="flab">Your working weight</span><b>${ww ? ww + ' ' + u : 'Bodyweight'}</b><span>for ${reps} reps, leaving about ${rir} in the tank</span></div>
      <p class="mut sm">Estimated one-rep max: about ${e} ${u}. ForgeFit keeps fine-tuning this from every set you log.</p>${hist ? `<div class="calhist">${hist}</div>` : ''}
      <button class="btn pri hero full" data-a="calApply">${ic('check')} Use ${ww ? ww + ' ' + u : 'this'}</button>
      ${k < 3 ? '<button class="btn sec full mt8" data-a="calMore">Do one more test set</button>' : ''}`;
  } else {
    const tip = k === 0 ? `Start light. Pick a weight you're sure you can lift for ${CAL_REPS} clean reps, do ${CAL_REPS}, then say how many more you could have done.`
      : `That was easy, so let's go a bit heavier. Rest a minute, then do ${CAL_REPS} reps at the weight below.`;
    body = `<p class="mut sm">${tip}</p>${hist ? `<div class="calhist">${hist}</div>` : ''}
      <div class="fset"><b class="fwhat">Test set ${k + 1}</b>
        <div class="steps"><div class="stepper"><span class="flab">${ex.bw ? 'Added ' + u : u}</span><div class="sctl"><button data-a="calStep" data-k="w" data-d="-1" aria-label="Less weight">${ic('minus')}</button><input inputmode="decimal" data-f="calIn" data-k="w" value="${cal.w || ''}" placeholder="0" aria-label="Weight"><button data-a="calStep" data-k="w" data-d="1" aria-label="More weight">${ic('plus')}</button></div></div>
        <div class="stepper"><span class="flab">Reps done</span><div class="sctl"><button data-a="calStep" data-k="r" data-d="-1" aria-label="Fewer reps">${ic('minus')}</button><input inputmode="numeric" data-f="calIn" data-k="r" value="${cal.r}" aria-label="Reps"><button data-a="calStep" data-k="r" data-d="1" aria-label="More reps">${ic('plus')}</button></div></div></div>
        <div class="frir"><span class="flab">How many more reps could you have done?</span><div class="segp full">${rirChips}</div></div>
        <button class="btn pri full" data-a="calSave" ${cal.rir == null ? 'disabled' : ''}>Save test set</button></div>
      <p class="mut xs pt8">Stop if anything hurts. Test sets aren't counted as working sets.</p>`;
  }
  openSheet('Find your working weight', `<div class="col cal"><div><b class="calname">${esc(ex.name)}</b></div>${body}</div>`);
}
A.calib = el => calStart(el.dataset.id, el.dataset.i != null && el.dataset.i !== '' ? +el.dataset.i : NaN);
A.calRir = el => { cal.rir = +el.dataset.v; calPaint(); };
A.calStep = el => { const k = el.dataset.k, d = +el.dataset.d; if (k === 'w') cal.w = Math.max(0, Math.round(((+cal.w || 0) + d * inc()) * 100) / 100); else cal.r = clamp((+cal.r || 0) + d, 1, 20); calPaint(); };
F.calIn = el => { const v = parseFloat(el.value); if (el.dataset.k === 'w') cal.w = Number.isFinite(v) ? Math.max(0, v) : 0; else cal.r = Number.isFinite(v) ? clamp(Math.round(v), 1, 20) : CAL_REPS; };
A.calSave = () => {
  if (cal.rir == null) return;
  const s = { w: +cal.w || 0, r: +cal.r || CAL_REPS, rir: cal.rir }; cal.sets.push(s); cal.rir = null;
  if (s.rir >= 4 && cal.sets.length < 3) {           // too easy: aim the next set at ~2 reps left
    const e = calEst(s), ex = exById(cal.id), L = e / (1 + (CAL_REPS + 2) / 30);
    cal.w = ex.bw ? Math.max(0, rnd(L - ex.bw * bw())) : Math.max(inc(), rnd(L)); cal.r = CAL_REPS;
  }
  calPaint();
};
A.calMore = () => { const b = calBest(); cal.result = null; if (b) { const e = calEst(b), ex = exById(cal.id), L = e / (1 + (CAL_REPS + 1) / 30); cal.w = ex.bw ? Math.max(0, rnd(L - ex.bw * bw())) : Math.max(inc(), rnd(L)); } cal.sets = cal.sets.map(x => ({ ...x, rir: Math.max(x.rir, 4) })); calPaint(); };
A.calApply = () => {
  const ex = exById(cal.id), r = cal.result; if (!ex || !r) return;
  state.e1rm[ex.id] = r.e; state.calib = state.calib || {}; state.calib[ex.id] = Date.now();
  const items = wk().items; let n = 0;
  items.forEach(it => { if (it.exId !== ex.id) return; it.sets.forEach(s => { if (!s.done && s.type === 'work') { s.weight = recWeight(ex, +s.reps || r.reps, s.rir ?? 2); n++; } }); it.trimmed = false; });
  scheduleSave(); closeSheet(); renderWorkout();
  toast(`Working weight set${n ? ` for ${n} set${n === 1 ? '' : 's'}` : ''}: ${r.ww ? r.ww + ' ' + unit() : 'bodyweight'}`);
  cal = null;
};
