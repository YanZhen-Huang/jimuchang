// 积木剧场宣传片 · 逐帧渲染器
// 原理：Playwright(系统 Edge, headless) 按虚拟时间轴逐帧 setTime → JPEG 序列 → ffmpeg 合成 1080p MP4
// 用法：node render.js [时长秒=30] [输出路径=~/Desktop/积木剧场-宣传片.mp4]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

(async () => {
  const fps = 30;
  const dur = Number(process.argv[2] || 30);
  const outMp4 = process.argv[3] || path.join(os.homedir(), 'Desktop/积木剧场-宣传片.mp4');
  const outDir = '/tmp/jimuchang-promo-frames';
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // playwright：优先常规解析，找不到时退回 npx 缓存（本机无项目级依赖）
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { ({ chromium } = require('/home/hyz0719/.npm/_npx/9833c18b2d85bc59/node_modules/playwright')); }

  console.log('启动 Edge (headless)…');
  const browser = await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--force-color-profile=srgb', '--hide-scrollbars']
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'promo.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const total = Math.round(fps * dur);
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate(tt => window.setTime(tt), i / fps);
    await page.screenshot({ path: `${outDir}/f_${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (i % 90 === 0) process.stdout.write(`  帧 ${i}/${total}\n`);
  }
  await browser.close();
  const rz = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`截图完成：${total} 帧，用时 ${rz}s（${(total / rz).toFixed(1)} fps）`);

  console.log('ffmpeg 合成中…');
  execFileSync('ffmpeg', ['-y', '-framerate', String(fps), '-i', `${outDir}/f_%05d.jpg`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', outMp4], { stdio: ['ignore', 'ignore', 'inherit'] });
  const sz = fs.statSync(outMp4).size;
  console.log(`DONE|${outMp4}|${(sz / 1048576).toFixed(2)}MB|frames=${total}`);
})().catch(e => { console.error('RENDER|error|' + (e && e.message || e)); process.exit(1); });
