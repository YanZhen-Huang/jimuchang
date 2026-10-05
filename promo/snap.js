// 静帧预览：只截指定时间点的单帧（审美迭代用，秒级出图）
// 用法：node snap.js 1.3 6 9.5 14.5 20.5 27
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('/home/hyz0719/.npm/_npx/9833c18b2d85bc59/node_modules/playwright')); }

(async () => {
  const times = process.argv.slice(2).map(Number);
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'promo.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  for (const t of times) {
    await page.evaluate(tt => window.setTime(tt), t);
    await page.screenshot({ path: `/tmp/snap-${String(t).replace('.', '_')}.png` });
  }
  await browser.close();
  console.log('snap done:', times.join(', '));
})().catch(e => { console.error('SNAP|error|' + (e && e.message || e)); process.exit(1); });
