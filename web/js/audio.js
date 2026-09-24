// 音频管理：背景音乐 + 音效池
const AudioMgr = {
  bgm: null,
  sfxPool: [],
  sfxIndex: 0,

  playMusic(url, { loop = true, volume = 0.8, fadeIn = 0 } = {}) {
    this.stopMusic();
    if (!url) return;
    const a = new window.Audio(url);
    a.loop = !!loop;
    a.volume = fadeIn > 0 ? 0 : volume;
    a.play().catch(e => console.warn('音乐播放失败', e));
    if (fadeIn > 0) this.fade(a, volume, fadeIn);
    this.bgm = a;
  },

  stopMusic(fadeOut = 0) {
    if (!this.bgm) return;
    const a = this.bgm;
    this.bgm = null;
    if (fadeOut > 0) {
      this.fade(a, 0, fadeOut).then(() => { a.pause(); a.src = ''; });
    } else {
      a.pause();
      a.src = '';
    }
  },

  fade(audio, target, sec) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const v0 = audio.volume;
      const step = () => {
        const t = Math.min((performance.now() - t0) / (sec * 1000), 1);
        try { audio.volume = Math.max(0, Math.min(1, v0 + (target - v0) * t)); } catch (e) { }
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  },

  sfx(url, volume = 1) {
    if (!url) return;
    let a = this.sfxPool[this.sfxIndex];
    if (!a) { a = new window.Audio(); this.sfxPool[this.sfxIndex] = a; }
    this.sfxIndex = (this.sfxIndex + 1) % 8;
    try {
      a.src = url;
      a.volume = Math.max(0, Math.min(1, volume));
      a.currentTime = 0;
      a.play().catch(() => { });
    } catch (e) { }
  },

  // 循环环境音通道（音频元素"循环 + 进场景自动播放"用）
  loopSfx: null,

  playLoopSfx(url, volume = 1) {
    this.stopLoopSfx();
    if (!url) return;
    const a = new window.Audio(url);
    a.loop = true;
    a.volume = Math.max(0, Math.min(1, volume));
    a.play().catch(() => { });
    this.loopSfx = a;
  },

  stopLoopSfx() {
    if (!this.loopSfx) return;
    try { this.loopSfx.pause(); this.loopSfx.src = ''; } catch (e) { }
    this.loopSfx = null;
  },

  stopAll() {
    this.stopMusic();
    this.stopLoopSfx();
    this.sfxPool.forEach(a => { try { a.pause(); } catch (e) { } });
  }
};
