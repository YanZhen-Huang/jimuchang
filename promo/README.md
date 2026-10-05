# 积木剧场 · 宣传片（代码化渲染）

不是用剪辑软件剪的，而是**一个 HTML 时间轴 + 逐帧渲染**：

```
promo.html      1920×1080 动画（window.setTime(t) 确定性渲染任意时刻）
render.js       Playwright(系统 Edge headless) 逐帧 setTime → JPEG → ffmpeg 合成 MP4
```

## 重新渲染

```bash
cd promo
node render.js 30 ~/Desktop/积木剧场-宣传片.mp4   # 30 = 时长（秒）
```

- 依赖：系统 Edge（`microsoft-edge`）、Node、ffmpeg（系统自带）、npx 缓存里的 playwright
- 渲染 900 帧约 40 秒（22 fps），输出 1080p / 30fps / ~3.4MB
- 改动 `promo.html` 里任意元素/时间轴 → 重渲即可，无掉帧、无时序抖动（帧 = 纯函数 f(t)）

## 时间轴（30s）

| 时间 | 场景 | 内容 |
|---|---|---|
| 0–4.5s | 开场 | 灯笼 + 「积木剧场」标题 + 副标题 |
| 4.5–11s | 拖积木 | 三块积木（事件/动画/声音）飞入拼接 → 播放 |
| 11–17.5s | 能力 | 3D 机器人与图表截图卡片层叠 + 特性 pill |
| 17.5–24s | 导出 | 四张导出卡（HTML / MP4 / PPT / exe）依次点亮 |
| 24–30s | 结尾 | 标题 + GitHub + 全屏粒子爆发 |

## 发去哪

- 微信 / 视频号：直接用 `~/Desktop/积木剧场-宣传片.mp4`
- GitHub Release 附件 / 发布页 `<video>`：需要时再上（问用户拍板）
