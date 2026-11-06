/* ---------- recovery tab: readiness ring, flip-card body map, single-track sliders ---------- */
/* Muscle regions are drawn for the left half of the figure and mirrored, so each region is one clickable group. */
const BODY_BASE = {
  front: ['M100 54 L80 57 C70 59 64 64 62 74 L60 100 C60 120 66 140 70 156 C72 166 76 174 80 182 L100 186 Z',
    'M62 72 C54 74 48 82 47 94 L44 122 C43 128 47 132 52 132 L58 132 C62 131 64 127 65 122 L68 96 Z',
    'M46 134 L40 170 C39 176 43 180 48 180 L53 180 C57 179 58 176 58 172 L62 134 Z',
    'M100 180 L76 178 C70 204 68 236 72 268 C70 296 70 324 74 352 L76 380 C76 384 90 384 92 380 L94 352 C96 324 98 296 96 268 C98 240 100 214 100 196 Z'],
  back: ['M100 54 L80 57 C70 59 64 64 62 74 L60 100 C60 120 66 140 70 156 C72 166 76 174 80 182 L100 186 Z',
    'M62 72 C54 74 48 82 47 94 L44 122 C43 128 47 132 52 132 L58 132 C62 131 64 127 65 122 L68 96 Z',
    'M46 134 L40 170 C39 176 43 180 48 180 L53 180 C57 179 58 176 58 172 L62 134 Z',
    'M100 180 L76 178 C70 204 68 236 72 268 C70 296 70 324 74 352 L76 380 C76 384 90 384 92 380 L94 352 C96 324 98 296 96 268 C98 240 100 214 100 196 Z']
};
const DELT = 'M72 59 C64 60 58 65 56 73 C51 77 47 85 47 95 C52 100 58 101 63 98 C66 88 68 78 72 70 Z';
const ARM = 'M47 98 L44 124 C44 128 48 130 52 130 L57 129 C60 126 62 118 63 108 L64 101 C58 103 52 102 47 98 Z';
const BODY_MUS = {
  front: { Shoulders: [DELT], Chest: ['M100 64 L76 62 C71 66 69 72 68 80 C70 92 78 100 90 100 C96 100 100 98 100 96 Z'], Biceps: [ARM], Core: ['M99 104 L88 104 C84 118 84 140 86 156 C88 164 94 170 99 172 Z'],
    Quads: ['M99 188 L77 184 C71 206 70 232 73 256 C77 264 88 266 94 262 C98 244 100 216 99 188 Z'], Calves: ['M74 292 C72 312 73 330 75 348 L90 346 C93 326 94 306 93 292 C88 286 80 286 74 292 Z'] },
  back: { Shoulders: [DELT], Back: ['M100 58 L78 60 C70 64 66 70 66 80 C67 98 72 114 80 128 C84 138 84 150 88 160 L100 164 Z'], Triceps: [ARM], Glutes: ['M100 168 L82 166 C74 172 72 184 76 196 C84 204 94 204 100 200 Z'],
    Hamstrings: ['M99 206 L78 202 C72 224 71 246 74 262 C80 268 90 268 95 262 C98 244 100 226 99 206 Z'], Calves: ['M74 276 C70 296 72 322 76 342 L90 342 C94 322 96 298 94 276 C88 270 80 270 74 276 Z'] }
};
const MIRROR = 'transform="matrix(-1 0 0 1 200 0)"';
let recSide = 'front', recSel = null, recSwiped = false;
function bodySvg(side) {
  const mus = Object.entries(BODY_MUS[side]).map(([m, ds]) => { const p = rec(m);
    return `<g class="mus ${recCol(p)}${recSel === m ? ' sel' : ''}" data-a="recMuscle" data-m="${m}" role="button" aria-label="${m} ${p}% fresh">${ds.map(d => `<path d="${d}"/><path d="${d}" ${MIRROR}/>`).join('')}</g>`; }).join('');
  const base = BODY_BASE[side].map(d => `<path class="base" d="${d}"/><path class="base" d="${d}" ${MIRROR}/>`).join('');
  return `<svg viewBox="0 0 200 392" aria-label="${side} view"><circle class="base" cx="100" cy="27" r="15"/><path class="base" d="M93 40 L93 55 L107 55 L107 40 Z"/>${base}${mus}</svg>`;
}
const RING_C = 2 * Math.PI * 48;
function readyRing(avg) {
  return `<div class="ring ${recCol(avg)}" id="rring"><svg viewBox="0 0 112 112" aria-hidden="true"><circle class="rt" cx="56" cy="56" r="48"/><circle class="rv" cx="56" cy="56" r="48" stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${(RING_C * (1 - avg / 100)).toFixed(1)}"/></svg><div class="rn"><b id="rring-n">${avg}%</b><span>ready</span></div></div>`;
}
function renderRecovery() {
  updatePassiveRecovery();
  const coach = coachBanner(), avg = avgRecovery(), dots = ['front', 'back'].map(s => `<button class="dot${recSide === s ? ' on' : ''}" data-a="recFlip" data-v="${s}" aria-label="Show ${s} view"></button>`).join('');
  $('#tab-recovery').innerHTML = `
    <div class="card rhero"><div class="row gap12">${readyRing(avg)}<div class="grow"><h2 class="h2">Readiness</h2><p class="mut sm">Recovers ~1.25% per hour. Drag a slider if you feel sore.</p></div></div>
      <div class="row gap6 pt8 wrap"><button class="gpill" data-a="resetRec">Reset to 100%</button><button class="gpill" data-a="simTime">+24h simulate</button>${coach ? '' : '<button class="gpill" data-a="startDeload">Deload anyway</button>'}</div></div>
    ${restCard()}
    ${coach}
    <div class="card bodycard"><div class="row sp"><h2 class="h2">Muscle map</h2><span class="mut xs" id="recSideLbl">${recSide === 'front' ? 'Front' : 'Back'} view</span></div>
      <div class="flip" id="flip"><div class="flipin${recSide === 'back' ? ' back' : ''}" id="flipin"><div class="face fr">${bodySvg('front')}</div><div class="face bk">${bodySvg('back')}</div></div></div>
      <div class="dots" role="tablist" aria-label="Body view">${dots}</div>
      <div class="selinfo mut sm" id="recSel">${recSel ? recSelText(recSel) : 'Tap a muscle to jump to its slider. Swipe to turn the figure.'}</div>
      <div class="rlegend"><span><i class="gr"></i>Fresh</span><span><i class="am"></i>Recovering</span><span><i class="rd"></i>Fatigued</span></div></div>
    <div class="card rlist">${MUSCLES.map(m => { const p = rec(m), c = recCol(p);
      return `<div class="rrow ${c}" data-row="${m}"><div class="rtop"><b>${m}</b><span class="tag ${c}" data-badge>${recWord(p)}</span><span class="rpct" data-pct>${p}%</span></div>
      <input type="range" class="rs" min="0" max="100" value="${p}" style="--p:${p}%" data-f="recSlide" data-live="1" data-m="${m}" aria-label="${m} freshness"></div>`; }).join('')}</div>`;
}
R.recovery = renderRecovery;
const recSelText = m => `<b>${m}</b> · ${rec(m)}% fresh · ${recWord(rec(m))}`;
function paintRecLive(m) {
  const p = rec(m), c = recCol(p);
  document.querySelectorAll(`#tab-recovery .mus[data-m="${m}"]`).forEach(g => { g.classList.remove('gr', 'am', 'rd'); g.classList.add(c); g.setAttribute('aria-label', `${m} ${p}% fresh`); });
  const row = document.querySelector(`#tab-recovery .rrow[data-row="${m}"]`);
  if (row) { row.classList.remove('gr', 'am', 'rd'); row.classList.add(c); const b = row.querySelector('[data-badge]'); b.className = 'tag ' + c; b.textContent = recWord(p); row.querySelector('[data-pct]').textContent = p + '%'; const s = row.querySelector('input'); s.style.setProperty('--p', p + '%'); if (+s.value !== p) s.value = p; }
  const avg = avgRecovery(), ring = $('#rring');
  if (ring) { ring.classList.remove('gr', 'am', 'rd'); ring.classList.add(recCol(avg)); ring.querySelector('.rv').setAttribute('stroke-dashoffset', (RING_C * (1 - avg / 100)).toFixed(1)); $('#rring-n').textContent = avg + '%'; }
  if (recSel === m && $('#recSel')) $('#recSel').innerHTML = recSelText(m);
}
F.recSlide = el => { const m = el.dataset.m; state.muscles[m].recovery = +el.value; scheduleSave(); paintRecLive(m); };
A.resetRec = () => { MUSCLES.forEach(m => state.muscles[m].recovery = 100); scheduleSave(); renderRecovery(); };
A.simTime = () => { MUSCLES.forEach(m => state.muscles[m].recovery = Math.min(100, state.muscles[m].recovery + 24 * 1.25)); scheduleSave(); renderRecovery(); };
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
