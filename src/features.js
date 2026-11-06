'use strict';
/* =====================================================================
   ForgeFit features: onboarding, quick-log parser, templates, custom
   exercises, analytics, body tracking, settings, backup, boot
   ===================================================================== */

/* ---------- onboarding / personalization ---------- */
let ob = null;
function openOnboarding(redo) {
  const p = state.profile, tot = Math.round(p.heightCm / 2.54);
  ob = { step: 0, redo: !!redo, goal: p.goal, experience: p.experience, gender: p.gender, age: p.age, unit: p.unit, weight: p.weight, ft: Math.floor(tot / 12), inch: tot % 12, cm: Math.round(p.heightCm), days: p.days, splitPref: p.splitPref, sessionMin: p.sessionMin, cardio: p.cardio, preset: GEAR_PRESETS[state.activeProfile] || state.gearProfiles[state.activeProfile] ? state.activeProfile : 'Home Gym' };
  $('#onboard').hidden = false; document.body.classList.add('noscroll'); paintOb();
}
function paintOb() {
  const o = ob, big = (k, v, t, d) => `<button class="opt ${o[k] === v ? 'on' : ''}" data-a="obSet" data-k="${k}" data-v="${esc(v)}"><b>${t}</b>${d ? `<span>${d}</span>` : ''}</button>`;
  const ch = (k, v, t) => `<button class="chip ${String(o[k]) === String(v) ? 'on' : ''}" data-a="obSet" data-k="${k}" data-v="${v}">${t}</button>`;
  const steps = [
    `<h1>What's your main goal?</h1><p class="mut">We'll tune reps, sets, rest and exercise choice around it.</p><div class="col">${Object.entries(GOALS).map(([k, g]) => big('goal', k, g.label, g.desc)).join('')}</div>`,
    `<h1>Training experience?</h1><p class="mut">This sets your starting weights and weekly volume.</p><div class="col">${big('experience', 'beginner', 'Beginner', 'Under 1 year of consistent lifting')}${big('experience', 'intermediate', 'Intermediate', '1–3 years')}${big('experience', 'advanced', 'Advanced', '3+ years, comfortable with heavy compounds')}</div>`,
    `<h1>About you</h1><p class="mut">Used only on this device to estimate starting strength and bodyweight-exercise loads.</p>
      <div class="col"><div class="field"><label>Gender</label><div class="chips">${ch('gender', 'male', 'Male')}${ch('gender', 'female', 'Female')}${ch('gender', 'other', 'Other / skip')}</div></div>
      <div class="field"><label>Units</label><div class="chips">${ch('unit', 'lb', 'lb / ft')}${ch('unit', 'kg', 'kg / cm')}</div></div>
      <div class="grid2"><div class="field"><label>Age</label><input inputmode="numeric" value="${o.age}" data-f="ob" data-k="age"></div><div class="field"><label>Weight (${o.unit})</label><input inputmode="decimal" value="${o.weight}" data-f="ob" data-k="weight"></div></div>
      ${o.unit === 'kg' ? `<div class="field"><label>Height (cm)</label><input inputmode="numeric" value="${o.cm}" data-f="ob" data-k="cm"></div>` : `<div class="grid2"><div class="field"><label>Height (ft)</label><input inputmode="numeric" value="${o.ft}" data-f="ob" data-k="ft"></div><div class="field"><label>(in)</label><input inputmode="numeric" value="${o.inch}" data-f="ob" data-k="inch"></div></div>`}</div>`,
    `<h1>Your schedule</h1><div class="col"><div class="field"><label>Days per week</label><div class="chips">${[2, 3, 4, 5, 6].map(n => ch('days', n, n)).join('')}</div></div>
      <div class="field"><label>Preferred split</label><div class="col gap6">${big('splitPref', 'freshness', 'Smart (by muscle freshness)', 'Picks what is recovered')}${big('splitPref', 'ppl', 'Push / Pull / Legs')}${big('splitPref', 'ul', 'Upper / Lower')}${big('splitPref', 'full', 'Full body')}</div></div>
      <div class="field"><label>Session length</label><div class="chips">${[30, 45, 60, 75, 90].map(n => ch('sessionMin', n, n + ' min')).join('')}</div></div>
      <div class="field"><label>Add a cardio finisher?</label><div class="chips">${ch('cardio', 'true', 'Yes')}${ch('cardio', 'false', 'No')}</div></div></div>`,
    `<h1>Your equipment</h1><p class="mut">The generator only picks exercises you can do. Fine-tune later in More → Equipment.</p><div class="col">${[...Object.keys(GEAR_PRESETS), ...Object.keys(state.gearProfiles)].map(n => big('preset', n, esc(n), GEAR_PRESETS[n] === '*' ? 'Everything incl. machines & cables' : esc((GEAR_PRESETS[n] || Object.keys(state.gearProfiles[n]).filter(k => state.gearProfiles[n][k])).map(gearLabel).join(', ')))).join('')}</div>`
  ];
  const last = o.step === steps.length - 1;
  $('#onboard').innerHTML = `<div class="ob-in"><div class="row sp"><div class="dots">${steps.map((_, i) => `<i class="${i <= o.step ? 'on' : ''}"></i>`).join('')}</div><button class="link" data-a="obSkip">${o.redo ? 'Cancel' : 'Skip'}</button></div>
    <div class="ob-body">${steps[o.step]}</div>
    <div class="row gap6">${o.step ? '<button class="btn sec" data-a="obBack">Back</button>' : ''}<button class="btn pri grow big" data-a="${last ? 'obDone' : 'obNext'}">${last ? 'Build my plan' : 'Continue'}</button></div></div>`;
}
A.obSet = el => {
  const k = el.dataset.k; let v = el.dataset.v;
  if (['days', 'sessionMin'].includes(k)) v = +v; if (k === 'cardio') v = v === 'true';
  if (k === 'unit' && v !== ob.unit) { ob.weight = Math.round(ob.weight * (v === 'kg' ? KG : 1 / KG)); }
  ob[k] = v; paintOb();
};
F.ob = el => { ob[el.dataset.k] = el.value; };
A.obNext = () => { ob.step++; paintOb(); $('#onboard').scrollTop = 0; };
A.obBack = () => { ob.step--; paintOb(); };
A.obSkip = () => { if (!ob.redo) { state.profile.done = true; ensureE1(true); applyGearPreset(state.activeProfile in GEAR_PRESETS ? state.activeProfile : 'Home Gym'); scheduleSave(); generateWorkout(true); } closeOb(); go('workout'); };
function closeOb() {
  $('#onboard').hidden = true; document.body.classList.remove('noscroll');
  if (pendingLink) { const c = pendingLink; pendingLink = null; setTimeout(() => showIncoming(c), 350); }
}
A.obDone = () => {
  const p = state.profile, num = (v, d) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : d; };
  if (ob.unit !== p.unit) setUnit(ob.unit);
  if (ob.days !== p.days) p.trainDays = null;
  Object.assign(p, { done: true, goal: ob.goal, experience: ob.experience, gender: ob.gender, age: clamp(Math.round(num(ob.age, 30)), 12, 99), unit: ob.unit, weight: num(ob.weight, ob.unit === 'kg' ? 80 : 180), days: ob.days, splitPref: ob.splitPref, sessionMin: ob.sessionMin, cardio: ob.cardio });
  p.heightCm = ob.unit === 'kg' ? clamp(num(ob.cm, 175), 100, 250) : Math.round((num(ob.ft, 5) * 12 + num(ob.inch, 9)) * 2.54);
  applyGearPreset(ob.preset);
  ensureE1(!state.history.length);
  state.split = 'auto'; scheduleSave();
  if (!doneSetCount()) generateWorkout(true);
  closeOb(); go('workout'); toast(ob.redo ? 'Profile updated' : 'Your plan is ready');
};

