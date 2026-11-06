const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file:///home/claude/forgefit/index.html'); await p.waitForTimeout(400); await p.click('[data-a=obSkip]');
  const names = () => p.$$eval('#exlist .exn', e => e.map(x => x.textContent.slice(0, 12)));
  console.log('start ', await names());
  const grip = n => p.$(`#exlist .ex:nth-child(${n}) .grip`);
  // drag card 1 down to card 3's slot (hold mouse so we can screenshot mid-drag)
  let g = await (await grip(1)).boundingBox();
  await p.mouse.move(g.x + 15, g.y + 18); await p.mouse.down(); await p.mouse.move(g.x + 15, g.y + 40, { steps: 4 });
  const rows = await p.$$eval('#exlist .ex', e => e.map(x => Math.round(x.getBoundingClientRect().top)));
  console.log('collapsed tops', rows);
  await p.mouse.move(g.x + 15, rows[2] + 40, { steps: 10 });
  await p.screenshot({ path: '/tmp/t/dragging.png' });
  await p.mouse.up(); await p.waitForTimeout(300);
  console.log('after1', await names(), 'scrollY', await p.evaluate(() => scrollY));
  // drag last card to top
  g = await (await grip(5)).boundingBox();
  await p.mouse.move(g.x + 15, g.y + 18); await p.mouse.down(); await p.mouse.move(g.x + 15, g.y - 30, { steps: 4 });
  const t1 = await (await p.$('#exlist .ex:nth-child(1)')).boundingBox();
  await p.mouse.move(g.x + 15, t1.y + 5, { steps: 14 }); await p.mouse.up(); await p.waitForTimeout(300);
  console.log('after2', await names());
  console.log('state==DOM', JSON.stringify(await p.evaluate(() => state.workout.items.map(i => exById(i.exId).name.slice(0, 12)))) === JSON.stringify(await names()));
  // superset warning
  await p.click('[data-a=autoSuper]'); await p.waitForTimeout(100);
  console.log('supersets before', await p.evaluate(() => state.workout.items.map(i => i.superset)));
  g = await (await grip(1)).boundingBox(); await p.mouse.move(g.x + 15, g.y + 18); await p.mouse.down(); await p.mouse.move(g.x + 15, g.y + 40, { steps: 4 });
  const rr = await p.$$eval('#exlist .ex', e => e.map(x => Math.round(x.getBoundingClientRect().top)));
  await p.mouse.move(g.x + 15, rr[3] + 50, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(300);
  console.log('supersets after ', await p.evaluate(() => state.workout.items.map(i => i.superset)), await p.textContent('#toast'));
  await p.screenshot({ path: '/tmp/t/workout.png' });
  await p.click('[data-a=nl]'); await p.waitForTimeout(350); await p.screenshot({ path: '/tmp/t/ql1.png' });
  await p.click('#ql-m-pick'); await p.waitForTimeout(150); await p.screenshot({ path: '/tmp/t/ql2.png' });
  await p.click('#ql-ex .prow'); await p.waitForTimeout(150); await p.screenshot({ path: '/tmp/t/ql3.png' });
  console.log('ERRORS', errs); await b.close();
})();
