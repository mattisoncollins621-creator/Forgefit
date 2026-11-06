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
  const errs = []; page.errs = errs;
  page.on('pageerror', e => errs.push('pageerror: ' + e)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  if (o.seed !== false) await page.addInitScript(() => { let s = 777; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
  return { ctx, page };
};
exports.skipOnboarding = async page => { await page.waitForSelector('#onboard:not([hidden])'); await page.click('[data-a=obSkip]'); await page.waitForTimeout(250); };
exports.unknownHooks = page => page.evaluate(() => {
  const miss = []; document.querySelectorAll('[data-a]').forEach(e => { if (!A[e.dataset.a]) miss.push('A.' + e.dataset.a); });
  document.querySelectorAll('[data-f]').forEach(e => { if (!F[e.dataset.f]) miss.push('F.' + e.dataset.f); });
  return [...new Set(miss)];
});
