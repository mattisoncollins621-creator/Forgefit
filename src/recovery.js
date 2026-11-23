/* ---------- recovery tab: readiness ring, flip-card body map, single-track sliders ---------- */
/* Muscle regions are drawn for the left half of the figure and mirrored, so each region is one clickable group. */
/* v23: anatomical figure. One smooth silhouette (left half, mirrored) with muscle regions drawn on top and
   thin gaps between them, in the same style as the exercise figures. */
const SIL = 'M100 60L91 60C88 64 80 66 70 68C58 70 50 76 49 88C48 100 47 112 45 124C43 136 41 146 41 154C39 172 36 192 35 210C34 222 34 232 37 240C40 246 46 246 47 238C48 228 48 218 49 210C51 194 54 176 55 160C56 150 58 140 59 128C60 118 61 108 63 100C66 116 68 132 70 148C71 160 66 172 63 184C60 198 60 214 62 232C64 252 68 268 70 282C71 296 68 310 69 324C70 340 74 356 76 368C76 376 70 382 72 386L92 386C93 380 91 374 90 368C90 352 93 336 92 318C91 304 90 292 91 282C93 260 98 232 98 206L100 200Z';
function wholeSil(d) {                            // left half + its mirror image, joined into one outline with no centre seam
  const t = d.match(/[MLCZ]|-?[\d.]+/g), segs = []; let i = 0, start, cur, k;
  while (i < t.length) { k = t[i++]; if (k === 'Z') break; const n = k === 'C' ? 6 : 2, v = t.slice(i, i + n).map(Number); i += n;
    if (k === 'M') { start = cur = [v[0], v[1]]; continue; } segs.push({ k, from: cur, v }); cur = [v[n - 2], v[n - 1]]; }
  const mx = x => 200 - x, f = n => +n.toFixed(1);
  let out = `M${start[0]} ${start[1]}` + segs.map(g => g.k + g.v.join(' ')).join('');
  for (let j = segs.length - 1; j >= 0; j--) { const g = segs[j], p0 = g.from, v = g.v;
    out += g.k === 'C' ? `C${f(mx(v[2]))} ${v[3]} ${f(mx(v[0]))} ${v[1]} ${f(mx(p0[0]))} ${p0[1]}` : `L${f(mx(p0[0]))} ${p0[1]}`; }
  return out + 'Z';
}
const BODY_BASE = { front: [wholeSil(SIL)], back: [wholeSil(SIL)] };
const DELT = 'M72 69C59 70 51 76 50 88C49 98 50 106 53 112C57 104 61 96 65 88C68 81 71 75 75 71Z';
const BODY_MUS = {
  front: {
    Shoulders: [DELT],
    Chest: ['M98 72L77 72C70 76 67 84 67 94C69 106 77 114 88 114C94 114 98 112 98 108Z'],
    Biceps: ['M54 115C51 125 50 135 51 146C53 151 57 151 59 147C61 137 62 125 61 113C59 108 56 109 54 115Z'],
    Core: ['M98 119L87 119C85 141 85 166 88 186C91 192 96 196 98 196Z', 'M83 121C77 131 73 142 72 152C71 162 73 170 77 178L85 183C83 161 82 141 83 121Z'],
    Quads: ['M96 205C88 203 78 201 69 197C64 215 64 236 67 254C71 270 77 278 84 280C90 276 94 264 95 250C97 234 97 219 96 205Z'],
    Calves: ['M72 297C70 311 70 326 73 340L78 344C80 328 80 312 78 297Z', 'M90 300C91 314 91 328 89 344L85 344C84 328 84 312 86 299Z']
  },
  back: {
    Shoulders: [DELT],
    Back: ['M98 60L91 61C86 65 81 67 74 70C80 75 87 81 92 92C96 100 98 106 98 110Z', 'M67 97C67 111 69 126 72 142C75 154 80 164 88 170L95 166C93 150 90 132 86 118C82 107 75 101 67 97Z', 'M97 121L91 123C90 141 91 158 94 172L98 174Z'],
    Triceps: ['M51 108C49 120 48 132 49 146C52 151 56 151 58 147C60 135 61 122 61 110C58 104 53 104 51 108Z'],
    Glutes: ['M98 179C88 177 77 179 69 187C65 199 67 211 73 217C81 223 92 221 98 215Z'],
    Hamstrings: ['M96 225C88 227 78 225 69 219C66 237 67 254 71 268C75 276 80 280 84 280C90 276 94 266 95 252C97 242 97 232 96 225Z'],
    Calves: ['M72 293C69 307 70 322 74 334C77 340 81 342 82 338C83 322 82 306 80 293C77 289 74 289 72 293Z', 'M85 293C87 307 88 322 86 338C89 342 92 338 93 332C94 318 93 304 90 293C88 289 86 289 85 293Z']
  }
};
const MIRROR = 'transform="matrix(-1 0 0 1 200 0)"';
let recSide = 'front', recSel = null, recSwiped = false;
/* paint(m) → { cls, label, act, fill }: defaults to the recovery colours with tap-to-jump.
   `inline` writes plain fill colours instead of classes, for images drawn outside the page (share card). */
