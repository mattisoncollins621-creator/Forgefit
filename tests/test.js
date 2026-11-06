const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: false });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/forgefit/index.html'); await p.waitForTimeout(500);
  await p.click('[data-a=obSkip]'); await p.waitForTimeout(200);
  const names = () => p.$$eval('#exlist .exn', e => e.map(x => x.textContent));
  const before = await names(); console.log('before', before);
  // drag first card's grip below the third card
  const g = await p.$('#exlist .ex:nth-child(1) .grip'); const gb = await g.boundingBox();
  const c3 = await (await p.$('#exlist .ex:nth-child(3)')).boundingBox();
  await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await p.mouse.down();
  await p.mouse.move(gb.x + 10, gb.y + 60, { steps: 5 }); await p.mouse.move(gb.x + 10, c3.y + c3.height - 20, { steps: 12 });
  await p.screenshot({ path: '/tmp/t/dragging.png' });
  await p.mouse.up(); await p.waitForTimeout(300);
  const after = await names(); console.log('after ', after);
  console.log('moved first to position', after.indexOf(before[0]) + 1);
  await p.screenshot({ path: '/tmp/t/workout.png' });
  // quick log: pick mode, past date
  await p.click('[data-a=nl]'); await p.waitForTimeout(400);
  await p.click('#ql-m-pick'); await p.waitForTimeout(100);
  const rows = await p.$$eval('#ql-ex .prow', e => e.length); console.log('pick rows (today filter)', rows);
  await p.click('[data-a=qlF][data-v=all]'); await p.fill('#ql-q', 'bench'); 
  console.log('search results', await p.$$eval('#ql-ex .prow b', e => e.map(x => x.textContent)));
  await p.click('#ql-ex .prow'); await p.waitForTimeout(100);
  await p.fill('[data-k=sets]', '3'); await p.fill('[data-k=r]', '8'); await p.fill('[data-k=w]', '185'); await p.click('[data-a=qlAdd]');
  await p.click('#ql-m-type'); await p.fill('#ql-text', 'ran 2 miles in 18 min, squat 3x5 at 225'); await p.click('[data-a=qlParse]');
  await p.click('[data-a=qlDay][data-d="1"]');
  console.log('foot', await p.textContent('#ql-foot'));
  await p.screenshot({ path: '/tmp/t/quicklog.png' });
  const recBefore = await p.evaluate(() => rec('Chest'));
  await p.click('[data-a=qlGo]'); await p.waitForTimeout(300);
  const h = await p.evaluate(() => ({ n: state.history.length, h0: { name: state.history[0].name, t: ymd(state.history[0].t), sets: state.history[0].sets, ex: state.history[0].items.map(i => i.name), cardio: state.history[0].cardio.length }, e1: state.e1rm.bb_bench, chest: rec('Chest') }));
  console.log('history', JSON.stringify(h), 'chest before', recBefore);
  // today log
  await p.click('[data-a=nl]'); await p.click('[data-a=qlEx][data-v="pullups 3x10"]'); await p.click('[data-a=qlParse]'); await p.click('[data-a=qlGo]'); await p.waitForTimeout(300);
  console.log('today done sets', await p.evaluate(() => doneSetCount()));
  for (const t of ['recovery', 'progress', 'body', 'more']) { await p.click('#nav-' + t); await p.waitForTimeout(100); }
  await p.click('#nav-workout'); await p.screenshot({ path: '/tmp/t/nav.png', clip: { x: 0, y: 700, width: 390, height: 80 } });
  console.log('ERRORS', errs); await b.close();
})();
