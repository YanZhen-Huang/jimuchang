// 渲染 logo（正/反版）为透明底 PNG @512
const path = require('path');
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { ({ chromium } = require('/home/hyz0719/.npm/_npx/9833c18b2d85bc59/node_modules/playwright')); }
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
  const light = '<polygon points="52,20 76,20 100,106 28,106" fill="#B8862B" opacity="0.24"/><circle cx="51" cy="74" r="6.5" fill="#1C1F26"/><circle cx="77" cy="74" r="6.5" fill="#1C1F26"/><rect x="31" y="78" width="66" height="26" rx="3" fill="#1C1F26"/>';
  const dark = '<polygon points="52,20 76,20 100,106 28,106" fill="#D8A94A" opacity="0.4"/><circle cx="51" cy="74" r="6.5" fill="#F4F2ED"/><circle cx="77" cy="74" r="6.5" fill="#F4F2ED"/><rect x="31" y="78" width="66" height="26" rx="3" fill="#F4F2ED"/>';
  for (const [name, body] of [['logo', light], ['logo-dark', dark]]) {
    await page.setContent(`<style>*{margin:0}body{width:256px;height:256px;background:transparent}</style>
      <svg width="256" height="256" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
    await page.waitForTimeout(150);
    const out = `/tmp/jc-poster/${name}.png`;
    await page.screenshot({ path: out, omitBackground: true });
    console.log('saved', out);
  }
  await browser.close();
})();
