// 海报渲染：Playwright(系统 Edge, headless) 1080x1920 @2x → PNG
const path = require('path');
const os = require('os');

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { ({ chromium } = require('/home/hyz0719/.npm/_npx/9833c18b2d85bc59/node_modules/playwright')); }
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, 'poster.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const out = process.argv[2] || '/tmp/jc-poster/poster@2x.png';
  await page.screenshot({ path: out });
  await browser.close();
  console.log('poster →', out);
})();
