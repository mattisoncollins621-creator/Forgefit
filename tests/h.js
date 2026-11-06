const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
exports.sync = () => {
  execSync('rm -rf /tmp/t/www/* && cp /home/claude/forgefit/{index.html,sw.js,manifest.webmanifest,icon.svg,icon-180.png,icon-192.png,icon-512.png} /tmp/t/www/ && cp /tmp/t/index_v_prev.html /tmp/t/www/prev.html', { shell: '/bin/bash' });
};
exports.serve = port => new Promise(res => {
  const p = spawn('python3', ['-m', 'http.server', String(port), '--directory', '/tmp/t/www', '--bind', '127.0.0.1'], { stdio: 'ignore' });
  setTimeout(() => res(p), 700);
});
let pass = 0, fail = 0; const fails = [];
exports.check = (name, cond, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } };
exports.summary = () => { console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log('FAILED:', fails); return fail; };
exports.newPage = async (b, o = {}) => {
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ...(o.opts || {}) });
  const page = await ctx.newPage();
  // v10: finishing now lives behind "End workout", and the builder tools move into the Edit sheet once a workout has started.
  if (!o.noExpand) { const oc = page.click.bind(page);
    page.click = async (sel, opt) => {
      if (typeof sel === 'string') {
        if (sel === '[data-a=finish]' && !(await page.locator(sel).count())) await page.locator('[data-a=endWorkout]').first().click();
        const m = /^\[data-a=(nl|tplOpen|repeatLast|planOpen|regen|autoSuper|addEx|addCardio)\]$/.exec(sel);
        if (m && !(await page.locator(sel).count()) && await page.locator('[data-a=editWorkout]').count()) { await page.locator('[data-a=editWorkout]').first().click(); sel = `[data-a=editDo][data-x=${m[1]}]`; }
        if (sel === '[data-a=repeatLast]' && !(await page.locator(sel).count()) && await page.locator('[data-a=wkMore]').count()) { await page.locator('[data-a=wkMore]').first().click(); sel = '[data-a=editDo][data-x=repeatLast]'; }
        const sp = /^\[data-a=split\](\[data-v=\w+\])$/.exec(sel);
        if (sp && !(await page.locator(sel).count()) && await page.locator('[data-a=editWorkout]').count()) { await page.locator('[data-a=editWorkout]').first().click(); sel = `[data-a=editDo][data-x=split]${sp[1]}`; }
      }
      return oc(sel, opt);
    }; }
  const errs = []; page.errs = errs;
  page.on('pageerror', e => errs.push('pageerror: ' + e)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  // v10: exercises start as compact rows and settings start collapsed. The older suites test the full cards and every setting, so expand them automatically (new suites opt out with { noExpand: true }).
  if (!o.noExpand) await page.addInitScript(() => {
    const ALL = ['display', 'training', 'sound', 'timers', 'gear', 'lib', 'people', 'data', 'integ', 'adv']; let busy = false;
    const go = () => { if (busy || window.__ffNoExpand) return; try {
      if (typeof state === 'undefined' || !state) return; busy = true;
      if (typeof sessActive === 'function' && !sessActive() && wk().items.some((it, i) => !planOpen.has(it.id || i))) { wk().items.forEach((it, i) => planOpen.add(it.id || i)); renderWorkout(); }
      if (typeof moreOpen !== 'undefined' && !document.querySelector('#tab-more').hidden && ALL.some(k => !moreOpen.has(k))) { ALL.forEach(k => moreOpen.add(k)); renderMore(); }
    } catch (e) { } finally { busy = false; } };
    addEventListener('DOMContentLoaded', () => new MutationObserver(go).observe(document.body, { childList: true, subtree: true }));
  });
  if (o.seed !== false) await page.addInitScript(() => { let s = 777; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
  return { ctx, page };
};
exports.skipOnboarding = async page => { await page.waitForSelector('#onboard:not([hidden])'); await page.click('[data-a=obSkip]'); await page.waitForTimeout(250); };
exports.unknownHooks = page => page.evaluate(() => {
  const miss = []; document.querySelectorAll('[data-a]').forEach(e => { if (!A[e.dataset.a]) miss.push('A.' + e.dataset.a); });
  document.querySelectorAll('[data-f]').forEach(e => { if (!F[e.dataset.f]) miss.push('F.' + e.dataset.f); });
  return [...new Set(miss)];
});
