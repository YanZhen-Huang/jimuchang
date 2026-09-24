// 缓动模块：可插拔注册表（预设 12 条，支持外部注册）
const Easing = (() => {
  const fns = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => 1 - (1 - t) * (1 - t),
    easeInOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    easeInCubic: t => t * t * t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeInBack: t => 2.70158 * t * t * t - 1.70158 * t * t,
    easeOutBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    easeInOutBack: t => t < .5
      ? Math.pow(2 * t, 2) * (3.5949095 * 2 * t - 2.5949095) / 2
      : (Math.pow(2 * t - 2, 2) * (3.5949095 * (2 * t - 2) + 2.5949095) + 2) / 2,
    easeOutElastic: t => t === 0 ? 0 : t === 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
    easeOutBounce: t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
      return n * (t -= 2.625 / d) * t + .984375;
    }
  };

  // CSS 缓动字符串：简单曲线用 cubic-bezier，复杂曲线用 linear() 采样
  const bezier = {
    linear: 'linear',
    easeInQuad: 'cubic-bezier(0.55,0.085,0.68,0.53)',
    easeOutQuad: 'cubic-bezier(0.25,0.46,0.45,0.94)',
    easeInOutQuad: 'cubic-bezier(0.455,0.03,0.515,0.955)',
    easeInCubic: 'cubic-bezier(0.55,0.055,0.675,0.19)',
    easeOutCubic: 'cubic-bezier(0.215,0.61,0.355,1)',
    easeInOutCubic: 'cubic-bezier(0.645,0.045,0.355,1)',
    easeInBack: 'cubic-bezier(0.6,-0.28,0.735,0.045)',
    easeOutBack: 'cubic-bezier(0.175,0.885,0.32,1.275)'
  };

  function toLinear(fn, n = 40) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(fn(i / n).toFixed(4));
    return 'linear(' + pts.join(',') + ')';
  }

  const cssCache = {};
  return {
    names: Object.keys(fns),
    fn: name => fns[name] || fns.linear,
    css(name) {
      if (cssCache[name]) return cssCache[name];
      return (cssCache[name] = bezier[name] || toLinear(fns[name] || fns.linear));
    },
    register(name, fn) { fns[name] = fn; }
  };
})();
