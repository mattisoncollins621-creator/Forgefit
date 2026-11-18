/* ---------- touch & drag any trend chart to read the exact date and value ---------- */
(function () {
  let live = null;                                         // { svg, pts, rect }
  const svgX = (svg, cx) => { const r = svg.getBoundingClientRect(); return (cx - r.left) / r.width * svg.viewBox.baseVal.width; };
  function show(svg, cx) {
    let pts; try { pts = JSON.parse(svg.dataset.pts || '[]'); } catch (e) { return; } if (!pts.length) return;
    const x = svgX(svg, cx); let k = 0; pts.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(pts[k][0] - x)) k = i; });
    const p = pts[k], W = svg.viewBox.baseVal.width, base = +svg.dataset.b, top = +svg.dataset.t, u = svg.dataset.u;
    let g = svg.querySelector('g.sc');
    if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'sc'); g.innerHTML = '<line/><circle r="5.5"/><rect rx="7" height="34"/><text class="sv" text-anchor="middle"></text><text class="sd" text-anchor="middle"></text>'; svg.appendChild(g); }
    const label = `${p[3]}${u ? ' ' + u : ''}`, date = fmtDate(p[2], { month: 'short', day: 'numeric', year: 'numeric' });
    const bw = Math.max(label.length * 7.4, date.length * 5.6) + 18, bx = clamp(p[0] - bw / 2, 2, W - bw - 2), by = p[1] - 46 < top - 6 ? p[1] + 12 : p[1] - 46;
    const [ln, c, rc, tv, td] = g.children;
    ln.setAttribute('x1', p[0]); ln.setAttribute('x2', p[0]); ln.setAttribute('y1', top - 4); ln.setAttribute('y2', base);
    c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]);
    rc.setAttribute('x', bx); rc.setAttribute('y', by); rc.setAttribute('width', bw);
    tv.setAttribute('x', bx + bw / 2); tv.setAttribute('y', by + 15); tv.textContent = label;
    td.setAttribute('x', bx + bw / 2); td.setAttribute('y', by + 28); td.textContent = date;
    g.style.display = ''; svg.dataset.sel = k;
    if (svg.dataset.lastK !== String(k)) { svg.dataset.lastK = k; buzz('tick'); }
  }
  const hideAll = except => document.querySelectorAll('svg.scrub g.sc').forEach(g => { if (g.ownerSVGElement !== except) g.style.display = 'none'; });
  document.addEventListener('pointerdown', e => {
    const svg = e.target.closest && e.target.closest('svg.scrub'); hideAll(svg);
    if (!svg) return; live = { svg, x: e.clientX, y: e.clientY, on: e.pointerType === 'mouse' }; if (live.on) show(svg, e.clientX);
  });
  document.addEventListener('pointermove', e => {
    if (!live) return;
    if (!live.on) { const dx = Math.abs(e.clientX - live.x), dy = Math.abs(e.clientY - live.y); if (dy > 10 && dy > dx) { live = null; return; } if (dx > 6) live.on = true; }
    if (live.on) show(live.svg, e.clientX);
  });
  document.addEventListener('pointerup', e => { if (live) { show(live.svg, e.clientX); live = null; } });
  document.addEventListener('pointercancel', () => live = null);
})();
