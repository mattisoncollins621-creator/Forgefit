/* ---------- share card: a clean image of a finished workout ---------- */
const SC_W = 1080, SC_H = 1350;
function scRound(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function scImg(svg) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }); }
function scFit(c, text, max) { let t = text; while (c.measureText(t).width > max && t.length > 4) t = t.slice(0, -2); return t === text ? t : t.replace(/\s+\S*$/, '') + '…'; }
async function shareCardCanvas(h, ach) {
  const cv = document.createElement('canvas'); cv.width = SC_W; cv.height = SC_H; const c = cv.getContext('2d');
  const ff = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif', F = (w, s) => `${w} ${s}px ${ff}`;
  // canvas + soft brand glow
  c.fillStyle = '#0A0C10'; c.fillRect(0, 0, SC_W, SC_H);
  const gl = c.createRadialGradient(SC_W - 120, 80, 0, SC_W - 120, 80, 700); gl.addColorStop(0, 'rgba(249,115,22,.22)'); gl.addColorStop(1, 'rgba(249,115,22,0)'); c.fillStyle = gl; c.fillRect(0, 0, SC_W, SC_H);
  // brand
  scRound(c, 72, 72, 64, 64, 16); c.fillStyle = '#F97316'; c.fill();
  c.save(); c.translate(104, 104); c.rotate(Math.PI / 4); c.fillStyle = '#1A0B02'; scRound(c, -18, -24, 36, 18, 5); c.fill(); scRound(c, -4.5, -6, 9, 32, 4); c.fill(); c.restore();
  c.textBaseline = 'alphabetic'; c.font = F(800, 34); c.fillStyle = '#F8FAFC'; c.fillText('FORGE', 160, 116); const fw = c.measureText('FORGE').width; c.fillStyle = '#F97316'; c.fillText('FIT', 160 + fw, 116);
  // date + title
  const d = h.t ? new Date(h.t) : new Date();
  c.font = F(500, 32); c.fillStyle = '#94A3B8'; c.fillText(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + (h.t ? ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''), 72, 236);
  c.font = F(800, 84); c.fillStyle = '#F8FAFC'; c.fillText(scFit(c, h.name || 'Workout', SC_W - 144), 72, 336);
  // stat tiles
  const stats = [[h.dur ? h.dur + ' min' : '—', 'Active time'], [(h.vol || 0).toLocaleString(), (h.unit || unit()) + ' volume'], [String(h.sets || 0), 'Hard sets'], [String(h.prs || 0), h.prs === 1 ? 'PR' : 'PRs'], [h.kcal ? '≈ ' + h.kcal.toLocaleString() : '—', 'kcal (estimate)']];
  const tw = (SC_W - 144 - 2 * 24) / 3, th = 146;
  stats.forEach(([v, l], k) => {
    const row = k < 3 ? 0 : 1, col = k < 3 ? k : k - 3, w2 = row ? (SC_W - 144 - 24) / 2 : tw, x = 72 + col * (w2 + 24), y = 392 + row * (th + 24);
    scRound(c, x, y, w2, th, 28); c.fillStyle = '#141721'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2; c.stroke();
    let fs = 54; c.font = F(800, fs); while (c.measureText(v).width > w2 - 56 && fs > 30) { fs -= 2; c.font = F(800, fs); }
    c.fillStyle = k === 3 && h.prs ? '#FB923C' : '#F8FAFC'; c.fillText(v, x + 28, y + 76);
    c.font = F(500, 27); c.fillStyle = '#94A3B8'; c.fillText(l, x + 28, y + 116);
  });
  // highlights (records, milestones) under the tiles
  let y = 392 + 2 * th + 24 + 58;
  const hl = (ach || []).slice(0, 2).map(a => a.t);
  c.font = F(600, 30); hl.forEach(t => { c.fillStyle = '#FB923C'; c.beginPath(); c.arc(84, y - 10, 8, 0, 7); c.fill(); c.fillStyle = '#E2E8F0'; c.fillText(scFit(c, t, SC_W - 180), 110, y); y += 48; });
  if (hl.length) y += 20;
  // muscles hit: two figures + top list, sized to the space that's left
  const L = itemsLoad(h.items || []), top = MUSCLES.filter(m => L[m] >= .5).sort((a, b) => L[b] - L[a]).slice(0, 5);
  c.font = F(700, 34); c.fillStyle = '#F8FAFC'; c.fillText('Muscles worked', 72, y);
  if (top.length) {
    const mx = L[top[0]], W = {}; MUSCLES.forEach(m => { if (L[m] >= .5) W[m] = L[m] / mx; });
    const p = heatPaint(W, m => m), [fr, bk] = await Promise.all([scImg(bodySvg('front', p, true)), scImg(bodySvg('back', p, true))]);
    const fy = y + 26, fh = Math.min(440, SC_H - 110 - fy), fwid = fh * 200 / 392; c.drawImage(fr, 60, fy, fwid, fh); c.drawImage(bk, 60 + fwid - 10, fy, fwid, fh);
    const lx = 72 + 2 * fwid + 30, lw = SC_W - 72 - lx, step = Math.min(84, (fh - 30) / top.length);
    top.forEach((m, k) => {
      const ry = fy + 36 + k * step;
      c.font = F(600, 29); c.fillStyle = '#E2E8F0'; c.fillText(m, lx, ry);
      c.font = F(700, 27); c.fillStyle = '#94A3B8'; c.textAlign = 'right'; c.fillText(fmtN(Math.round(L[m] * 2) / 2) + ' sets', SC_W - 72, ry); c.textAlign = 'left';
      scRound(c, lx, ry + 13, lw, 10, 5); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill();
      scRound(c, lx, ry + 13, Math.max(10, lw * L[m] / mx), 10, 5); c.fillStyle = '#F97316'; c.fill();
    });
  } else { c.font = F(500, 30); c.fillStyle = '#94A3B8'; c.fillText('Cardio session', 72, y + 60); }
  c.font = F(500, 26); c.fillStyle = '#64748B'; c.fillText('Tracked with ForgeFit', 72, SC_H - 64);
  return cv;
}
let scBlob = null, scName = '';
A.shareCard = async el => {
  const h = state.history.find(x => x.id === el.dataset.id); if (!h) { toast('That session is no longer in your history'); return; }
  const ls = window.__lastSession, ach = ls && ls.rec && ls.rec.id === h.id ? ls.ach : null;
  try {
    const cv = await shareCardCanvas(h, ach);
    scBlob = await new Promise(r => cv.toBlob(r, 'image/png')); scName = `forgefit-${new Date(h.t || Date.now()).toISOString().slice(0, 10)}.png`;
    const url = URL.createObjectURL(scBlob);
    openSheet('Share your workout', `<div class="col"><img class="scimg" src="${url}" alt="Workout summary image: ${esc(h.name || 'Workout')}"><div class="grid2"><button class="btn sec" data-a="shareSave">${ic('down')} Save image</button><button class="btn pri" data-a="shareGo">${ic('share')} Share</button></div></div>`);
  } catch (e) { toast('Could not make the image on this device'); }
};
A.shareGo = async () => {
  if (!scBlob) return; const file = new File([scBlob], scName, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'My workout' }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  A.shareSave();
};
A.shareSave = () => {
  if (!scBlob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(scBlob); a.download = scName; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); toast('Image saved');
};
