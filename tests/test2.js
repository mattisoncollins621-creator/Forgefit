const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file:///home/claude/forgefit/index.html'); await p.waitForTimeout(400); await p.click('[data-a=obSkip]');
  // parser checks
  const parsed = await p.evaluate(() => ['pullups 3x10', 'bench 185x8x3', 'squat 3x5 at 225', 'bench 185 for 8', 'ran 2 miles in 18 min'].map(t => { const r = parseLine(t); return [t, r.err || (r.ex.name + ' ' + r.sets + 'x' + r.r + '@' + r.w + (r.min ? ' ' + r.min + 'min' : ''))]; }));
  console.log(parsed);
  const names = () => p.$$eval('#exlist .exn', e => e.map(x => x.textContent.slice(0, 14)));
  const b0 = await names(); console.log(b0);
  const move = async (from, toY) => {
    const g = await (await p.$(`#exlist .ex:nth-child(${from}) .grip`)).boundingBox();
    await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await p.mouse.down(); await p.mouse.move(g.x + 5, toY, { steps: 14 }); await p.mouse.up(); await p.waitForTimeout(250);
  };
  const c2 = await (await p.$('#exlist .ex:nth-child(2)')).boundingBox();
  await move(1, c2.y + c2.height * 0.7); console.log('drag 1 -> just past middle of 2:', await names());
  await move(2, (await (await p.$('#exlist .ex:nth-child(1)')).boundingBox()).y + 20); console.log('drag 2 -> top:', await names());
  const state1 = await p.evaluate(() => state.workout.items.map(i => exById(i.exId).name.slice(0, 14)));
  console.log('state order matches DOM:', JSON.stringify(state1) === JSON.stringify(await names()));
  await p.screenshot({ path: '/tmp/t/workout.png' });
  await p.click('[data-a=nl]'); await p.waitForTimeout(350); await p.screenshot({ path: '/tmp/t/ql1.png' });
  await p.click('#ql-m-pick'); await p.waitForTimeout(150); await p.screenshot({ path: '/tmp/t/ql2.png' });
  console.log('ERRORS', errs); await b.close();
})();
