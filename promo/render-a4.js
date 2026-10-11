const path = require('path');
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { ({ chromium } = require('/home/hyz0719/.npm/_npx/9833c18b2d85bc59/node_modules/playwright')); }
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 2 });
  await page.goto('file://' + __dirname + '/poster-a4.html');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/jc-poster/poster-a4@2x.png' });
  await browser.close();
  console.log('a4 → /tmp/jc-poster/poster-a4@2x.png');
})();
