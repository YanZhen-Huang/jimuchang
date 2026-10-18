// 章节模式：把结构化章节流程确定性地转换为 Blockly 序列化状态。
// 规则：auto 模式由章节配置生成；manual 模式保留用户手工积木，生成器不覆盖。
const ChapterFlow = (() => {
  const FLOW_VERSION = 1;
  const DEFAULT_ANIM = 'fadeIn';
  const DEFAULT_EASING = 'easeOutCubic';

  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };

  const animNames = () => {
    if (typeof JimuConst !== 'undefined' && Array.isArray(JimuConst.ANIM_TYPES)) {
      return new Set(JimuConst.ANIM_TYPES.map(x => x[1]));
    }
    return null;
  };

  function ensure(ch) {
    if (!ch) return null;
    if (!ch.flow || typeof ch.flow !== 'object') ch.flow = { version: FLOW_VERSION, steps: [] };
    if (!Array.isArray(ch.flow.steps)) ch.flow.steps = [];
    ch.flow.version = FLOW_VERSION;
    if (ch.flowMode !== 'auto' && ch.flowMode !== 'manual') {
      ch.flowMode = ch.blocks ? 'manual' : 'auto';
    }
    return ch.flow;
  }

  function chapterExists(id) {
    return !!(Project.data && Project.data.chapters.find(ch => ch.id === id));
  }

  function visibleIn(ch, el) {
    const vis = ch && ch.preset && ch.preset.visibility;
    return !vis || vis[el.id] !== false;
  }

  function visibleElements(ch) {
    return ((Project.data && Project.data.elements) || []).filter(el => visibleIn(ch, el));
  }

  function normalize(ch) {
    const flow = ensure(ch);
    if (!flow) return false;
    const allowedAnims = animNames();
    const out = [];
    (flow.steps || []).forEach(raw => {
      if (!raw || typeof raw !== 'object') return;
      if (raw.kind === 'animate') {
        const el = raw.elementId && Project.data.elements.find(x => x.id === raw.elementId);
        if (!el || !visibleIn(ch, el)) return;
        const anim = allowedAnims && !allowedAnims.has(raw.anim) ? DEFAULT_ANIM : (raw.anim || DEFAULT_ANIM);
        out.push({
          kind: 'animate',
          elementId: raw.elementId,
          anim,
          duration: clamp(raw.duration, 0.1, 20, 0.6),
          delay: clamp(raw.delay, 0, 20, 0),
          easing: raw.easing || DEFAULT_EASING
        });
      } else if (raw.kind === 'wait') {
        out.push({ kind: 'wait', seconds: clamp(raw.seconds, 0.1, 120, 1) });
      } else if (raw.kind === 'next') {
        out.push({ kind: 'next' });
      } else if (raw.kind === 'jump') {
        const target = raw.chapterId && chapterExists(raw.chapterId) ? raw.chapterId : '';
        out.push(target && target !== ch.id
          ? { kind: 'jump', chapterId: target }
          : { kind: 'next' });
      }
    });
    const changed = JSON.stringify(out) !== JSON.stringify(flow.steps);
    if (changed) flow.steps = out;
    return changed;
  }

  function generateState(ch) {
    const flow = ensure(ch);
    if (!flow) return null;
    normalize(ch);

    const blocks = [{ type: 'jimu_on_scene', fields: { SCENE: ch.id } }];
    const bg = ch.preset && ch.preset.background;
    const bgColor = bg && (typeof bg.value === 'string' ? bg.value : (bg.type === 'color' ? bg.value : ''));
    if (typeof bgColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(bgColor)) {
      blocks.push({ type: 'jimu_scene_bg', fields: { COLOR: bgColor } });
    }
    const visibility = ch.preset && ch.preset.visibility || {};
    ((Project.data && Project.data.elements) || []).forEach(el => {
      const visible = visibility[el.id] !== false;
      blocks.push({
        type: visible ? 'jimu_el_show' : 'jimu_el_hide',
        fields: { ELEMENT: el.id }
      });
    });
    flow.steps.forEach(step => {
      if (step.kind === 'animate') {
        blocks.push({
          type: 'jimu_anim',
          fields: {
            ELEMENT: step.elementId,
            ANIM: step.anim,
            DUR: step.duration,
            DELAY: step.delay,
            EASE: step.easing
          }
        });
      } else if (step.kind === 'wait') {
        blocks.push({
          type: 'jimu_wait',
          inputs: {
            SEC: { shadow: { type: 'math_number', fields: { NUM: step.seconds } } }
          }
        });
      } else if (step.kind === 'next') {
        blocks.push({ type: 'jimu_scene_next' });
      } else if (step.kind === 'jump') {
        blocks.push({ type: 'jimu_scene_go', fields: { SCENE: step.chapterId } });
      }
    });
    for (let i = blocks.length - 1; i > 0; i--) blocks[i - 1].next = { block: blocks[i] };
    return { blocks: { languageVersion: 0, blocks: [blocks[0]] } };
  }

  function sync(ch) {
    if (!ch) return null;
    ensure(ch);
    if (ch.flowMode !== 'auto') return ch.blocks;
    ch.blocks = generateState(ch);
    return ch.blocks;
  }

  function syncAll() {
    ((Project.data && Project.data.chapters) || []).forEach(ch => sync(ch));
  }

  function markManual(ch) {
    if (!ch) return;
    ensure(ch);
    ch.flowMode = 'manual';
  }

  function addStep(ch, kind, patch = {}) {
    const flow = ensure(ch);
    if (!flow) return null;
    let step = null;
    if (kind === 'animate') {
      const first = visibleElements(ch)[0];
      if (!first) return null;
      step = {
        kind: 'animate',
        elementId: patch.elementId || first.id,
        anim: patch.anim || DEFAULT_ANIM,
        duration: clamp(patch.duration, 0.1, 20, 0.6),
        delay: clamp(patch.delay, 0, 20, 0),
        easing: patch.easing || DEFAULT_EASING
      };
    } else if (kind === 'wait') {
      step = { kind: 'wait', seconds: clamp(patch.seconds, 0.1, 120, 1) };
    } else if (kind === 'next') {
      step = { kind: 'next' };
    } else if (kind === 'jump') {
      const target = ((Project.data && Project.data.chapters) || []).find(x => x.id !== ch.id);
      if (!target) return null;
      step = { kind: 'jump', chapterId: patch.chapterId || target.id };
    }
    if (!step) return null;
    flow.steps.push(step);
    return step;
  }

  function removeElement(elementId) {
    if (!elementId || !Project.data) return false;
    let changed = false;
    Project.data.chapters.forEach(ch => {
      const flow = ensure(ch);
      const before = flow.steps.length;
      flow.steps = flow.steps.filter(s => s.kind !== 'animate' || s.elementId !== elementId);
      if (flow.steps.length !== before) changed = true;
      sync(ch);
    });
    return changed;
  }

  function onChapterDeleted(chapterId) {
    if (!Project.data) return;
    Project.data.chapters.forEach(ch => {
      const flow = ensure(ch);
      flow.steps.forEach(step => {
        if (step.kind === 'jump' && (!chapterExists(step.chapterId) || step.chapterId === chapterId)) {
          step.kind = 'next';
          delete step.chapterId;
        }
      });
      sync(ch);
    });
  }

  function cloneChapterFlow(src, dst) {
    if (!src || !dst) return;
    ensure(src);
    dst.flow = JSON.parse(JSON.stringify(src.flow));
    dst.flow.steps.forEach(step => {
      if (step.kind === 'jump' && step.chapterId === src.id) step.chapterId = dst.id;
    });
    dst.flowMode = src.flowMode === 'manual' ? 'manual' : 'auto';
    if (dst.flowMode === 'auto') sync(dst);
    else dst.blocks = null;
  }

  return {
    ensure,
    normalize,
    generateState,
    sync,
    syncAll,
    markManual,
    addStep,
    removeElement,
    onChapterDeleted,
    cloneChapterFlow,
    visibleElements,
    visibleIn
  };
})();

window.ChapterFlow = ChapterFlow;