/* ---------- quick (natural-language) logging ---------- */
const NL_STOP = new Set(['lbs', 'lb', 'kg', 'kgs', 'reps', 'rep', 'sets', 'set', 'of', 'at', 'for', 'with', 'did', 'the', 'and', 'on', 'my', 'today', 'pounds', 'minutes', 'mins', 'min', 'miles', 'mile', 'km', 'mi', 'in', 'rpe', 'rir', 'then']);
const NL_MAP = { db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', dl: 'deadlift', ohp: 'overhead press', rdl: 'romanian deadlift', ran: 'run', running: 'run', jog: 'run', jogging: 'run', biked: 'bike', biking: 'bike', cycled: 'bike', walked: 'walk', walking: 'walk', swam: 'swim', rowed: 'row', bp: 'bench' };
function nlToks(s) {
  s = s.toLowerCase().replace(/pull[\s-]?ups?|chin[\s-]?ups?/g, 'pullup').replace(/push[\s-]?ups?/g, 'pushup').replace(/sit[\s-]?ups?/g, 'crunch').replace(/[-_/]/g, ' ');
  return s.split(/[^a-z]+/).filter(Boolean).flatMap(t => (NL_MAP[t] || t).split(' ')).filter(t => t.length > 1 && !NL_STOP.has(t));
}
const NL_PREF = { bench: 'bb_bench', squat: 'bb_squat', row: 'bb_row', curl: 'bb_curl', deadlift: 'deadlift', pullup: 'pullups', pushup: 'pushups', dip: 'dips', dips: 'dips', run: 'cardio_run', walk: 'cardio_walk', bike: 'cardio_bike', swim: 'cardio_swim', overhead: 'ohp', press: 'ohp', pulldown: 'lat_pulldown', crunch: 'crunch', rower: 'cardio_row', elliptical: 'cardio_elliptical' };
function matchEx(txt) {
  const q = nlToks(txt); if (!q.length) return null;
  let best = null, bs = 0;
  allEx().forEach(ex => {
    const nt = nlToks(ex.name + ' ' + (ex.alias || ''));
    const hits = q.filter(t => nt.some(n => n.startsWith(t) || (n.length > 3 && t.startsWith(n)))).length;
    if (!hits || hits < Math.ceil(q.length / 2)) return;
    const sc = hits * 10 - (new Set(nt).size - hits) * .6 + (q.some(t => NL_PREF[t] === ex.id) ? 4 : 0) - (hasGear(ex) ? 0 : 3) + (ex.custom ? 1 : 0);
    if (sc > bs) { bs = sc; best = ex; }
  });
  return best;
}
function parseLine(raw) {
  let t = ' ' + raw.toLowerCase().replace(/×/g, 'x').replace(/(\d),(\d)/g, '$1.$2') + ' ';
  const out = { raw };
  const take = (re, fn) => { const m = t.match(re); if (m) { fn(m); t = t.replace(m[0], ' '); } return !!m; };
  take(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/, m => out.min = +m[1]);
  take(/(\d+(?:\.\d+)?)\s*(?:miles?|mi|km|kilometers?)\b/, m => out.dist = +m[1]);
  if (!out.min && !out.dist) {
    const u = '\\s*(?:lbs?|kgs?|#)?';
    if (!take(new RegExp('(\\d+(?:\\.\\d+)?)' + u + '\\s*x\\s*(\\d+)\\s*x\\s*(\\d+)'), m => { let a = +m[1], b = +m[2], c = +m[3]; if (a <= 10 && c > 20) { out.sets = a; out.r = b; out.w = c; } else { out.w = a; out.r = b; out.sets = c; } })
      && !take(/(\d+)\s*x\s*(\d+)\s*(?:@|at|with|w\/)\s*(\d+(?:\.\d+)?)/, m => { out.sets = +m[1]; out.r = +m[2]; out.w = +m[3]; })
      && !take(/(\d+)\s*sets?\s*(?:of|x)\s*(\d+)(?:\s*reps?)?(?:\s*(?:@|at|with)\s*(\d+(?:\.\d+)?))?/, m => { out.sets = +m[1]; out.r = +m[2]; if (m[3]) out.w = +m[3]; })
      && !take(new RegExp('(\\d+(?:\\.\\d+)?)' + u + '\\s*(?:x|for)\\s*(\\d+)(?:\\s*reps?)?'), m => { out.w = +m[1]; out.r = +m[2]; out.sets = 1; out.amb = !/lbs?|kgs?|#/.test(m[0]) && /^\d+$/.test(m[1]) && +m[1] <= 10; })
      && !take(/(\d+)\s*x\s*(\d+)/, m => { out.sets = +m[1]; out.r = +m[2]; })) { }
    take(/(?:@|rpe)\s*(\d+(?:\.\d)?)/, m => { const r = +m[1]; if (r >= 5 && r <= 10) out.rir = clamp(Math.round(10 - r), 0, 4); });
    take(/rir\s*(\d)/, m => out.rir = clamp(+m[1], 0, 4));
    if (out.w === undefined && out.r !== undefined) { const m = t.match(/(\d+(?:\.\d+)?)/); if (m) { out.w = +m[1]; t = t.replace(m[0], ' '); } }
  }
  const ex = matchEx(t.replace(/[\d.@x]+/g, ' '));
  if (!ex) { out.err = 'Couldn’t match an exercise'; return out; }
  out.ex = ex;
  if (out.amb && !ex.cardio) {      // “pullups 3x10” means 3 sets of 10, not 3 lb for 10 reps
    const lw = ((lastPerf(ex.id) || []).find(x => x.type === 'work') || {}).w;
    out.sets = out.w; out.w = ex.bw !== undefined ? 0 : (lw != null ? lw : recWeight(ex, out.r, 2));
  }
  if (ex.cardio) { if (!out.min && !out.dist) out.err = 'Add minutes or distance (e.g. “run 3 miles in 28 min”)'; return out; }
  if (out.r === undefined) { out.err = 'Add reps (e.g. “185x8x3”)'; return out; }
  out.w = out.w || 0; out.sets = out.sets || 1;
  if (out.min || out.dist) out.err = 'Mixed strength and cardio info';
  return out;
}
function parseNL(text) { return text.split(/[\n;]+|,(?!\d)|\band\b(?=\s+[a-z])/i).map(s => s.trim()).filter(Boolean).map(parseLine); }
/* ---------- quick log: type it in, or pick from the exercise list, on any day ---------- */
let ql = null;
function qlTs() {
  const [y, m, d] = String(ql.date || ymd(Date.now())).split('-').map(Number), n = new Date(), t = new Date(y, m - 1, d, n.getHours(), n.getMinutes()).getTime();
  return Number.isFinite(t) ? Math.min(t, Date.now()) : Date.now();
}
const qlIsToday = () => !ql.date || ql.date >= ymd(Date.now());
const qlDayLabel = () => qlIsToday() ? 'today' : fmtDate(qlTs(), { weekday: 'short', month: 'short', day: 'numeric' });
const qlSummary = r => r.ex.cardio
  ? `${r.min || 0} min${r.dist ? ' · ' + r.dist + (unit() === 'kg' ? ' km' : ' mi') : ''}`
  : `${r.sets} × ${r.r} @ ${r.w} ${unit()}${r.fail ? ' · to failure' : r.rir !== undefined ? ' · ' + (state.settings.rpe ? 'RPE ' + (10 - r.rir) : r.rir + ' RIR') : ''}`;

A.nl = () => {
  const today = ymd(Date.now());
  ql = { mode: 'type', date: today, entries: [], f: wk().items.length ? 'today' : 'all', q: '', sel: null, text: '' };
  openSheet('Quick log', `<div class="col">
    <div class="field"><label>Day</label><div class="row gap6"><input type="date" id="ql-date" style="flex:1" value="${today}" max="${today}" data-f="qlDate"><button class="mini" data-a="qlDay" data-d="0">Today</button><button class="mini" data-a="qlDay" data-d="1">Yesterday</button></div></div>
    <div class="seg"><button id="ql-m-type" data-a="qlMode" data-v="type">Type it in</button><button id="ql-m-pick" data-a="qlMode" data-v="pick">Choose exercise</button></div>
    <div id="ql-pane" class="col"></div><div id="ql-list" class="col gap6"></div><div id="ql-foot"></div></div>`);
  paintQL();
};
function paintQL() {
  $('#ql-m-type').classList.toggle('on', ql.mode === 'type'); $('#ql-m-pick').classList.toggle('on', ql.mode === 'pick');
  paintQLPane(); paintQLList();
}
function paintQLPane() {
  const pane = $('#ql-pane'), x = ql.sel;
  if (ql.mode === 'type') {
    pane.innerHTML = `<p class="mut sm">Type what you did. Separate entries with commas or new lines.</p>
      <textarea id="ql-text" rows="3" data-f="qlText" autocapitalize="none" placeholder="bench 185x8x3, squat 3x5 at 225&#10;ran 2 miles in 18 min">${esc(ql.text)}</textarea>
      <div class="chips scrollx"><button class="chip" data-a="qlEx" data-v="bench 185x8x3">bench 185x8x3</button><button class="chip" data-a="qlEx" data-v="squat 3x5 at 225 @8">squat 3x5 at 225 @8</button><button class="chip" data-a="qlEx" data-v="pullups 3x10">pullups 3x10</button><button class="chip" data-a="qlEx" data-v="bike 25 min">bike 25 min</button></div>
      <button class="btn sec full" data-a="qlParse">Add to list</button>`;
  } else if (x) {
    const ex = x.ex;
    pane.innerHTML = `<div class="row sp"><b>${esc(ex.name)}</b><button class="link" data-a="qlBack">Change</button></div>` + (ex.cardio
      ? `<div class="grid2"><div class="field"><label>Minutes</label><input inputmode="decimal" value="${esc(x.min)}" data-f="qlN" data-k="min"></div>${ex.dist ? `<div class="field"><label>Distance (${unit() === 'kg' ? 'km' : 'mi'})</label><input inputmode="decimal" value="${esc(x.dist)}" data-f="qlN" data-k="dist" placeholder="optional"></div>` : '<div></div>'}</div>`
      : `<div class="grid3"><div class="field"><label>Sets</label><input inputmode="numeric" value="${esc(x.sets)}" data-f="qlN" data-k="sets"></div><div class="field"><label>Reps</label><input inputmode="numeric" value="${esc(x.r)}" data-f="qlN" data-k="r"></div><div class="field"><label>${unit()}</label><input inputmode="decimal" value="${esc(x.w)}" data-f="qlN" data-k="w"></div></div>
        <div class="field"><label>Effort</label><select data-f="qlN" data-k="rir">${rirOpts(x.fail ? 'F' : x.rir)}</select></div>${ex.bw ? '<p class="mut xs">Weight is added load only (bodyweight is counted for you).</p>' : ''}`)
      + `<button class="btn pri full" data-a="qlAdd">Add to list</button>`;
  } else {
    pane.innerHTML = `<input id="ql-q" type="search" placeholder="Search exercises…" data-f="qlq" autocomplete="off" value="${esc(ql.q)}"><div class="chips scrollx" id="ql-f"></div><div id="ql-ex" class="col gap6"></div>`;
    paintQLEx();
  }
}
function paintQLEx() {
  const inW = new Set(wk().items.map(x => x.exId));
  const fs = [...(inW.size ? [['today', 'In today’s workout']] : []), ['all', 'All'], ...CHIPS_EXTRA, ...MUSCLES.map(m => [m, m]), ['Cardio', 'Cardio']];
  if (ql.f === 'today' && !inW.size) ql.f = 'all';
  $('#ql-f').innerHTML = fs.map(([k, l]) => `<button class="chip ${ql.f === k ? 'on' : ''}" data-a="qlF" data-v="${k}">${l}</button>`).join('');
  const q = ql.q.trim().toLowerCase();
  let list = allEx();
  if (ql.f === 'today') list = list.filter(e => inW.has(e.id)); else if (ql.f !== 'all') list = byChip(list, ql.f);
  if (q) list = list.filter(e => (e.name + ' ' + e.primary + ' ' + (e.alias || '')).toLowerCase().includes(q));
  exRank(list);
  $('#ql-ex').innerHTML = list.slice(0, 400).map(e => `<button class="prow" data-a="qlPick" data-id="${e.id}"><div class="grow"><b>${isFav(e.id) ? ic('star', 'fill fav') + ' ' : ''}${esc(e.name)}</b><div class="mut xs">${esc(e.primary)}</div></div><span class="mut xs">${esc(lastLine(e.id))}</span></button>`).join('')
    || '<div class="empty">No matches. Use “Type it in” for anything else.</div>';
}
function paintQLList() {
  const n = ql.entries.length;
  $('#ql-list').innerHTML = n ? `<div class="lbl pt8">To log (${n})</div>` + ql.entries.map((r, i) => `<div class="prow static"><div class="grow"><b>${esc(r.ex.name)}</b><div class="mut xs">${esc(qlSummary(r))}</div></div><button class="mini" data-a="qlDel" data-i="${i}" aria-label="Remove">${ic('close')}</button></div>`).join('') : '';
  $('#ql-foot').innerHTML = `<button class="btn pri full big" data-a="qlGo" ${n ? '' : 'disabled'}>${n ? `Log ${n} entr${n > 1 ? 'ies' : 'y'} to ${esc(qlDayLabel())}` : 'Add something to log'}</button>`;
}
F.qlDate = el => { if (el.value) ql.date = el.value; paintQLList(); };
F.qlText = el => { ql.text = el.value; };
F.qlq = el => { ql.q = el.value; paintQLEx(); };
F.qlN = el => {
  const x = ql.sel; if (!x) return; const k = el.dataset.k;
  if (k === 'rir') { if (el.value === 'F') { x.fail = true; x.rir = 0; } else { x.fail = false; x.rir = +el.value; } } else x[k] = el.value;
};
A.qlDay = el => { const d = new Date(); d.setDate(d.getDate() - +el.dataset.d); ql.date = ymd(d); $('#ql-date').value = ql.date; paintQLList(); };
A.qlMode = el => { ql.mode = el.dataset.v; ql.sel = null; paintQL(); };
A.qlEx = el => { const i = $('#ql-text'); i.value = (i.value ? i.value + '\n' : '') + el.dataset.v; ql.text = i.value; };
A.qlF = el => { ql.f = el.dataset.v; paintQLEx(); };
A.qlBack = () => { ql.sel = null; paintQLPane(); };
A.qlDel = el => { ql.entries.splice(+el.dataset.i, 1); paintQLList(); };
A.qlPick = el => {
  const ex = exById(el.dataset.id); if (!ex) return;
  if (ex.cardio) ql.sel = { ex, min: ex.defaultMin, dist: '' };
  else {
    const g = GOALS[state.profile.goal] || GOALS.muscle, ws = (lastPerf(ex.id) || []).filter(s => s.type === 'work'), reps = ws[0] ? ws[0].r : (ex.type === 'compound' ? g.cReps : g.iReps);
    ql.sel = { ex, sets: ws.length || 3, r: reps, w: ws[0] ? ws[0].w : recWeight(ex, reps, 2), rir: 2, fail: false };
  }
  paintQLPane();
};
A.qlAdd = () => {
  const x = ql.sel, ex = x.ex, num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
  if (ex.cardio) { const min = num(x.min), dist = num(x.dist); if (!min && !dist) { toast('Add minutes or distance'); return; } ql.entries.push({ ex, min, dist }); }
  else { const r = Math.round(num(x.r)); if (!r) { toast('Enter the reps'); return; } ql.entries.push({ ex, sets: clamp(Math.round(num(x.sets)) || 1, 1, 20), r, w: num(x.w), rir: x.rir, fail: !!x.fail }); }
  ql.sel = null; paintQL(); toast(ex.name + ' added');
};
A.qlParse = () => {
  const ta = $('#ql-text'), rows = parseNL(ta.value);
  if (!rows.length) { toast('Type something first'); return; }
  const ok = rows.filter(r => !r.err), bad = rows.filter(r => r.err);
  ok.forEach(r => ql.entries.push(r));
  ta.value = ql.text = bad.map(r => r.raw).join('\n');
  paintQLList();
  toast(bad.length ? `${ok.length} added · couldn’t read “${bad[0].raw}”: ${bad[0].err}` : `${ok.length} added`, bad.length ? 5000 : 2600);
};
function logQLToday(list) {
  const prs = [];
  list.forEach(r => {
    const ex = r.ex;
    if (ex.cardio) {
      let it = wk().items.find(x => x.cardio && x.exId === ex.id && !x.done);
      if (!it) { it = buildItem(ex, {}); wk().items.push(it); }
      it.min = r.min || it.min; it.dist = r.dist || 0; it.done = true; return;
    }
    let it = wk().items.find(x => !x.cardio && x.exId === ex.id);
    if (!it) { it = { id: uid(), exId: ex.id, superset: null, tempo: ex.tempo, sets: [] }; wk().items.push(it); }
    for (let k = 0; k < r.sets; k++) {
      let s = it.sets.find(x => !x.done && x.type === 'work');
      if (!s) { s = { type: 'work', fail: false, done: false }; it.sets.push(s); }
      Object.assign(s, { weight: r.w, reps: r.r, rir: r.rir ?? 2, fail: !!r.fail });
      const pr = applySetDone(it, s, ex); if (pr) prs.push(pr);
    }
  });
  ensureStarted();
  return prs;
}
function logQLPast(list, t) {      // saved straight to history on the chosen day
  const hrs = Math.max(0, (Date.now() - t) / 36e5), prevLast = {}, touched = new Set(), items = [], cardio = [];
  MUSCLES.forEach(m => prevLast[m] = state.muscles[m].lastTrained || 0);
  let sets = 0, vol = 0, prs = 0;
  list.forEach(r => {
    const ex = r.ex;
    if (ex.cardio) { cardio.push({ exId: ex.id, name: ex.name, min: +r.min || 0, dist: +r.dist || 0 }); return; }
    const out = []; let best = 0;
    for (let k = 0; k < r.sets; k++) {
      const s = { weight: r.w, reps: r.r, rir: r.rir ?? 2, fail: !!r.fail, type: 'work' }, prevE = state.e1rm[ex.id];
      applySetDone(null, s, ex);
      if (!ex.noE1) { const e = est1(ex, s); state.e1rm[ex.id] = Math.max(prevE || 0, Math.round(e)); best = Math.max(best, e); }   // an old workout never drags today's e1RM down
      if (s.pr && state.prs[ex.id]) state.prs[ex.id].t = t;
      Object.keys(s.fx || {}).forEach(m => touched.add(m));
      out.push({ w: +r.w || 0, r: +r.r || 0, rir: +(r.rir ?? 2), fail: !!r.fail, type: 'work', pct: s.pct ?? null });
      sets++; vol += setVol(ex, s); if (s.pr) prs++;
    }
    items.push({ exId: ex.id, name: ex.name, p: ex.primary, s: ex.secondary || [], sets: out });
    if (best > 0) { const h = (state.e1rmHist[ex.id] = state.e1rmHist[ex.id] || []); h.push({ t, v: Math.round(best) }); h.sort((a, b) => a.t - b.t); }
  });
  touched.forEach(m => { const mu = state.muscles[m]; mu.recovery = clamp(mu.recovery + hrs * 1.25, 0, 100); mu.lastTrained = Math.max(prevLast[m], t); });   // fatigue from that day has partly recovered
  state.history.push({ id: uid(), t, name: 'Quick log', split: '', sets, vol: Math.round(vol), dur: 0, unit: unit(), prs, items, cardio, manual: true });
  state.history.sort((a, b) => b.t - a.t); state.history = state.history.slice(0, 400);
}
A.qlGo = () => {
  const dv = $('#ql-date'); if (dv && dv.value) ql.date = dv.value;
  const list = ql.entries; if (!list.length) return;
  const n = list.length, label = qlDayLabel();
  let prs = [];
  if (qlIsToday()) prs = logQLToday(list); else logQLPast(list, qlTs());
  normSS(); scheduleSave(); closeSheet(); cue('set');
  if (tab === 'workout') renderWorkout(); else if (tab === 'progress') renderProgress();
  toast(`Logged ${n} entr${n === 1 ? 'y' : 'ies'} to ${label}`);
  prs.forEach(showPR);
};

/* ---------- routines / templates / sharing (opt-in, manual) ---------- */
function saveTemplate(name, items) { state.templates.unshift({ id: uid(), name, items, t: Date.now() }); scheduleSave(); toast('Routine saved'); if (tab === 'more') renderMore(); }
A.tplOpen = () => {
  openSheet('Routines', `<div class="col">${state.templates.length ? state.templates.map(t => `<div class="prow static"><div class="grow"><b>${esc(t.name)}</b><div class="mut xs">${t.items.length} exercises</div></div>
    <button class="mini pri" data-a="tplStart" data-id="${t.id}">Start</button><button class="mini" data-a="tplShare" data-id="${t.id}">Share</button><button class="mini" data-a="tplDel" data-id="${t.id}">${ic('close')}</button></div>`).join('') : '<div class="empty">No routines yet. Save your current session as one.</div>'}
    <button class="btn sec full" data-a="tplSaveCur">Save current workout as routine</button><button class="btn sec full" data-a="tplImport">Import routine code</button></div>`);
};
A.tplSaveCur = () => ask('Save routine', 'Routine name', wk().name.replace(' Session', ''), n => saveTemplate(n, wk().items.filter(it => !it.cardio).map(it => ({ exId: it.exId, superset: it.superset, sets: it.sets.filter(s => s.type !== 'warmup').map(s => ({ w: +s.weight, r: +s.reps })) }))));
A.tplDel = el => { state.templates = state.templates.filter(t => t.id !== el.dataset.id); scheduleSave(); A.tplOpen(); if (tab === 'more') renderMore(); };
A.tplStart = el => {
  const t = state.templates.find(x => x.id === el.dataset.id); if (!t) return;
  if (doneSetCount() && !confirm('Replace your current session?')) return;
  const items = t.items.filter(i => exById(i.exId)).map(i => { const ex = exById(i.exId); return { id: uid(), exId: i.exId, superset: i.superset || null, tempo: ex.tempo, sets: i.sets.map(s => ({ weight: s.w, reps: s.r, rir: 2, fail: false, done: false, type: 'work' })) }; });
  state.workout = carrySession(wk(), { startedAt: null, name: t.name, split: '', note: 'From your routine', items }); normSS(); scheduleSave(); closeSheet(); go('workout');
};
const tplPayload = t => { const ids = new Set(t.items.map(i => i.exId)), custom = state.customExercises.filter(c => ids.has(c.id)); return JSON.stringify({ n: t.name, i: t.items, c: custom }); };
const b64 = str => btoa(unescape(encodeURIComponent(str)));
const encodeTpl = t => 'FF1:' + b64(tplPayload(t));
const tplLink = t => location.origin + location.pathname + '#ff1=' + b64(tplPayload(t)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decodeTpl(str) {            // accepts a pasted "FF1:" code (even inside a message) or the url-safe part of a link
  const m = String(str).match(/(?:FF1:|#?ff1=)([A-Za-z0-9+/_=-]+)/); if (!m) throw 0;
  return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
}
function importTplObject(o) {
  (o.c || []).forEach(c => { if (c && c.id && !exById(c.id)) state.customExercises.push(sanitizeCustom(c)); }); resetExCache();
  const items = (o.i || []).filter(i => exById(i.exId)).map(i => ({ exId: String(i.exId), superset: null, sets: (i.sets || []).slice(0, 12).map(s => ({ w: Math.max(0, +s.w || 0), r: clamp(+s.r || 8, 1, 100) })) }));
  if (!items.length) throw 0;
  saveTemplate(String(o.n || 'Imported routine').slice(0, 60), items); ensureE1();
}
A.tplShare = el => {
  const t = state.templates.find(x => x.id === el.dataset.id); if (!t) return;
  window.__shareTpl = t; const web = /^https?:/.test(location.protocol);
  openSheet('Share routine', `<div class="col"><div class="prow static"><div class="grow"><b>${esc(t.name)}</b><div class="mut xs">${t.items.length} exercises</div></div></div>
    ${web ? '<button class="btn pri full big" data-a="tplSendLink">Send link</button><button class="btn sec full" data-a="tplCopyLink">Copy link</button>' : ''}
    <button class="btn ${web ? 'sec' : 'pri'} full" data-a="tplCopyCode">Copy code</button>
    <p class="mut xs">${web ? 'The link opens ForgeFit and offers to add the routine. ' : 'Open the hosted app to share a link instead. '}On iPhone, links open in Safari, which has separate storage from the Home Screen app. If the other person uses the Home Screen app, send the code and they paste it in Routines → Import.</p></div>`);
};
A.tplSendLink = () => { const t = window.__shareTpl; if (t) shareText(`${t.name}: a ForgeFit routine. Open this link to add it:\n${tplLink(t)}`, t.name); };
A.tplCopyLink = () => { const t = window.__shareTpl; if (t) copyText(tplLink(t), 'Link copied'); };
A.tplCopyCode = () => { const t = window.__shareTpl; if (t) copyText(encodeTpl(t), 'Code copied'); };
A.tplImport = () => openSheet('Import routine', `<div class="col"><p class="mut sm">Paste a code that starts with FF1: (or a whole message that contains it)</p><textarea id="tpl-code" rows="4"></textarea><button class="btn pri full" data-a="tplImportGo">Import</button></div>`);
A.tplImportGo = () => { try { importTplObject(decodeTpl($('#tpl-code').value)); closeSheet(); } catch (e) { toast('That code didn’t look right'); } };
/* opening a shared link: ForgeFit asks before saving anything */
let pendingLink = null;
function checkHashImport() {
  const m = location.hash.match(/^#ff1=([A-Za-z0-9_-]+)/); if (!m) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  if (!state.profile.done) { pendingLink = m[1]; return; }
  showIncoming(m[1]);
}
function showIncoming(code) {
  try {
    const o = decodeTpl('ff1=' + code), n = (o.i || []).filter(i => exById(i.exId) || (o.c || []).some(c => c && c.id === i.exId)).length;
    if (!n) throw 0;
    window.__incoming = o; window.__incomingCode = 'FF1:' + code.replace(/-/g, '+').replace(/_/g, '/');
    openSheet('Routine shared with you', `<div class="col"><div class="prow static"><div class="grow"><b>${esc(String(o.n || 'Routine').slice(0, 60))}</b><div class="mut xs">${n} exercises</div></div></div>
      <button class="btn pri full big" data-a="incomingSave">Save to my routines</button>
      <button class="btn sec full" data-a="incomingCopy">Copy code (for the Home Screen app)</button>
      <p class="mut xs">On iPhone, links open in Safari, which keeps its own storage separate from the app on your Home Screen. If you use the Home Screen app, copy the code, open ForgeFit from your Home Screen and paste it in Routines → Import routine.</p></div>`);
  } catch (e) { toast('That shared link didn’t look right'); }
}
A.incomingSave = () => { try { importTplObject(window.__incoming); closeSheet(); } catch (e) { toast('Couldn’t read that routine'); } };
A.incomingCopy = () => copyText(window.__incomingCode, 'Code copied');

/* ---------- custom exercises & equipment ---------- */
let cx = null;
function sanitizeCustom(c) {
  const prim = MUSCLES.includes(c.primary) ? c.primary : 'Chest', type = ['compound', 'isolation', 'bodyweight'].includes(c.type) ? c.type : 'compound';
  return { id: String(c.id).slice(0, 30), name: String(c.name || 'Custom').slice(0, 60), primary: prim, secondary: (c.secondary || []).filter(m => MUSCLES.includes(m) && m !== prim), split: SPLIT_OF[prim].split(' '), gear: (c.gear || []).map(String).slice(0, 6), default1RM: 100, reps: clamp(+c.reps || 10, 1, 50), sets: clamp(+c.sets || 3, 1, 10), type, cue: 'Custom exercise', tempo: TEMPO_DEF[type], custom: true, ...(type === 'bodyweight' ? { bw: 0, noE1: true } : {}) };
}
function openCustom(name) { cx = { name: name || '', primary: 'Chest', secondary: [], gear: [], type: 'compound', sets: 3, reps: 10, w: '', add: false }; paintCustom(); }
function paintCustom(first) {
  const chip = (act, v, on, l) => `<button class="chip ${on ? 'on' : ''}" data-a="${act}" data-v="${v}">${l || v}</button>`;
  const html = `<div class="col"><div class="field"><label>Name</label><input id="cx-name" value="${esc(cx.name)}" data-f="cxName" placeholder="e.g. Hammer Strength Row" autocomplete="off"></div>
    <div class="field"><label>Primary muscle</label><div class="chips">${MUSCLES.map(m => chip('cxPrimary', m, cx.primary === m)).join('')}</div></div>
    <div class="field"><label>Secondary muscles (optional)</label><div class="chips">${MUSCLES.filter(m => m !== cx.primary).map(m => chip('cxSec', m, cx.secondary.includes(m))).join('')}</div></div>
    <div class="field"><label>Equipment needed (optional)</label><div class="chips">${Object.keys(state.gear).map(g => chip('cxGear', g, cx.gear.includes(g), gearLabel(g))).join('')}</div></div>
    <div class="field"><label>Type</label><div class="chips">${chip('cxType', 'compound', cx.type === 'compound', 'Compound')}${chip('cxType', 'isolation', cx.type === 'isolation', 'Isolation')}${chip('cxType', 'bodyweight', cx.type === 'bodyweight', 'Bodyweight')}</div></div>
    <div class="grid3"><div class="field"><label>Sets</label><input inputmode="numeric" value="${cx.sets}" data-f="cxN" data-k="sets"></div><div class="field"><label>Reps</label><input inputmode="numeric" value="${cx.reps}" data-f="cxN" data-k="reps"></div><div class="field"><label>Start wt (${unit()})</label><input inputmode="decimal" value="${cx.w}" data-f="cxN" data-k="w" placeholder="opt."></div></div>
    <div class="grid2"><button class="btn sec" data-a="cxSave" data-add="0">Save</button><button class="btn pri" data-a="cxSave" data-add="1">Save &amp; add to workout</button></div></div>`;
  if (first === undefined && !$('#cx-name')) openSheet('New exercise', html); else sheetBody(html);
}
A.newCustom = () => { const nm = (pick && pick.q) || ''; openCustom(nm); };
F.cxName = el => { cx.name = el.value; };
F.cxN = el => { cx[el.dataset.k] = el.value; };
A.cxPrimary = el => { cx.primary = el.dataset.v; cx.secondary = cx.secondary.filter(m => m !== cx.primary); paintCustom(0); };
A.cxSec = el => { const m = el.dataset.v, i = cx.secondary.indexOf(m); i < 0 ? cx.secondary.push(m) : cx.secondary.splice(i, 1); paintCustom(0); };
A.cxGear = el => { const g = el.dataset.v, i = cx.gear.indexOf(g); i < 0 ? cx.gear.push(g) : cx.gear.splice(i, 1); paintCustom(0); };
A.cxType = el => { cx.type = el.dataset.v; paintCustom(0); };
A.cxSave = el => {
  const name = cx.name.trim(); if (!name) { toast('Give it a name'); return; }
  const ex = sanitizeCustom({ ...cx, id: 'c_' + uid(), name }); state.customExercises.push(ex); resetExCache();
  const w = parseFloat(String(cx.w).replace(',', '.'));
  if (!ex.noE1) state.e1rm[ex.id] = w > 0 ? Math.round(w * (1 + ex.reps / 30)) : seedE1(ex);
  if (el.dataset.add === '1') { wk().items.push(buildItem(ex, {})); normSS(); }
  scheduleSave(); closeSheet(); toast(`${ex.name} created`); if (tab === 'workout') renderWorkout(); if (tab === 'more') renderMore();
};
A.cxDel = el => {
  const id = el.dataset.id; if (!confirm('Delete this custom exercise? Past history is kept.')) return;
  state.customExercises = state.customExercises.filter(c => c.id !== id); wk().items = wk().items.filter(i => i.exId !== id); resetExCache(); normSS(); scheduleSave(); renderMore();
};
A.gearToggle = el => { const k = el.dataset.k; state.gear[k] = !state.gear[k]; state.activeProfile = 'Custom'; scheduleSave(); renderMore(); };
A.gearPreset = el => { applyGearPreset(el.dataset.v); scheduleSave(); renderMore(); toast(el.dataset.v + ' loaded'); };
A.gearAdd = () => ask('Add equipment', 'Equipment name', '', n => { const k = n.replace(/[^\w \-]/g, '').slice(0, 24); if (!k) return; state.gear[k] = true; scheduleSave(); renderMore(); });
A.gearSave = () => ask('Save equipment profile', 'Profile name (e.g. Hotel gym)', '', n => { state.gearProfiles[n] = { ...state.gear }; state.activeProfile = n; scheduleSave(); renderMore(); toast('Profile saved'); });
A.gearDelProfile = el => { delete state.gearProfiles[el.dataset.v]; scheduleSave(); renderMore(); };

/* ---------- charts ---------- */
function lineChart(pts, o = {}) {
  if (!pts.length) return '<div class="empty">No data yet.</div>';
  const w = 340, h = o.h || 170, pl = 40, pr = 12, pt = 12, pb = 22, fmt = o.fmt || (v => Math.round(v * 10) / 10);
  let x0 = Math.min(...pts.map(p => p.t)), x1 = Math.max(...pts.map(p => p.t)); if (x0 === x1) { x0 -= DAY; x1 += DAY; }
  const ys = pts.map(p => p.v); let y0 = Math.min(...ys), y1 = Math.max(...ys); const py = (y1 - y0) * .2 || Math.max(1, y1 * .05); y0 -= py; y1 += py;
  const X = t => pl + (t - x0) / (x1 - x0) * (w - pl - pr), Y = v => pt + (1 - (v - y0) / (y1 - y0)) * (h - pt - pb);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  const area = d + ` L${X(pts[pts.length - 1].t).toFixed(1)} ${h - pb} L${X(pts[0].t).toFixed(1)} ${h - pb} Z`;
  const ticks = [y0 + py, (y0 + y1) / 2, y1 - py].map(v => `<text x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${fmt(v)}</text><line x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Trend chart"><g class="grid">${ticks}</g><path d="${area}" class="area"/><path d="${d}" class="ln"/>
    ${pts.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3"/>`).join('')}
    <text class="xl" x="${pl}" y="${h - 5}">${fmtDate(Math.min(...pts.map(p => p.t)))}</text><text class="xl" x="${w - pr}" y="${h - 5}" text-anchor="end">${fmtDate(Math.max(...pts.map(p => p.t)))}</text></svg>`;
}

/* ---------- progress tab ---------- */
let prog = { ex: null, range: 90, heat: 'vol' };
function heatData(days) {
  const d0 = sod(Date.now()), out = {}; MUSCLES.forEach(m => out[m] = Array.from({ length: days }, () => ({ sets: 0, pcts: [] })));
  state.history.forEach(h => {
    const idx = Math.round((d0 - sod(h.t)) / DAY); if (idx < 0 || idx >= days) return; const col = days - 1 - idx;
    (h.items || []).forEach(i => i.sets.forEach(s => {
      if (s.type === 'warmup') return;
      if (out[i.p]) { out[i.p][col].sets += 1; if (s.pct) out[i.p][col].pcts.push(s.pct); }
      (i.s || []).forEach(m => { if (out[m]) out[m][col].sets += .5; });
    }));
  });
  return out;
}
function renderProgress() {
  const hist = state.history, now = Date.now(), m30 = hist.filter(h => h.t > now - 30 * DAY && h.items && h.items.length);
  const ids = Object.keys(state.e1rmHist).filter(id => exById(id) && state.e1rmHist[id].length).sort((a, b) => state.e1rmHist[b].length - state.e1rmHist[a].length);
  if (!prog.ex || !ids.includes(prog.ex)) prog.ex = ids[0] || null;
  const pts = prog.ex ? state.e1rmHist[prog.ex].filter(p => !prog.range || p.t > now - prog.range * DAY) : [];
  const first = pts[0], lastP = pts[pts.length - 1], delta = pts.length > 1 ? Math.round((lastP.v - first.v) / first.v * 1000) / 10 : null;
  const days = 14, hd = heatData(days), tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  const cell = c => {
    let a = 0; if (prog.heat === 'vol') a = clamp(c.sets / 6, 0, 1); else if (c.pcts.length) a = clamp((c.pcts.reduce((x, y) => x + y, 0) / c.pcts.length - .5) / .5, .15, 1);
    return `<i style="${a ? `background:rgba(249,115,22,${(.15 + a * .85).toFixed(2)})` : ''}" title="${prog.heat === 'vol' ? c.sets + ' sets' : c.pcts.length ? Math.round(c.pcts.reduce((x, y) => x + y, 0) / c.pcts.length * 100) + '% of e1RM' : ''}"></i>`;
  };
  const ws4 = weeklySets(4), sk = streakInfo();
  $('#tab-progress').innerHTML = `
    <div class="tiles t4">${tile(m30.length, 'Sessions · 30d')}${tile(m30.reduce((a, h) => a + (h.vol || 0), 0).toLocaleString(), unit() + ' volume · 30d')}${tile(m30.reduce((a, h) => a + (h.prs || 0), 0), 'PRs · 30d')}${tile(sk.streak ? ic('flame') + ' ' + sk.streak : sk.curN + '/' + sk.goal, sk.streak ? 'Week streak' : 'This week')}</div>
    ${progTools()}
    <div class="card"><div class="row sp"><h2 class="h2">Strength curve</h2><select data-f="progRange" class="sel-sm"><option value="30" ${prog.range === 30 ? 'selected' : ''}>1 month</option><option value="90" ${prog.range === 90 ? 'selected' : ''}>3 months</option><option value="365" ${prog.range === 365 ? 'selected' : ''}>1 year</option><option value="0" ${prog.range === 0 ? 'selected' : ''}>All time</option></select></div>
      ${ids.length ? `<select data-f="progEx">${ids.map(id => `<option value="${id}" ${id === prog.ex ? 'selected' : ''}>${esc(exById(id).name)}</option>`).join('')}</select>
      <div class="row sp pt8"><div><div class="mut xs">Estimated 1RM</div><b class="big or">${lastP ? lastP.v : '—'} ${unit()}</b></div><div class="right"><div class="mut xs">Change</div><b class="${delta > 0 ? 'gr' : delta < 0 ? 'rd' : ''}">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta + '%'}</b></div></div>${lineChart(pts)}<button class="btn sec full mt8" data-a="exHist" data-id="${prog.ex}">${ic('trend')} Full history for this lift</button>`
      : '<div class="empty">Finish a session with logged sets and your e1RM curve will appear here.</div>'}</div>
    ${bodyVsStrength()}
    <div class="card"><div class="row sp"><h2 class="h2">Muscle heatmap</h2><div class="chips"><button class="chip ${prog.heat === 'vol' ? 'on' : ''}" data-a="heat" data-v="vol">Volume</button><button class="chip ${prog.heat === 'int' ? 'on' : ''}" data-a="heat" data-v="int">Intensity</button></div></div>
      <p class="mut xs">${prog.heat === 'vol' ? 'Hard sets per day (secondary muscles count half).' : 'Average load as % of your e1RM that day.'} Last ${days} days.</p>
      <div class="heat">${MUSCLES.map(m => `<div class="hrow"><span>${m}</span><div class="hcells">${hd[m].map(cell).join('')}</div></div>`).join('')}</div>
      <div class="row sp mut xs"><span>${fmtDate(now - (days - 1) * DAY)}</span><span>Today</span></div></div>
    <div class="card"><h2 class="h2">Weekly sets by muscle</h2><p class="mut xs">The shaded band is your target range for your goal and experience. Each row shows the last 7 days, then the 4-week trend (oldest to newest).</p>
      ${MUSCLES.map(m => {
        const a = ws4[m], cur = a[3], [lo, hi] = setTarget(m), sc = Math.max(25, hi * 1.4), prev = (a[0] + a[1] + a[2]) / 3, arrow = cur > prev + 1 ? ic('arrow-up') : cur < prev - 1 ? ic('arrow-down') : ic('right');
        const stat = cur >= lo && cur <= hi ? ['on target', 'gr'] : cur > hi ? ['above range', 'am'] : cur < lo * .5 ? ['low', 'rd'] : ['below target', 'am'];
        return `<div class="wrow"><span>${m}</span><div class="wbar"><b class="zone" style="left:${(lo / sc * 100).toFixed(1)}%;width:${((hi - lo) / sc * 100).toFixed(1)}%"></b><i style="width:${clamp(cur / sc * 100, 0, 100).toFixed(1)}%"></i></div><em>${fmtN(cur)}</em></div>
        <div class="wsub"><span class="${stat[1]}">${stat[0]} · aim ${lo}–${hi}</span><span>${arrow} ${a.map(fmtN).join(' · ')}</span></div>`;
      }).join('')}</div>
    <div class="card"><h2 class="h2">Recent sessions</h2>${hist.length ? hist.slice(0, 12).map(h => `<div class="prow static"><div class="grow"><b>${esc(h.name || 'Session')}</b><div class="mut xs">${h.t ? fmtDT(h.t) : esc(h.legacyDate || '')}${h.dur ? ' · ' + h.dur + ' min' : ''}${(h.cardio || []).length ? ' · cardio' : ''}</div></div><div class="right gr"><b>${h.sets} sets</b><div class="xs">${(h.vol || 0).toLocaleString()} ${h.unit || unit()}</div></div><button class="mini" data-a="histDel" data-id="${h.id}" aria-label="Delete session">${ic('close')}</button></div>`).join('') : '<div class="empty">No sessions yet. Finish a workout and it shows up here.</div>'}</div>`;
}
R.progress = renderProgress;
F.progEx = el => { prog.ex = el.value; renderProgress(); };
F.progRange = el => { prog.range = +el.value; renderProgress(); };
A.heat = el => { prog.heat = el.dataset.v; renderProgress(); };
A.histDel = el => { if (!confirm('Delete this session from history?')) return; state.history = state.history.filter(h => h.id !== el.dataset.id); scheduleSave(); renderProgress(); };

/* ---------- body tab: measurements + photos ---------- */
let bodyMetric = 'weight', photoUrls = [];
const BM = { weight: 'Body weight', bf: 'Body fat %', chest: 'Chest', waist: 'Waist', hips: 'Hips', arm: 'Arm', thigh: 'Thigh' };
function renderBody() {
  const u = unit() === 'kg' ? 'cm' : 'in', ms = [...state.measures].sort((a, b) => a.t - b.t);
  const pts = ms.filter(m => m[bodyMetric] != null && m[bodyMetric] !== '').map(m => ({ t: m.t, v: +m[bodyMetric] }));
  const f = (k, l, ph) => `<div class="field"><label>${l}</label><input inputmode="decimal" id="mf-${k}" placeholder="${ph || ''}"></div>`;
  $('#tab-body').innerHTML = `
    <div class="card"><h2 class="h2">Log measurements</h2><p class="mut xs">Fill in whatever you measured today.</p>
      <div class="grid3">${f('weight', `Weight (${unit()})`, state.profile.weight)}${f('bf', 'Body fat %')}${f('chest', `Chest (${u})`)}${f('waist', `Waist (${u})`)}${f('hips', `Hips (${u})`)}${f('arm', `Arm (${u})`)}${f('thigh', `Thigh (${u})`)}</div>
      <button class="btn pri full mt8" data-a="measSave">Save measurements</button></div>
    <div class="card"><div class="row sp"><h2 class="h2">Trend</h2><select data-f="bodyMetric" class="sel-sm">${Object.entries(BM).map(([k, l]) => `<option value="${k}" ${k === bodyMetric ? 'selected' : ''}>${l}</option>`).join('')}</select></div>${lineChart(pts)}</div>
    <div class="card"><div class="row sp"><h2 class="h2">Progress photos</h2><div class="row gap6">${state.photos.length > 1 ? `<button class="mini" data-a="photoCmp">${ic('swap')} Compare</button>` : ''}<button class="mini pri" data-a="photoAdd">${ic('plus')} Add photo</button></div></div><p class="mut xs">Stored privately on this device only.</p><div class="photos" id="photos">${state.photos.length ? '' : '<div class="empty">No photos yet. Take one every few weeks in the same spot and light, then use Compare to see the change. They stay on this phone and are included in your backups.</div>'}</div></div>
    <div class="card"><h2 class="h2">History</h2>${ms.length ? [...ms].reverse().slice(0, 15).map(m => `<div class="prow static"><div class="grow"><b>${fmtDate(m.t, { month: 'short', day: 'numeric', year: 'numeric' })}</b><div class="mut xs">${Object.keys(BM).filter(k => m[k] != null && m[k] !== '').map(k => `${BM[k]} ${m[k]}`).join(' · ')}</div></div><button class="mini" data-a="measDel" data-id="${m.id}">${ic('close')}</button></div>`).join('') : '<div class="empty">Nothing logged yet. Save your weight above and a trend line appears.</div>'}</div>`;
  hydratePhotos();
}
R.body = renderBody;
F.bodyMetric = el => { bodyMetric = el.value; renderBody(); };
A.measSave = () => {
  const m = { id: uid(), t: Date.now(), unit: unit() };
  Object.keys(BM).forEach(k => { const v = parseFloat(String($('#mf-' + k).value).replace(',', '.')); if (Number.isFinite(v) && v > 0) m[k] = v; });
  if (Object.keys(m).length <= 3) { toast('Enter at least one value'); return; }
  state.measures.push(m); if (m.weight) state.profile.weight = m.weight;
  scheduleSave(); renderBody(); toast('Saved');
};
A.measDel = el => { state.measures = state.measures.filter(m => m.id !== el.dataset.id); scheduleSave(); renderBody(); };
A.photoAdd = () => $('#photo-in').click();
async function addPhoto(file) {
  try {
    const url = URL.createObjectURL(file), img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .82)), id = uid(), t = Date.now();
    await idbPut('photos', { id, t, blob }); state.photos.push({ id, t }); scheduleSave(); renderBody(); toast('Photo saved');
  } catch (e) { toast('Couldn’t save that photo'); }
}
async function hydratePhotos() {
  photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls = [];
  const box = $('#photos'); if (!box || !state.photos.length) return;
  let html = '';
  for (const p of [...state.photos].reverse()) {
    try { const r = await idbGet('photos', p.id); if (r && r.blob) { const u = URL.createObjectURL(r.blob); photoUrls.push(u); html += `<figure><img src="${u}" alt="Progress photo ${fmtDate(p.t)}" loading="lazy"><figcaption>${fmtDate(p.t)}<button data-a="photoDel" data-id="${p.id}" aria-label="Delete photo">${ic('close')}</button></figcaption></figure>`; } } catch (e) { }
  }
  if ($('#photos')) $('#photos').innerHTML = html || '<div class="empty">Photos unavailable.</div>';
}
A.photoDel = async el => { if (!confirm('Delete this photo?')) return; const id = el.dataset.id; state.photos = state.photos.filter(p => p.id !== id); try { await idbDel('photos', id); } catch (e) { } scheduleSave(); renderBody(); };

/* ---------- More: profile, settings, equipment, data ---------- */
let wakeLock = null;
async function syncWake() {
  try {
    if (state.settings.wake && !document.hidden && navigator.wakeLock) { if (!wakeLock || wakeLock.released) wakeLock = await navigator.wakeLock.request('screen'); }
    else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { }
}
const tog = (k, l, d) => `<label class="trow"><span><b>${l}</b>${d ? `<em>${d}</em>` : ''}</span><input type="checkbox" class="sw" data-f="setting" data-k="${k}" ${state.settings[k] ? 'checked' : ''}></label>`;
const moreOpen = new Set(); let moreInit = false;
const grp = (k, icn, t, sub, body) => { const o = moreOpen.has(k); return `<section class="card grp ${o ? 'open' : ''}"><button class="grph" data-a="moreGrp" data-k="${k}" aria-expanded="${o}"><span class="gic" aria-hidden="true">${ic(icn)}</span><span class="grow"><b>${t}</b><em>${sub}</em></span><span class="chev" aria-hidden="true">${ic(o ? 'down' : 'right')}</span></button>${o ? `<div class="grpb col">${body}</div>` : ''}</section>`; };
function renderMore() {
  const p = state.profile, s = state.settings, G = GOALS[p.goal] || GOALS.muscle, standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!moreInit) { moreInit = true; if (backupDue() || !state.lastExport) moreOpen.add('data'); }
  const sets = {
    display: `<div class="field"><label>Appearance</label><div class="chips">${[['dark', 'Dark'], ['light', 'Light'], ['auto', 'Match phone']].map(([k, l]) => `<button class="chip ${(s.theme || 'dark') === k ? 'on' : ''}" data-a="themeSet" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Units</label><div class="chips"><button class="chip ${p.unit === 'lb' ? 'on' : ''}" data-a="unitSet" data-v="lb">lb</button><button class="chip ${p.unit === 'kg' ? 'on' : ''}" data-a="unitSet" data-v="kg">kg</button></div></div>
      <div class="field"><label>Week starts on</label><select data-f="setting" data-k="weekStart"><option value="1" ${s.weekStart !== 0 ? 'selected' : ''}>Monday</option><option value="0" ${s.weekStart === 0 ? 'selected' : ''}>Sunday</option></select></div>`,
    training: `${tog('rpe', 'Show RPE instead of RIR', 'RPE 8 = 2 reps in reserve')}
      ${tog('warmups', 'Warm-up set suggestions')}
      ${tog('prefill', 'Pre-fill sets from last session', 'Starts each set at the weight and reps you logged last time')}
      <div class="sep"></div>
      <div class="grid2"><div class="field"><label>Rest: compound (s)</label><input inputmode="numeric" value="${s.restC ?? ''}" placeholder="auto ${G.restC}" data-f="setting" data-k="restC"></div><div class="field"><label>Rest: isolation (s)</label><input inputmode="numeric" value="${s.restI ?? ''}" placeholder="auto ${G.restI}" data-f="setting" data-k="restI"></div></div>
      <div class="field"><label>Available plates per side (${p.unit})</label><input value="${s.plates.join(', ')}" data-f="platesCsv"></div>`,
    sound: `${tog('sound', 'Sound cues', 'Set complete, tempo phases, timer end')}
      <div class="grid2"><div class="field"><label>Tone</label><select data-f="setting" data-k="tone">${['beep', 'chime', 'tick'].map(t => `<option ${s.tone === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="field"><label>Volume</label><input type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" data-f="setting" data-k="volume"></div></div>
      <div class="sep"></div>
      ${tog('haptics', 'Haptic feedback', navigator.vibrate ? 'Vibration on set and timer events' : 'Not supported by this browser (iOS Safari). Works in Android and native apps.')}
      <div class="grid2"><div class="field"><label>Strength</label><select data-f="setting" data-k="haptic">${['light', 'medium', 'strong'].map(t => `<option ${s.haptic === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="field"><label>&nbsp;</label><button class="btn sec" data-a="testFx">Test cues</button></div></div>`,
    timers: `${tog('notify', 'Rest-timer notifications', 'Alert when the timer ends while the app is in the background')}
      ${tog('wake', 'Keep screen awake', 'Uses more battery. Off by default.')}`,
    gear: `<div class="chips scrollx">${[...Object.keys(GEAR_PRESETS), ...Object.keys(state.gearProfiles)].map(n => `<button class="chip ${state.activeProfile === n ? 'on' : ''}" data-a="gearPreset" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="gear">${Object.keys(state.gear).map(g => `<button class="${state.gear[g] ? 'on' : ''}" data-a="gearToggle" data-k="${esc(g)}"><span>${esc(gearLabel(g))}</span><b>${state.gear[g] ? ic('check') : 'Off'}</b></button>`).join('')}</div>
      <div class="grid2"><button class="btn sec" data-a="gearAdd">${ic('plus')} Add equipment</button><button class="btn sec" data-a="gearSave">Save as profile</button></div>
      ${Object.keys(state.gearProfiles).length ? `<div class="mut xs">Saved profiles: ${Object.keys(state.gearProfiles).map(n => `${esc(n)} <button class="link" data-a="gearDelProfile" data-v="${esc(n)}">remove</button>`).join(' · ')}</div>` : ''}`,
    lib: `<div class="grid2"><button class="btn sec" data-a="planOpen">${ic('calendar')} Plan &amp; blocks</button><button class="btn sec" data-a="libOpen">${ic('book')} Exercise library</button></div>
      <div class="sep"></div>
      <div class="row sp"><b>Routines</b><button class="mini" data-a="tplOpen">Open</button></div>
      <p class="mut sm">${state.templates.length} saved. Share is manual and opt-in: you copy a code, no accounts, feeds or leaderboards.</p>
      <div class="sep"></div>
      <div class="row sp"><b>Custom exercises</b><button class="mini pri" data-a="cxOpen">${ic('plus')} New</button></div>
      ${state.customExercises.length ? state.customExercises.map(c => `<div class="prow static"><div class="grow"><b>${esc(c.name)}</b><div class="mut xs">${esc(c.primary)}${c.secondary.length ? ' + ' + esc(c.secondary.join(', ')) : ''} · ${c.gear.length ? esc(c.gear.map(gearLabel).join(', ')) : 'No equipment'}</div></div><button class="mini" data-a="cxDel" data-id="${c.id}">${ic('close')}</button></div>`).join('') : '<p class="mut sm">Create lifts with custom muscle mapping. They join the generator and swap list.</p>'}`,
    people: profCard(true),
    data: `<div class="banner ${backupDue() || !state.lastExport ? 'note' : 'ok'}"><div class="grow"><b>${state.lastExport ? 'Last backup ' + fmtDate(state.lastExport, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No backup yet'}</b><div class="mut sm">${state.lastExport ? Math.floor((Date.now() - state.lastExport) / DAY) + ' days ago. A backup every couple of weeks keeps your history safe if this phone is lost or the browser data is cleared.' : 'Your data lives only on this device. Save a copy somewhere else so a lost phone or cleared browser can never wipe your history.'}</div></div></div>
      <button class="btn pri full" data-a="exportJSON">Back up now (share or save)</button>
      <p class="mut xs">Changes auto-save instantly with a rolling backup copy on this device${state.lastBackup ? ' (last ' + fmtDT(state.lastBackup) + ')' : ''}. That protects against crashes, not against losing the phone.</p>
      <div class="grid2"><button class="btn sec" data-a="importJSON">Import backup</button><button class="btn sec" data-a="restoreBak">Restore auto-backup</button></div>
      <button class="btn sec full" data-a="exportCSV">Export CSV (spreadsheet)</button>
      <button class="btn danger full" data-a="wipe">Erase all data</button>`,
    integ: `<div class="prow static"><div class="grow"><b>Live Activity / Dynamic Island</b><div class="mut xs">${LiveActivity.available() ? 'Connected: workout and rest timer are pushed to the lock screen.' : 'Needs the native iOS wrapper. Rest-timer and workout state are already exposed to it. In the browser you get the docked timer, notifications and tab title.'}</div></div><span class="tag ${LiveActivity.available() ? 'gr' : ''}">${LiveActivity.available() ? 'On' : 'Native only'}</span></div>
      <div class="prow static"><div class="grow"><b>Apple Health · Google Fit · Samsung Health</b><div class="mut xs">${HealthBridge.available() ? 'Plugin detected. Completed workouts are written to your health app.' : 'Two-way sync needs HealthKit / Health Connect, which browsers cannot access. The bridge is wired for a Capacitor build.'}</div></div>${HealthBridge.available() ? `<input type="checkbox" class="sw" data-f="setting" data-k="healthSync" ${s.healthSync ? 'checked' : ''}>` : '<span class="tag">Native only</span>'}</div>
      <div class="prow static"><div class="grow"><b>Apple Watch / Wear OS</b><div class="mut xs">Companion apps are native projects. Today, use the docked timer and haptics on your phone.</div></div><span class="tag">Native only</span></div>
      ${standalone ? '' : '<p class="mut xs">Tip: Add to Home Screen for full-screen, offline use.</p>'}`,
    adv: `<div class="row sp"><div class="grow"><b id="ver-line">ForgeFit v${APP_VER}</b><div class="mut xs">The app looks for updates every time you open it. Your workouts are never touched by an update.</div></div><button class="btn sec" data-a="checkUpdate">Check for updates</button></div>
      <div class="sep"></div>
      <b>Baseline e1RM editor</b>
      <p class="mut xs">Edit starting estimated maxes as JSON (${p.unit}). Keys are exercise ids.</p>
      <textarea id="json-ta" rows="8" class="mono">${esc(JSON.stringify(state.e1rm, null, 2))}</textarea><button class="btn pri full" data-a="jsonSave">Save baselines</button>`
  };
  const allOpen = ['display', 'training', 'sound', 'timers', 'gear', 'lib', 'people', 'data', 'integ', 'adv'].every(k => moreOpen.has(k));
  $('#tab-more').innerHTML = `
    <div class="card"><div class="row sp"><div><h2 class="h2">Your profile</h2><p class="mut sm">${G.label} · ${esc(p.experience)} · ${p.days} days/wk · ${p.sessionMin} min</p><p class="mut xs">${p.age} yrs · ${p.weight} ${p.unit}${p.cardio ? ' · cardio finisher' : ''}</p></div><button class="mini pri" data-a="obOpen">Edit</button></div></div>
    <div class="row sp px4"><span class="lbl">Settings</span><button class="link" data-a="moreAll">${allOpen ? 'Collapse all' : 'Expand all'}</button></div>

    <h3 class="grpt">Preferences</h3>
    ${grp('display', 'palette', 'Appearance &amp; units', 'Theme, lb or kg, week start', sets.display)}
    ${grp('training', 'dumbbell', 'Training', 'RPE, warm-ups, rest times, plates', sets.training)}
    ${grp('sound', 'volume', 'Sound &amp; haptics', 'Cues, volume, vibration', sets.sound)}
    ${grp('timers', 'timer', 'Timers &amp; screen', 'Notifications, keep screen awake', sets.timers)}

    <h3 class="grpt">Workout setup</h3>
    ${grp('gear', 'wrench', 'Equipment', 'What you have available', sets.gear)}
    ${grp('lib', 'library', 'Library &amp; routines', 'Plan, exercises, routines, custom lifts', sets.lib)}
    ${grp('people', 'users', 'People', 'Separate history for each person', sets.people)}

    <h3 class="grpt">Data &amp; app</h3>
    ${grp('data', 'database', 'Data &amp; backup', state.lastExport ? 'Last backup ' + fmtDate(state.lastExport) : 'No backup yet', sets.data)}
    ${grp('integ', 'plug', 'Integrations', 'Health apps, lock screen, watch', sets.integ)}
    ${grp('adv', 'sliders', 'App version &amp; advanced', 'v' + APP_VER + ' · updates, baselines', sets.adv)}

    <p class="mut xs center">ForgeFit v${APP_VER} · private-first · no accounts, no tracking, no feeds.</p>`;
}
A.moreGrp = el => { const k = el.dataset.k, y = window.scrollY; if (moreOpen.has(k)) moreOpen.delete(k); else moreOpen.add(k); renderMore(); window.scrollTo(0, y); };
A.moreAll = () => { const ks = ['display', 'training', 'sound', 'timers', 'gear', 'lib', 'people', 'data', 'integ', 'adv'], y = window.scrollY; if (ks.every(k => moreOpen.has(k))) moreOpen.clear(); else ks.forEach(k => moreOpen.add(k)); renderMore(); window.scrollTo(0, y); };
R.more = renderMore;
A.obOpen = () => openOnboarding(true);
A.cxOpen = () => openCustom('');
A.unitSet = el => { const nu = el.dataset.v; if (nu === unit()) return; if (!confirm(`Convert all saved weights to ${nu}?`)) return; setUnit(nu); scheduleSave(); renderMore(); };
A.testFx = () => { audio(); cue('timer'); buzz('timer'); };
A.themeSet = el => { state.settings.theme = el.dataset.v; applyTheme(); scheduleSave(); renderMore(); };
F.setting = el => {
  const k = el.dataset.k, s = state.settings; let v;
  if (el.type === 'checkbox') v = el.checked; else if (el.type === 'range') v = +el.value / 100; else if (k === 'restC' || k === 'restI') v = el.value === '' ? null : clamp(parseInt(el.value) || 0, 10, 900) || null; else if (k === 'weekStart') v = +el.value; else v = el.value;
  s[k] = v;
  if (k === 'notify' && v) { if (!('Notification' in window)) { s.notify = false; toast('Notifications not supported here'); } else Notification.requestPermission().then(r => { if (r !== 'granted') { s.notify = false; scheduleSave(); renderMore(); toast('Permission denied'); } }); }
  if (k === 'wake') syncWake();
  if (k === 'weekStart' && tab === 'workout') renderWorkout();
  if (k === 'rpe') { if (tab === 'workout') renderWorkout(); }
  if (k === 'tone' || k === 'haptic') { audio(); cue('set'); buzz('set'); }
  scheduleSave();
};
F.platesCsv = el => { const a = [...new Set(el.value.split(/[,\s]+/).map(Number).filter(n => n > 0))].sort((x, y) => y - x); if (a.length) { state.settings.plates = a; scheduleSave(); } };
A.jsonSave = () => {
  try {
    const o = JSON.parse($('#json-ta').value), clean = {};
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0;
    Object.entries(o).forEach(([k, v]) => { if (exById(k) && Number.isFinite(+v) && +v >= 0) clean[k] = Math.round(+v); });
    state.e1rm = { ...state.e1rm, ...clean }; ensureE1(); scheduleSave(); toast(`Updated ${Object.keys(clean).length} baselines`); renderMore();
  } catch (e) { toast('Invalid JSON. Check brackets and quotes.'); }
};
const blobToData = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
function download(name, text, type) { const u = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
async function buildBackup() {
  flushSave(); const photos = [], mine = new Set(state.photos.map(p => p.id));
  try { for (const p of await idbAll('photos')) if (p.blob && mine.has(p.id)) photos.push({ id: p.id, t: p.t, data: await blobToData(p.blob) }); } catch (e) { }
  const json = JSON.stringify({ app: 'forgefit', v: 3, exported: Date.now(), person: profName(PROFILES.active), state, photos });
  const name = `forgefit-backup-${ymd(Date.now())}${PROFILES.active === 'main' ? '' : '-' + profName(PROFILES.active).replace(/[^\w-]+/g, '')}.json`;
  try { return new File([json], name, { type: 'application/json' }); } catch (e) { const bl = new Blob([json], { type: 'application/json' }); bl.name = name; return bl; }
}
function markBackedUp() { state.lastExport = Date.now(); state.backupSnooze = 0; scheduleSave(); if (tab === 'more') renderMore(); else if (tab === 'workout') renderWorkout(); }
A.exportJSON = async () => {
  toast('Preparing backup…', 1500);
  let file; try { file = await buildBackup(); } catch (e) { toast('Couldn’t build the backup'); return; }
  window.__bak = file;
  let canShare = false; try { canShare = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { }
  const kb = file.size / 1024, size = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(kb)) + ' KB';
  openSheet('Backup ready', `<div class="col"><p class="mut sm">${esc(file.name || 'backup.json')} · ${size}. Save it somewhere that is not this phone: Files or iCloud Drive, Google Drive, or email it to yourself.</p>
    ${canShare ? '<button class="btn pri full big" data-a="bakShare">Share / save to Files</button>' : ''}
    <button class="btn ${canShare ? 'sec' : 'pri big'} full" data-a="bakDownload">Download file</button>
    <p class="mut xs">Includes workouts, history, settings and progress photos for ${esc(profName(PROFILES.active))}. To restore, use Import backup on any device.</p></div>`);
};
A.bakShare = async () => {            // the share call happens right here, straight from the tap, which iOS requires
  const f = window.__bak; if (!f) return;
  try { await navigator.share({ files: [f], title: 'ForgeFit backup' }); markBackedUp(); closeSheet(); toast('Backup shared'); }
  catch (e) { if (e && e.name === 'AbortError') return; toast('Sharing didn’t work here. Try Download instead.', 4000); }
};
A.bakDownload = () => {
  const f = window.__bak; if (!f) return;
  const u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name || 'forgefit-backup.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  markBackedUp(); closeSheet(); toast('Backup downloaded');
};
A.exportCSV = () => {
  const rows = [['date', 'workout', 'exercise', 'set', 'type', 'weight', 'reps', 'rir', 'failure', 'unit']];
  state.history.forEach(h => (h.items || []).forEach(i => i.sets.forEach((s, n) => rows.push([h.t ? new Date(h.t).toISOString() : h.legacyDate || '', h.name, i.name, n + 1, s.type, s.w, s.r, s.rir, s.fail ? 1 : 0, h.unit || unit()]))));
  (state.history).forEach(h => (h.cardio || []).forEach(c => rows.push([new Date(h.t).toISOString(), h.name, c.name, 1, 'cardio', '', '', '', '', c.min + 'min ' + (c.dist || '')])));
  download('forgefit-sets.csv', rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); toast('CSV exported');
};
A.importJSON = () => $('#import-in').click();
async function importFile(file) {
  try {
    const o = JSON.parse(await file.text()); if (!o || o.app !== 'forgefit' || !o.state) throw 0;
    if (!confirm('Replace ALL current data with this backup?')) return;
    state = normalize(o.state); resetExCache();
    for (const p of (o.photos || [])) { try { const b = await (await fetch(p.data)).blob(); await idbPut('photos', { id: p.id, t: p.t, blob: b }); } catch (e) { } }
    finishRestore('Backup imported');
  } catch (e) { toast('That file isn’t a ForgeFit backup'); }
}
function finishRestore(msg) {
  wk().items = wk().items.filter(it => exById(it.exId)); ensureE1(); normSS(); flushSave(); paintTimer(); armTimer(); go('workout'); toast(msg);
}
A.restoreBak = () => {
  let raw = null; try { raw = localStorage.getItem(LS_BAK); } catch (e) { }
  if (!raw) { toast('No auto-backup yet'); return; }
  if (!confirm('Restore the last automatic backup? Current data is replaced.')) return;
  try { state = normalize(JSON.parse(raw)); resetExCache(); finishRestore('Auto-backup restored'); } catch (e) { toast('Backup was unreadable'); }
};
A.wipe = async () => {
  if (!confirm('Erase ALL ForgeFit data on this device?') || !confirm('This cannot be undone. Export a backup first if unsure. Erase everything?')) return;
  const mine = state.photos.slice();
  try { [LS_KEY, LS_BAK, LS_OLD].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }); } catch (e) { }
  try { for (const p of mine) await idbDel('photos', p.id); await idbDel('kv', IDB_STATE); } catch (e) { }
  state = normalize(null); resetExCache(); ensureE1(); flushSave(); openOnboarding(false); go('workout');
};

/* ---------- events + boot ---------- */
const isTextLike = el => el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'file', 'date'].includes(el.type));
function bind() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
    const fn = A[el.dataset.a]; if (!fn) return;
    if (!['toggleSet', 'cardioDone'].includes(el.dataset.a)) buzz('tap');
    try { fn(el, e); } catch (err) { console.error(err); toast('Something went wrong. Your data is safe.'); }
  });
  document.addEventListener('input', e => { const el = e.target.closest('[data-f]'); if (el && isTextLike(el) && F[el.dataset.f]) F[el.dataset.f](el); });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-f]'); if (el && !isTextLike(el) && F[el.dataset.f]) F[el.dataset.f](el);
    if (e.target.id === 'photo-in' && e.target.files[0]) { addPhoto(e.target.files[0]); e.target.value = ''; }
    if (e.target.id === 'import-in' && e.target.files[0]) { importFile(e.target.files[0]); e.target.value = ''; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flushSave(); clearInterval(tInt); armTimer(); try { AC && AC.state === 'running' && AC.suspend(); } catch (e) { } stopTempo(); syncWake(); }
    else { updatePassiveRecovery(); paintTimer(); armTimer(); paintClock(); syncWake(); applyTheme(); checkBlock(); if (tab === 'recovery') renderRecovery(); }
  });
  addEventListener('pagehide', flushSave); addEventListener('beforeunload', flushSave);
  addEventListener('error', () => { try { flushSave(); } catch (e) { } });
  $('#photo-hint') && 0;
}
/* ---------- updates ---------- */
const isWeb = () => /^https?:/.test(location.protocol);
let updWhy = '';
async function remoteVer() {
  /* tries the version file two ways; remembers why it failed so the message can say */
  const urls = ['sw.js?c=' + Date.now(), 'sw.js'];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) { updWhy = 'server answered ' + r.status; continue; }
      const m = /forgefit-v(\d+)/.exec(await r.text());
      if (m) { updWhy = ''; return m[1]; }
      updWhy = 'the version file was not found (the page may be served from a different place)';
    } catch (e) { updWhy = navigator.onLine === false ? 'the phone is offline' : 'the request was blocked or timed out'; }
  }
  return null;
}
const appIdle = () => !wk().startedAt && !state.timer && $('#sheet').hidden && $('#onboard').hidden;
/* wipes only the app's downloaded files (never your data) and reloads, so a stuck old copy cannot survive */
let updBusy = false;
async function applyUpdate(ver) {
  updBusy = true;
  try { flushSave(); } catch (e) { }
  try { sessionStorage.setItem('ff_upd', JSON.stringify({ to: ver, t: Date.now() })); } catch (e) { }
  try { if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k); } catch (e) { }
  try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) { }
  location.reload();
}
let updChecking = false, updLast = 0;
async function checkUpdate(manual) {
  if (!isWeb() || updChecking) return; updChecking = true; updLast = Date.now();
  try {
    const v = await remoteVer();
    if (!v) { if (manual) toast('Could not check for updates: ' + (updWhy || 'no answer') + '. You are on v' + APP_VER + '.', 6000); return; }
    if (+v <= +APP_VER) { if (manual) toast(`You have the latest version (v${APP_VER})`, 3500); return; }
    let tried = null; try { tried = JSON.parse(sessionStorage.getItem('ff_upd') || 'null'); } catch (e) { }
    if (!manual && tried && tried.to === v && Date.now() - tried.t < 12e4) return;      // already tried a moment ago: never loop
    if (manual || appIdle()) { toast(`Updating to v${v}…`, 2500); setTimeout(() => applyUpdate(v), 400); }
    else toast(`ForgeFit v${v} is ready`, 9000, { label: 'Update', fn: () => applyUpdate(v) });
  } finally { updChecking = false; if (tab === 'more') { const e = $('#ver-line'); if (e) e.textContent = `ForgeFit v${APP_VER}`; } }
}
A.checkUpdate = () => { if (!isWeb()) { toast('Updates apply when you open the website version'); return; } checkUpdate(true); };
function afterUpdateNote() {
  try { const o = JSON.parse(sessionStorage.getItem('ff_upd') || 'null'); if (!o) return; if (+APP_VER >= +o.to) { sessionStorage.removeItem('ff_upd'); if (Date.now() - o.t < 12e4) toast(`Updated to v${APP_VER}`, 3500); } /* else keep the marker: it stops the updater from retrying in a loop */ } catch (e) { }
}
async function boot() {
  await loadState(); resetExCache(); applyTheme(); paintChrome();
  state.workout.items = state.workout.items.filter(it => exById(it.exId));
  state.workout.items.forEach(it => { if (!it.id) it.id = uid(); if (!it.cardio && !Array.isArray(it.sets)) it.sets = []; });
  ensureE1(); updatePassiveRecovery(); normSS(); checkBlock();
  if (state.timer && state.timer.endAt <= Date.now()) state.timer = null;
  bind();
  if (!state.workout.items.length) generateWorkout(true);
  go('workout'); paintTimer(); armTimer();
  setInterval(() => { if (!document.hidden) paintClock(); }, 30000);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    const had = !!navigator.serviceWorker.controller;      // only announce updates, not the very first install
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !updBusy) { if (appIdle()) { try { flushSave(); } catch (e) { } location.reload(); } else toast('ForgeFit was updated', 9000, { label: 'Reload', fn: () => location.reload() }); } });
    navigator.serviceWorker.register('sw.js').then(r => { try { r.update(); } catch (e) { } }).catch(() => { });
    // look for a newer version now, and again every time the app comes back to the screen
    setTimeout(() => checkUpdate(false), 1500);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - updLast > 45e3) { try { navigator.serviceWorker.getRegistration().then(r => r && r.update()); } catch (e) { } checkUpdate(false); } });
  }
  afterUpdateNote();
  syncWake();
  if (!state.profile.done) openOnboarding(false);
  checkHashImport();
  $('#boot') && $('#boot').remove();
}
boot();