function bodySvg(side, paint, inline) {
  paint = paint || (m => { const p = rec(m); return { cls: recCol(p) + (recSel === m ? ' sel' : ''), label: `${m} ${p}% fresh`, act: 'recMuscle' }; });
  const bf = inline ? ' fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.14)" stroke-width="1"' : '';
  const mus = Object.entries(BODY_MUS[side]).map(([m, ds]) => { const o = paint(m) || {};
    const at = o.act ? ` data-a="${o.act}" role="button"` : '', fl = inline ? ` fill="${o.fill || 'rgba(255,255,255,.1)'}" stroke="#141721" stroke-width="1.3"` : (o.fill ? ` style="--mf:${o.fill}"` : '');
    return `<g class="mus ${o.cls || ''}" data-m="${m}"${at}${fl} aria-label="${esc(o.label || m)}">${ds.map(d => `<path d="${d}"/><path d="${d}" ${MIRROR}/>`).join('')}</g>`; }).join('');
  const base = BODY_BASE[side].map(d => `<path class="base"${bf} d="${d}"/>`).join('');
  return `<svg viewBox="0 0 200 392" aria-label="${side} view"${inline ? ' xmlns="http://www.w3.org/2000/svg" width="200" height="392"' : ''}><ellipse class="base"${bf} cx="100" cy="29" rx="14.5" ry="18"/><path class="base"${bf} d="M92 42C92 50 91 56 89 62L111 62C109 56 108 50 108 42Z"/>${base}${mus}</svg>`;
}
/* orange heat by share (0–1): used for "what this exercise works" and "what today hits" */
const heatFill = a => a > 0 ? `rgba(249,115,22,${(.18 + .82 * clamp(a, 0, 1)).toFixed(2)})` : '';
const heatPaint = (W, lbl) => m => W[m] > 0 ? { cls: 'heat', fill: heatFill(W[m]), label: lbl(m) } : { cls: 'off', label: m };
function bodyPair(W, lbl, cls) {
  const p = heatPaint(W, lbl || (m => m));
  return `<div class="bpair ${cls || ''}" aria-hidden="${cls === 'bsm' ? 'true' : 'false'}"><div>${bodySvg('front', p)}</div><div>${bodySvg('back', p)}</div></div>`;
}
/* weighted working sets per muscle for a list of items (plan or history) */
function itemsLoad(items) {
  const L = {}; MUSCLES.forEach(m => L[m] = 0);
  items.forEach(it => { if (it.cardio) return; const ex = exById(it.exId || it.id), W = it.mw || (ex ? exW(ex) : itemW(it)), n = (it.sets || []).filter(s => (s.type || 'work') !== 'warmup').length; for (const m in W) if (L[m] != null) L[m] += n * W[m]; });
  return L;
}
const RING_C = 2 * Math.PI * 48;
function readyRing(avg) {
  return `<div class="ring ${recCol(avg)}" id="rring"><svg viewBox="0 0 112 112" aria-hidden="true"><circle class="rt" cx="56" cy="56" r="48"/><circle class="rv" cx="56" cy="56" r="48" stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${(RING_C * (1 - avg / 100)).toFixed(1)}"/></svg><div class="rn"><b id="rring-n">${avg}%</b><span>ready</span></div></div>`;
}
function renderRecovery() {
  updatePassiveRecovery();
  const coach = coachBanner(), avg = avgRecovery(), dots = ['front', 'back'].map(s => `<button class="dot${recSide === s ? ' on' : ''}" data-a="recFlip" data-v="${s}" aria-label="Show ${s} view"></button>`).join('');
  $('#tab-recovery').innerHTML = `
    <div class="card rhero"><div class="row gap12">${readyRing(avg)}<div class="grow"><h2 class="h2">Readiness</h2><p class="mut sm">Feel sorer or fresher than shown? Drag that muscle's slider and ForgeFit learns your pace.</p></div></div>
      <div class="row gap6 pt8 wrap"><button class="gpill" data-a="resetRec">Reset to 100%</button><button class="gpill" data-a="simTime">+24h simulate</button>${coach ? '' : '<button class="gpill" data-a="startDeload">Deload anyway</button>'}</div></div>
    ${restCard()}
    ${coach}
    <div class="card bodycard"><div class="row sp"><h2 class="h2">Muscle map</h2><span class="mut xs" id="recSideLbl">${recSide === 'front' ? 'Front' : 'Back'} view</span></div>
      <div class="flip" id="flip"><div class="flipin${recSide === 'back' ? ' back' : ''}" id="flipin"><div class="face fr">${bodySvg('front')}</div><div class="face bk">${bodySvg('back')}</div></div></div>
      <div class="dots" role="tablist" aria-label="Body view">${dots}</div>
      <div class="selinfo mut sm" id="recSel">${recSel ? recSelText(recSel) : 'Tap a muscle to jump to its slider. Swipe to turn the figure.'}</div>
      <div class="rlegend"><span><i class="gr"></i>Fresh</span><span><i class="am"></i>Recovering</span><span><i class="rd"></i>Fatigued</span></div></div>
    ${recList()}`;
}
R.recovery = renderRecovery;
/* most tired first; muscles that are completely fresh fold into one row you can open */
function recList() {
  const row = m => { const p = rec(m), c = recCol(p);
    return `<div class="rrow ${c}" data-row="${m}"><div class="rtop"><span class="grow"><b>${m}</b><small class="rsub" data-sub>${recSub(m)}</small></span><span class="tag ${c}" data-badge>${recWord(p)}</span><span class="rpct" data-pct>${p}%</span></div>
      <input type="range" class="rs" min="0" max="100" value="${p}" style="--p:${p}%" data-f="recSlide" data-learn="recLearn" data-live="1" data-m="${m}" aria-label="${m} freshness"></div>`; };
  const ms = MUSCLES.slice().sort((a, b) => rec(a) - rec(b)), tired = ms.filter(m => rec(m) < 100), fresh = ms.filter(m => rec(m) >= 100);
  const fold = fresh.length ? `<details class="rfresh"${tired.length ? '' : ' open'}><summary><span class="grow"><b>${tired.length ? `${fresh.length} more fully fresh` : 'Every muscle is fully fresh'}</b><small class="rsub">${fresh.join(', ')}</small></span><span class="tag gr">Fresh</span>${ic('chevR', 'rchev')}</summary>${fresh.map(row).join('')}</details>` : '';
  return `<div class="card rlist">${tired.map(row).join('')}${fold}</div>`;
}
const recSub = m => { const h = hrsToFull(m), pw = paceWord(m); return (h ? `full in ~${h < 48 ? h + 'h' : Math.round(h / 24) + ' days'}` : 'fully recovered') + (pw ? ` · ${pw}` : ''); };
const recSelText = m => `<b>${m}</b> · ${rec(m)}% fresh · ${recWord(rec(m))}`;
function paintRecLive(m) {
  const p = rec(m), c = recCol(p);
  document.querySelectorAll(`#tab-recovery .mus[data-m="${m}"]`).forEach(g => { g.classList.remove('gr', 'am', 'rd'); g.classList.add(c); g.setAttribute('aria-label', `${m} ${p}% fresh`); });
  const row = document.querySelector(`#tab-recovery .rrow[data-row="${m}"]`);
  if (row) { row.classList.remove('gr', 'am', 'rd'); row.classList.add(c); const b = row.querySelector('[data-badge]'); b.className = 'tag ' + c; b.textContent = recWord(p); row.querySelector('[data-pct]').textContent = p + '%'; row.querySelector('[data-sub]').textContent = recSub(m); const s = row.querySelector('input'); s.style.setProperty('--p', p + '%'); if (+s.value !== p) s.value = p; }
  const avg = avgRecovery(), ring = $('#rring');
  if (ring) { ring.classList.remove('gr', 'am', 'rd'); ring.classList.add(recCol(avg)); ring.querySelector('.rv').setAttribute('stroke-dashoffset', (RING_C * (1 - avg / 100)).toFixed(1)); $('#rring-n').textContent = avg + '%'; }
  if (recSel === m && $('#recSel')) $('#recSel').innerHTML = recSelText(m);
}
F.recSlide = el => { const m = el.dataset.m; if (el.dataset.from == null) el.dataset.from = state.muscles[m].recovery; state.muscles[m].recovery = +el.value; scheduleSave(); paintRecLive(m); };
F.recLearn = el => {                       // when a drag ends, compare what you set with what the model expected
  const m = el.dataset.m, from = +el.dataset.from; delete el.dataset.from; if (!Number.isFinite(from)) return;
  const d = learnPace(m, from, +el.value); if (!d) return; scheduleSave(); paintRecLive(m);
  toast(`Got it: ${m.toLowerCase()} will recover a bit ${d < 0 ? 'slower' : 'faster'} for you from now on.`);
};
A.resetRec = () => { MUSCLES.forEach(m => state.muscles[m].recovery = 100); scheduleSave(); renderRecovery(); };
A.simTime = () => { MUSCLES.forEach(m => state.muscles[m].recovery = Math.min(100, state.muscles[m].recovery + 24 * recRate(m))); scheduleSave(); renderRecovery(); };
function setRecSide(s) {
  recSide = s; const f = $('#flipin'); if (!f) return;
  f.classList.toggle('back', s === 'back');
  document.querySelectorAll('#tab-recovery .dot').forEach(d => d.classList.toggle('on', d.dataset.v === s));
  $('#recSideLbl').textContent = (s === 'front' ? 'Front' : 'Back') + ' view';
}
A.recFlip = el => setRecSide(el.dataset.v);
A.recMuscle = el => {
  if (recSwiped) return;
  const m = el.dataset.m; recSel = m;
  document.querySelectorAll('#tab-recovery .mus').forEach(g => g.classList.toggle('sel', g.dataset.m === m));
  $('#recSel').innerHTML = recSelText(m);
  const row = document.querySelector(`#tab-recovery .rrow[data-row="${m}"]`); if (!row) return;
  const fd = row.closest('details'); if (fd) fd.open = true;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
};
/* horizontal swipe (> 40px) turns the figure; vertical scrolling stays untouched because the element only claims pan-x */
(function () {
  let sw = null;
  document.addEventListener('pointerdown', e => { const f = e.target.closest && e.target.closest('#flip'); sw = f ? { x: e.clientX, y: e.clientY } : null; });
  document.addEventListener('pointerup', e => {
    if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { recSwiped = true; setRecSide(dx < 0 ? 'back' : 'front'); setTimeout(() => recSwiped = false, 350); }
  });
  document.addEventListener('pointercancel', () => sw = null);
})();
