'use strict';
/* ---------- how-to videos: a tutorial per exercise, played inside the app ----------
   VIDEOS maps exercise id -> [YouTube id, title]. Someone can swap in their own pick
   (Change video), stored per person in state.vidOver. Nothing loads from YouTube until a
   video is opened, and the embed uses youtube-nocookie. */
const VIDEOS = __VIDEOS__;
const vidOf = ex => {
  if (!ex) return null; const o = (state.vidOver || {})[ex.id];
  return o ? [o, 'Your video'] : VIDEOS[ex.id] || null;
};
const vidSearch = ex => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.name.replace(/\s*\((?:Total|Added Wt|Bars \/ Chairs|seconds)[^)]*\)/gi, '') + ' proper form');
/* the animated thumbnail that opens the player. size: sm (lists), md (Focus), lg (info sheet) */
function thumbBtn(ex, size) {
  if (!ex) return ''; const fig = figSvg(ex), v = vidOf(ex);
  if (!fig && !v) return '';
  return `<button class="thumb ${size || 'sm'}${fig ? '' : ' nofig'}" data-a="exVideo" data-id="${ex.id}" aria-label="Play how-to for ${esc(ex.name)}">${fig || ic('activity', 'tbig')}<span class="pbadge">${ic('play', 'fill')}</span>${size === 'lg' ? `<span class="tcap">${v ? 'Play how-to video' : 'Find a how-to video'}</span>` : ''}</button>`;
}
const vidId = s => { s = (s || '').trim(); const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : null; };
function vidFrame(id) {
  return `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1" title="How-to video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}
A.exVideo = el => {
  const ex = exById(el.dataset.id); if (!ex) return;
  const v = vidOf(ex), fig = figSvg(ex, 'big'), off = navigator.onLine === false;
  const steps = HOW[ex.id] || [ex.cue || 'Control the weight and use a full range of motion.'];
  const top = !v ? `<div class="vwrap fig">${fig || ''}<div class="voff">No video picked for this one yet. Search YouTube below, or paste a link with Change video.</div></div>`
    : off ? `<div class="vwrap fig">${fig || ''}<div class="voff">${ic('info', 'sm')} The video needs internet. The animation shows the movement.<button class="btn sec sm" data-a="exVideo" data-id="${ex.id}">${ic('refresh')} Try again</button></div></div>`
    : `<div class="vwrap">${vidFrame(v[0])}</div><div class="mut xs vtitle">${esc(v[1])}</div>`;
  openSheet(ex.name, `<div class="col vsheet" data-id="${ex.id}">${top}
    <div class="vmove">${!off && fig ? `<div class="vfig">${fig}</div>` : ''}<ol class="how grow">${steps.map((t, k) => `<li><b>${steps.length > 1 ? ['Set up', 'Move', 'Watch for'][k] || 'Tip' : 'Cue'}</b><span>${esc(t)}</span></li>`).join('')}</ol></div>
    <div class="grid2">${v ? `<a class="btn sec" href="https://www.youtube.com/watch?v=${v[0]}" target="_blank" rel="noopener noreferrer">${ic('link')} Open in YouTube</a>` : ''}<a class="btn sec" href="${vidSearch(ex)}" target="_blank" rel="noopener noreferrer">${ic('play')} Other videos</a></div>
    <div id="vchg"><button class="btn ghost sm full" data-a="vidChange" data-id="${ex.id}">${ic('pencil', 'sm')} Change video</button></div>
    <p class="mut xs center">Videos play from YouTube and load only when you open one.</p>
    <div class="grid2"><button class="btn sec" data-a="exInfo" data-id="${ex.id}">${ic('info')} Details</button><button class="btn pri" data-a="closeSheet">Done</button></div></div>`,
    { onClose: () => document.querySelectorAll('#sheet-b iframe').forEach(f => f.remove()) });
};
A.vidChange = el => {
  const id = el.dataset.id, own = (state.vidOver || {})[id];
  $('#vchg').innerHTML = `<div class="col gap6"><label class="mut xs" for="vid-in">Paste a YouTube link</label><input id="vid-in" type="url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…">
    <div class="grid2">${own ? `<button class="btn sec" data-a="vidReset" data-id="${id}">Use default</button>` : `<button class="btn sec" data-a="exVideo" data-id="${id}">Cancel</button>`}<button class="btn pri" data-a="vidSave" data-id="${id}">Save video</button></div></div>`;
  $('#vid-in').focus();
};
A.vidSave = el => {
  const v = vidId($('#vid-in').value); if (!v) { toast('That doesn’t look like a YouTube link'); return; }
  state.vidOver = { ...(state.vidOver || {}), [el.dataset.id]: v }; scheduleSave(); toast('Video saved');
  A.exVideo(el);
};
A.vidReset = el => {
  const o = { ...(state.vidOver || {}) }; delete o[el.dataset.id]; state.vidOver = o; scheduleSave(); toast('Back to the default video');
  A.exVideo(el);
};
