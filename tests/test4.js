const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file:///home/claude/forgefit/index.html'); await p.waitForTimeout(400); await p.click('[data-a=obSkip]');
  const names = () => p.$$eval('#exlist .exn', e => e.map(x => x.textContent.slice(0, 12)));
  console.log('start ', await names());
  // scroll so last card is visible, drag it to the top
  await p.evaluate(() => document.querySelector('#exlist .ex:nth-child(5)').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(100);
  const sy0 = await p.evaluate(() => scrollY);
  let g = await (await p.$('#exlist .ex:nth-child(5) .grip')).boundingBox();
  await p.mouse.move(g.x + 15, g.y + 18); await p.mouse.down(); await p.mouse.move(g.x + 15, g.y - 20, { steps: 4 });
  const tops = await p.$$eval('#exlist .ex', e => e.map(x => Math.round(x.getBoundingClientRect().top)));
  console.log('scrollY before', sy0, 'collapsed tops', tops);
  await p.mouse.move(g.x + 15, 150, { steps: 25 });
  console.log('scrollY mid-drag', await p.evaluate(() => scrollY));
  await p.screenshot({ path: '/tmp/t/dragging.png' });
  await p.mouse.up(); await p.waitForTimeout(300);
  console.log('after', await names());
  console.log('ERRORS', errs); await b.close();
})();
