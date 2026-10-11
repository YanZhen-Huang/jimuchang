const path = require('path');
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { ({ chromium } = require('/home/hyz0719/.npm/_npx/9833c18b2d85bc59/node_modules/playwright')); }
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
  await page.goto('file://' + __dirname + '/appicon.html');
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/jc-poster/appicon.png', omitBackground: true });
  await browser.close();
  console.log('icon rendered');
})();
