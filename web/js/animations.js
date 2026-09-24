// 动画引擎：入场/退场/强调/打字机
const sleep = ms => new Promise(r => setTimeout(r, ms));

const Anim = {
  // 默认缓动覆盖（按动画类型）
  defaultEasing: {
    bounceIn: 'easeOutBounce',
    zoomIn: 'easeOutBack',
    pulse: 'easeInOutCubic',
    shake: 'linear',
    wobble: 'easeInOutCubic',
    breathe: 'easeInOutCubic',
    glowPulse: 'easeInOutCubic'
  },

  exitTypes: ['fadeOut', 'flyOutLeft', 'flyOutRight', 'flyOutTop', 'flyOutBottom', 'zoomOut', 'rotateOut'],

  frames(type, el) {
    const W = 1920, H = 1080;
    const op = el.opacity !== undefined ? el.opacity : 1;
    const offL = -(el.x + el.w + 100), offR = W - el.x + 100;
    const offT = -(el.y + el.h + 100), offB = H - el.y + 100;
    switch (type) {
      case 'fadeIn': return [{ opacity: 0 }, { opacity: op }];
      case 'fadeOut': return [{ opacity: op }, { opacity: 0 }];
      case 'flyInLeft': return [{ transform: `translateX(${offL}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: op }];
      case 'flyInRight': return [{ transform: `translateX(${offR}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: op }];
      case 'flyInTop': return [{ transform: `translateY(${offT}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: op }];
      case 'flyInBottom': return [{ transform: `translateY(${offB}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: op }];
      case 'flyOutLeft': return [{ transform: 'translateX(0)', opacity: op }, { transform: `translateX(${offL}px)`, opacity: 0 }];
      case 'flyOutRight': return [{ transform: 'translateX(0)', opacity: op }, { transform: `translateX(${offR}px)`, opacity: 0 }];
      case 'flyOutTop': return [{ transform: 'translateY(0)', opacity: op }, { transform: `translateY(${offT}px)`, opacity: 0 }];
      case 'flyOutBottom': return [{ transform: 'translateY(0)', opacity: op }, { transform: `translateY(${offB}px)`, opacity: 0 }];
      case 'zoomIn': return [{ transform: 'scale(0.35)', opacity: 0 }, { transform: 'scale(1)', opacity: op }];
      case 'zoomOut': return [{ transform: 'scale(1)', opacity: op }, { transform: 'scale(0.35)', opacity: 0 }];
      case 'rotateIn': return [{ transform: 'rotate(-200deg) scale(0.6)', opacity: 0 }, { transform: 'rotate(0deg) scale(1)', opacity: op }];
      case 'rotateOut': return [{ transform: 'rotate(0deg) scale(1)', opacity: op }, { transform: 'rotate(200deg) scale(0.6)', opacity: 0 }];
      case 'bounceIn': return [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1)', opacity: op }];
      case 'flipIn': return [{ transform: 'perspective(900px) rotateY(95deg)', opacity: 0 }, { transform: 'perspective(900px) rotateY(0deg)', opacity: op }];
      case 'pulse': return [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }];
      case 'shake': return [
        { transform: 'translateX(0)' }, { transform: 'translateX(-14px)' }, { transform: 'translateX(14px)' },
        { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }];
      case 'wobble': return [
        { transform: 'translateX(0) rotate(0deg)' }, { transform: 'translateX(-12px) rotate(-4deg)' },
        { transform: 'translateX(10px) rotate(3deg)' }, { transform: 'translateX(0) rotate(0deg)' }];
      case 'breathe': return [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }];
      case 'glowPulse': return [
        { filter: 'drop-shadow(0 0 0px rgba(108,140,255,0))' },
        { filter: 'drop-shadow(0 0 26px rgba(108,140,255,.95))' },
        { filter: 'drop-shadow(0 0 0px rgba(108,140,255,0))' }];
      default: return null;
    }
  },

  async play(el, dom, type, opts = {}) {
    if (!dom || !type) return;
    const animEl = dom.querySelector('.el-anim');
    if (!animEl) return;

    if (type === 'typewriter') return this.typewriter(el, dom, opts);

    const frames = this.frames(type, el);
    if (!frames) return;
    const duration = (opts.duration !== undefined ? opts.duration : 0.6) * 1000;
    const delay = (opts.delay || 0) * 1000;
    const easeName = opts.easing || this.defaultEasing[type] || 'easeOutCubic';

    const a = animEl.animate(frames, {
      duration, delay, easing: Easing.css(easeName), fill: 'both'
    });
    (dom._anims = dom._anims || []).push(a);
    try { await a.finished; } catch (e) { /* canceled */ }
    const idx = dom._anims.indexOf(a);
    if (idx >= 0) dom._anims.splice(idx, 1);
    // 非退场动画：结束后回到自然态
    if (!this.exitTypes.includes(type)) a.cancel();
  },

  async typewriter(el, dom, opts = {}) {
    const t = dom.querySelector('.c-text');
    if (!t) return;
    const full = el.props.text || '';
    t.textContent = '';
    const duration = opts.duration !== undefined ? opts.duration : Math.max(1, full.length * 0.08);
    const per = (duration * 1000) / Math.max(full.length, 1);
    if (opts.delay) await sleep(opts.delay * 1000);
    for (let i = 0; i < full.length; i++) {
      t.textContent += full[i];
      await sleep(per);
    }
  },

  clear(dom) {
    if (!dom || !dom._anims) return;
    dom._anims.forEach(a => { try { a.cancel(); } catch (e) { } });
    dom._anims = [];
  },

  // 清除内联状态（回到自然态）
  reset(el, dom) {
    const animEl = dom.querySelector('.el-anim');
    if (!animEl) return;
    animEl.style.transform = '';
    animEl.style.opacity = '';
    animEl.style.filter = '';
  }
};
