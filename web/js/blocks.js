// 积木系统：自定义积木定义 + 工具箱 + 工作区管理 + IR 编译器
(() => {
  // ---------- 动态下拉数据 ----------
  const sceneOptions = () => {
    const list = (Project.data && Project.data.scenes || []).map(s => [s.name, s.id]);
    return list.length ? list : [['（无场景）', '']];
  };
  const elementOptions = () => {
    const list = [];
    (Project.data && Project.data.scenes || []).forEach(s => {
      s.elements.forEach(e => list.push([e.name, e.id]));
    });
    return list.length ? list : [['（无元素）', '']];
  };
  const audioOptions = () => {
    const list = (Project.data && Project.data.resources || [])
      .filter(r => (r.mime || '').startsWith('audio'))
      .map(r => [r.name, r.id]);
    return list.length ? list : [['（无音频素材）', '']];
  };
  const videoElementOptions = () => {
    const list = [];
    (Project.data && Project.data.scenes || []).forEach(s => {
      s.elements.forEach(e => { if (e.type === 'video') list.push([e.name, e.id]); });
    });
    return list.length ? list : [['（无视频元素）', '']];
  };
  const chartElementOptions = () => {
    const list = [];
    (Project.data && Project.data.scenes || []).forEach(s => {
      s.elements.forEach(e => { if (e.type === 'chart') list.push([e.name, e.id]); });
    });
    return list.length ? list : [['（无图表元素）', '']];
  };
  const webappElementOptions = () => {
    const list = [];
    (Project.data && Project.data.scenes || []).forEach(s => {
      s.elements.forEach(e => { if (e.type === 'webapp') list.push([e.name, e.id]); });
    });
    return list.length ? list : [['（无小程序元素）', '']];
  };
  const modelElementOptions = () => {
    const list = [];
    (Project.data && Project.data.scenes || []).forEach(s => {
      s.elements.forEach(e => { if (e.type === 'model3d') list.push([e.name, e.id]); });
    });
    return list.length ? list : [['（无 3D 模型）', '']];
  };
  const spriteElementOptions = () => {
    const list = [];
    (Project.data && Project.data.scenes || []).forEach(s => {
      s.elements.forEach(e => { if (e.type === 'sprite') list.push([e.name, e.id]); });
    });
    return list.length ? list : [['（无帧动画元素）', '']];
  };

  const ANIM_TYPES = [
    ['淡入', 'fadeIn'], ['从左侧飞入', 'flyInLeft'], ['从右侧飞入', 'flyInRight'],
    ['从上方飞入', 'flyInTop'], ['从下方飞入', 'flyInBottom'],
    ['放大进入', 'zoomIn'], ['旋转进入', 'rotateIn'], ['弹跳进入', 'bounceIn'],
    ['翻转进入', 'flipIn'], ['打字机', 'typewriter'],
    ['淡出', 'fadeOut'], ['飞向左侧', 'flyOutLeft'], ['飞向右侧', 'flyOutRight'],
    ['放大消失', 'zoomOut'], ['旋转消失', 'rotateOut'],
    ['脉冲', 'pulse'], ['抖动', 'shake'], ['摇摆', 'wobble'], ['呼吸', 'breathe'], ['光晕', 'glowPulse']
  ];
  const TRANSITIONS = [
    ['无', 'none'], ['淡入淡出', 'fade'], ['左移入', 'slide-left'], ['右移入', 'slide-right'],
    ['上移入', 'slide-up'], ['下移入', 'slide-down'], ['缩放', 'zoom'],
    ['左擦除', 'wipe'], ['光圈展开', 'iris']
  ];
  const EASINGS = [
    ['线性', 'linear'], ['缓入(二次)', 'easeInQuad'], ['缓出(二次)', 'easeOutQuad'],
    ['缓入缓出(二次)', 'easeInOutQuad'], ['缓入(三次)', 'easeInCubic'], ['缓出(三次)', 'easeOutCubic'],
    ['缓入缓出(三次)', 'easeInOutCubic'], ['回拉进入', 'easeInBack'], ['回拉退出', 'easeOutBack'],
    ['回拉进出', 'easeInOutBack'], ['弹性', 'easeOutElastic'], ['反弹', 'easeOutBounce']
  ];
  const KEYS = [
    ['空格', 'Space'], ['回车', 'Enter'], ['左方向键', 'ArrowLeft'], ['右方向键', 'ArrowRight'],
    ['上方向键', 'ArrowUp'], ['下方向键', 'ArrowDown'], ['字母 A', 'KeyA'], ['字母 B', 'KeyB'], ['字母 C', 'KeyC']
  ];

  // ---------- 颜色 ----------
  const C = { event: '#E6A23C', scene: '#4C7DF0', element: '#4CC38A', anim: '#F0824C', media: '#A06CD5', fx: '#E86CA0', three: '#E0574C' };

  // 自定义积木样式（含帽子）
  const styleDefs = {
    jimu_hat: { colourPrimary: C.event, hat: 'cap' },
    jimu_scene: { colourPrimary: C.scene },
    jimu_element: { colourPrimary: C.element },
    jimu_anim: { colourPrimary: C.anim },
    jimu_media: { colourPrimary: C.media },
    jimu_fx: { colourPrimary: C.fx },
    jimu_3d: { colourPrimary: C.three },
    jimu_adv: { colourPrimary: '#4CC2C0' }
  };

  const defs = {};
  // ---- 事件（帽子块）----
  defs['jimu_on_start'] = {
    init() {
      this.appendDummyInput().appendField('当演示开始');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_on_scene'] = {
    init() {
      this.appendDummyInput().appendField('当进入场景')
        .appendField(new Blockly.FieldDropdown(sceneOptions), 'SCENE');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_on_key'] = {
    init() {
      this.appendDummyInput().appendField('当按下')
        .appendField(new Blockly.FieldDropdown(KEYS), 'KEY')
        .appendField('键');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_on_click'] = {
    init() {
      this.appendDummyInput().appendField('当点击')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };

  // ---- 场景 ----
  defs['jimu_scene_go'] = {
    init() {
      this.appendDummyInput().appendField('切换到场景')
        .appendField(new Blockly.FieldDropdown(sceneOptions), 'SCENE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_scene');
    }
  };
  defs['jimu_scene_next'] = {
    init() {
      this.appendDummyInput().appendField('下一个场景');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_scene');
    }
  };
  defs['jimu_scene_transition'] = {
    init() {
      this.appendDummyInput().appendField('设置转场为')
        .appendField(new Blockly.FieldDropdown(TRANSITIONS), 'TYPE')
        .appendField('时长')
        .appendField(new Blockly.FieldNumber(0.6, 0, 10, 0.1), 'DUR')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_scene');
    }
  };

  // ---- 元素 ----
  defs['jimu_el_show'] = {
    init() {
      this.appendDummyInput().appendField('显示')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_el_hide'] = {
    init() {
      this.appendDummyInput().appendField('隐藏')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_el_text'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('的文字设为');
      this.appendValueInput('TEXT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
      this.setInputsInline(true);
    }
  };
  defs['jimu_el_move'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('移到 x:');
      this.appendValueInput('X');
      this.appendDummyInput().appendField('y:');
      this.appendValueInput('Y');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_el_size'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('的大小设为 宽:');
      this.appendValueInput('W');
      this.appendDummyInput().appendField('高:');
      this.appendValueInput('H');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_el_color'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('的颜色设为')
        .appendField(new Blockly.FieldColour('#6C8CFF'), 'COLOR');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };

  // ---- 动画 ----
  defs['jimu_anim'] = {
    init() {
      this.appendDummyInput().appendField('对')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('播放');
      this.appendDummyInput().appendField('动画')
        .appendField(new Blockly.FieldDropdown(ANIM_TYPES), 'ANIM');
      this.appendDummyInput().appendField('时长')
        .appendField(new Blockly.FieldNumber(0.6, 0, 60, 0.1), 'DUR')
        .appendField('秒 延迟')
        .appendField(new Blockly.FieldNumber(0, 0, 60, 0.1), 'DELAY')
        .appendField('秒');
      this.appendDummyInput().appendField('缓动')
        .appendField(new Blockly.FieldDropdown(EASINGS), 'EASE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_anim');
    }
  };
  defs['jimu_keyframes'] = {
    init() {
      this.appendDummyInput().appendField('对')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('播放关键帧动画');
      this.appendDummyInput().appendField('循环')
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'LOOP');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_anim');
    }
  };
  defs['jimu_wait'] = {
    init() {
      this.appendDummyInput().appendField('等待');
      this.appendValueInput('SEC');
      this.appendDummyInput().appendField('秒');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_anim');
    }
  };

  // ---- 媒体 ----
  defs['jimu_sfx'] = {
    init() {
      this.appendDummyInput().appendField('播放音效')
        .appendField(new Blockly.FieldDropdown(audioOptions), 'RES');
      this.appendDummyInput().appendField('音量')
        .appendField(new Blockly.FieldNumber(1, 0, 1, 0.1), 'VOL');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_music_play'] = {
    init() {
      this.appendDummyInput().appendField('播放背景音乐')
        .appendField(new Blockly.FieldDropdown(audioOptions), 'RES');
      this.appendDummyInput()
        .appendField('循环').appendField(new Blockly.FieldCheckbox('TRUE'), 'LOOP')
        .appendField('音量').appendField(new Blockly.FieldNumber(0.8, 0, 1, 0.1), 'VOL');
      this.appendDummyInput().appendField('淡入')
        .appendField(new Blockly.FieldNumber(0, 0, 10, 0.5), 'FADE')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_music_stop'] = {
    init() {
      this.appendDummyInput().appendField('停止背景音乐 淡出')
        .appendField(new Blockly.FieldNumber(0, 0, 10, 0.5), 'FADE')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_video_ctrl'] = {
    init() {
      this.appendDummyInput().appendField('视频')
        .appendField(new Blockly.FieldDropdown(videoElementOptions), 'ELEMENT')
        .appendField(new Blockly.FieldDropdown([
          ['播放', 'play'], ['暂停', 'pause'], ['停止', 'stop'],
          ['静音', 'mute'], ['取消静音', 'unmute']
        ]), 'ACTION');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };

  // ---- 高级（自制程序）----
  defs['jimu_js'] = {
    init() {
      this.appendDummyInput().appendField('执行代码');
      this.appendDummyInput().appendField(new Blockly.FieldTextInput(
        'jimu.log("你好"); await jimu.wait(1); await jimu.animate("标题", "bounceIn", { duration: 0.8 });'
      ), 'CODE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_adv');
    }
  };
  defs['jimu_webapp_send'] = {
    init() {
      this.appendDummyInput().appendField('向小程序')
        .appendField(new Blockly.FieldDropdown(webappElementOptions), 'ELEMENT')
        .appendField('发送消息');
      this.appendValueInput('MSG');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_adv');
    }
  };
  defs['jimu_on_message'] = {
    init() {
      this.appendDummyInput().appendField('当收到小程序')
        .appendField(new Blockly.FieldDropdown(webappElementOptions), 'ELEMENT')
        .appendField('的消息');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };

  // ---- 3D ----
  const VIEW_PRESETS = [['正面', 'front'], ['侧面', 'side'], ['背面', 'back'], ['俯视', 'top'], ['45 度', 'corner']];
  const LIGHT_PRESETS = [['柔和', 'soft'], ['明亮', 'bright'], ['昏暗', 'dark'], ['冷色', 'cool'], ['暖色', 'warm']];

  defs['jimu_3d_view'] = {
    init() {
      this.appendDummyInput().appendField('3D 模型')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField('镜头到')
        .appendField(new Blockly.FieldDropdown(VIEW_PRESETS), 'PRESET');
      this.appendDummyInput().appendField('时长')
        .appendField(new Blockly.FieldNumber(1, 0, 60, 0.5), 'DUR')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_3d_orbit'] = {
    init() {
      this.appendDummyInput().appendField('3D 模型')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField('环绕一圈');
      this.appendDummyInput().appendField('时长')
        .appendField(new Blockly.FieldNumber(5, 0.5, 60, 0.5), 'DUR')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_3d_zoom'] = {
    init() {
      this.appendDummyInput().appendField('3D 模型')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField('推进/拉远 比例')
        .appendField(new Blockly.FieldNumber(0.7, 0.1, 5, 0.1), 'FACTOR');
      this.appendDummyInput().appendField('时长')
        .appendField(new Blockly.FieldNumber(1, 0, 60, 0.5), 'DUR')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_3d_anim'] = {
    init() {
      this.appendDummyInput().appendField('3D 模型')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField('播放动画');
      this.appendDummyInput().appendField('名称')
        .appendField(new Blockly.FieldTextInput('Dance'), 'NAME')
        .appendField('循环').appendField(new Blockly.FieldCheckbox('TRUE'), 'LOOP')
        .appendField('速度').appendField(new Blockly.FieldNumber(1, 0.1, 5, 0.1), 'SPEED');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_3d_lights'] = {
    init() {
      this.appendDummyInput().appendField('3D 模型灯光')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField(new Blockly.FieldDropdown(LIGHT_PRESETS), 'PRESET');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_3d_autorotate'] = {
    init() {
      this.appendDummyInput().appendField('3D 模型')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField('自动旋转')
        .appendField(new Blockly.FieldDropdown([['开启', 'on'], ['关闭', 'off']]), 'VAL');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };

  // ---- 特效 / 图表 / 帧动画 ----
  defs['jimu_fx_burst'] = {
    init() {
      this.appendDummyInput().appendField('对')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('播放粒子')
        .appendField(new Blockly.FieldDropdown([
          ['星尘', 'stardust'], ['彩带', 'confetti'], ['爱心', 'heart'], ['花瓣', 'petal']
        ]), 'FX');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_fx');
    }
  };
  defs['jimu_chart_refresh'] = {
    init() {
      this.appendDummyInput().appendField('刷新图表')
        .appendField(new Blockly.FieldDropdown(chartElementOptions), 'ELEMENT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_sprite_ctrl'] = {
    init() {
      this.appendDummyInput().appendField('帧动画')
        .appendField(new Blockly.FieldDropdown(spriteElementOptions), 'ELEMENT')
        .appendField(new Blockly.FieldDropdown([
          ['播放', 'play'], ['暂停', 'pause'], ['停止', 'stop']
        ]), 'ACTION');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_sprite_speed'] = {
    init() {
      this.appendDummyInput().appendField('帧动画')
        .appendField(new Blockly.FieldDropdown(spriteElementOptions), 'ELEMENT')
        .appendField('速度设为')
        .appendField(new Blockly.FieldNumber(1, 0.1, 5, 0.1), 'SPEED');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };

  // 注册
  for (const [type, def] of Object.entries(defs)) {
    Blockly.Blocks[type] = def;
  }
  const baseTheme = Blockly.Themes.Zelos || Blockly.Themes.Classic;
  const theme = Blockly.Theme.defineTheme('jimuDark', {
    base: baseTheme,
    blockStyles: styleDefs,
    componentStyles: {
      workspaceBackgroundColour: '#12151C',
      toolboxBackgroundColour: '#161A22',
      toolboxForegroundColour: '#E6E9EF',
      flyoutBackgroundColour: '#1B2029',
      flyoutForegroundColour: '#C9D1E0',
      flyoutOpacity: 1,
      scrollbarColour: '#2A3140',
      insertionMarkerColour: '#6C8CFF',
      insertionMarkerOpacity: 0.5,
      cursorColour: '#6C8CFF',
      blackBackground: true
    },
    fontStyle: { family: '"Source Han Sans SC", "Noto Sans CJK SC", sans-serif', size: 11 }
  });

  const themeLight = Blockly.Theme.defineTheme('jimuLight', {
    base: baseTheme,
    blockStyles: styleDefs,
    componentStyles: {
      workspaceBackgroundColour: '#FBFCFD',
      toolboxBackgroundColour: '#EFF1F5',
      toolboxForegroundColour: '#1F2430',
      flyoutBackgroundColour: '#E6E9EF',
      flyoutForegroundColour: '#333A47',
      flyoutOpacity: 1,
      scrollbarColour: '#C6CDD8',
      insertionMarkerColour: '#4C6EF5',
      insertionMarkerOpacity: 0.4,
      cursorColour: '#4C6EF5',
      blackBackground: false
    },
    fontStyle: { family: '"Source Han Sans SC", "Noto Sans CJK SC", sans-serif', size: 11 }
  });

  window.JimuConst = { ANIM_TYPES, TRANSITIONS, EASINGS, KEYS };

  window.JimuBlocks = {
    theme,
    themeLight,

    setTheme(mode) {
      if (!this.ws) return;
      try { this.ws.setTheme(mode === 'light' ? themeLight : theme); } catch (e) { }
    },
    async init(divId) {
      const ws = Blockly.inject(divId, {
        toolbox: this.toolbox(),
        renderer: 'zelos',
        theme,
        sounds: false,
        media: 'vendor/blockly/media/',
        grid: { spacing: 26, length: 3, colour: '#1C212B', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.3 },
        trashcan: true,
        move: { scrollbars: true, drag: true, wheel: true }
      });
      Blockly.ContextMenuRegistry.registry.unregister?.('blockDelete');
      this.ws = ws;
      this.current = null;
      return ws;
    },

    toolbox() {
      return {
        kind: 'categoryToolbox',
        contents: [
          {
            kind: 'category', name: '事件', colour: C.event,
            contents: [
              { kind: 'block', type: 'jimu_on_start' },
              { kind: 'block', type: 'jimu_on_scene' },
              { kind: 'block', type: 'jimu_on_key' },
              { kind: 'block', type: 'jimu_on_click' }
            ]
          },
          {
            kind: 'category', name: '场景', colour: C.scene,
            contents: [
              { kind: 'block', type: 'jimu_scene_go' },
              { kind: 'block', type: 'jimu_scene_next' },
              { kind: 'block', type: 'jimu_scene_transition' }
            ]
          },
          {
            kind: 'category', name: '元素', colour: C.element,
            contents: [
              { kind: 'block', type: 'jimu_el_show' },
              { kind: 'block', type: 'jimu_el_hide' },
              { kind: 'block', type: 'jimu_el_text', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '你好' } } } } },
              { kind: 'block', type: 'jimu_el_move', inputs: { X: { shadow: { type: 'math_number', fields: { NUM: 100 } } }, Y: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_el_size', inputs: { W: { shadow: { type: 'math_number', fields: { NUM: 400 } } }, H: { shadow: { type: 'math_number', fields: { NUM: 200 } } } } },
              { kind: 'block', type: 'jimu_el_color' }
            ]
          },
          {
            kind: 'category', name: '动画', colour: C.anim,
            contents: [
              { kind: 'block', type: 'jimu_anim' },
              { kind: 'block', type: 'jimu_keyframes' },
              { kind: 'block', type: 'jimu_wait', inputs: { SEC: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } }
            ]
          },
          {
            kind: 'category', name: '媒体', colour: C.media,
            contents: [
              { kind: 'block', type: 'jimu_sfx' },
              { kind: 'block', type: 'jimu_music_play' },
              { kind: 'block', type: 'jimu_music_stop' },
              { kind: 'block', type: 'jimu_video_ctrl' },
              { kind: 'block', type: 'jimu_sprite_ctrl' },
              { kind: 'block', type: 'jimu_sprite_speed' },
              { kind: 'block', type: 'jimu_chart_refresh' }
            ]
          },
          {
            kind: 'category', name: '特效', colour: C.fx,
            contents: [
              { kind: 'block', type: 'jimu_fx_burst' }
            ]
          },
          {
            kind: 'category', name: '高级', colour: '#4CC2C0',
            contents: [
              { kind: 'block', type: 'jimu_js' },
              { kind: 'block', type: 'jimu_webapp_send', inputs: { MSG: { shadow: { type: 'text', fields: { TEXT: 'hello' } } } } },
              { kind: 'block', type: 'jimu_on_message' }
            ]
          },
          {
            kind: 'category', name: '3D', colour: C.three,
            contents: [
              { kind: 'block', type: 'jimu_3d_view' },
              { kind: 'block', type: 'jimu_3d_orbit' },
              { kind: 'block', type: 'jimu_3d_zoom' },
              { kind: 'block', type: 'jimu_3d_anim' },
              { kind: 'block', type: 'jimu_3d_lights' },
              { kind: 'block', type: 'jimu_3d_autorotate' }
            ]
          },
          {
            kind: 'category', name: '逻辑', colour: '#8A93A6',
            contents: [
              { kind: 'block', type: 'controls_if' },
              { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 3 } } } } },
              { kind: 'block', type: 'logic_compare' },
              { kind: 'block', type: 'logic_operation' },
              { kind: 'block', type: 'logic_negate' },
              { kind: 'block', type: 'logic_boolean' },
              { kind: 'block', type: 'math_number' },
              { kind: 'block', type: 'math_arithmetic' },
              { kind: 'block', type: 'text' },
              { kind: 'block', type: 'text_join' }
            ]
          },
          {
            kind: 'category', name: '变量', colour: '#A06CD5', custom: 'VARIABLE'
          },
          {
            kind: 'category', name: '函数', colour: '#A06CD5', custom: 'PROCEDURE'
          }
        ]
      };
    },

    // ---------- 工作区切换 ----------
    switchTo(key) {
      this.save();
      this.current = key;
      const state = key === 'global'
        ? Project.data.globalBlocks
        : (Project.getScene(key) || {}).blocks;
      this.ws.clear();
      if (state) {
        try { Blockly.serialization.workspaces.load(state, this.ws); } catch (e) { console.warn('积木加载失败', e); }
      }
    },

    save() {
      if (!this.ws || !this.current || !Project.data) return;
      const state = Blockly.serialization.workspaces.save(this.ws);
      if (this.current === 'global') Project.data.globalBlocks = state;
      else {
        const sc = Project.getScene(this.current);
        if (sc) sc.blocks = state;
      }
    }
  };
})();

// ---------- IR 编译器 ----------
const IRCompiler = {
  lastOrphanCount: 0,

  compileWorkspace(workspace) {
    const scripts = [];
    const funcs = [];
    let orphans = 0;
    workspace.getTopBlocks(true).forEach(b => {
      if (b.type === 'procedures_defnoreturn' || b.type === 'procedures_defreturn') {
        const fn = { name: b.getFieldValue('NAME'), body: this.statements(b.getInputTargetBlock('STACK')) };
        if (b.type === 'procedures_defreturn') {
          fn.retExpr = this.exprOf(b.getInputTargetBlock('RETURN'));
        }
        funcs.push(fn);
        return;
      }
      const hat = this.hatOf(b);
      if (!hat) { orphans++; return; }
      hat.body = this.statements(b.getNextBlock());
      scripts.push(hat);
    });
    this.lastOrphanCount = orphans;
    this.lastFuncs = funcs;
    return scripts;
  },

  hatOf(b) {
    switch (b.type) {
      case 'jimu_on_start': return { kind: 'onStart' };
      case 'jimu_on_scene': return { kind: 'onSceneEnter', sceneId: b.getFieldValue('SCENE') };
      case 'jimu_on_key': return { kind: 'onKey', key: b.getFieldValue('KEY') };
      case 'jimu_on_click': return { kind: 'onElementClick', elId: b.getFieldValue('ELEMENT') };
      case 'jimu_on_message': return { kind: 'onWebappMessage', elId: b.getFieldValue('ELEMENT') };
      default: return null;
    }
  },

  statements(block) {
    const out = [];
    while (block) {
      try {
        const ir = this.compile(block);
        if (ir) out.push(ir);
      } catch (e) {
        console.warn('积木编译失败:', block.type, e);
      }
      block = block.getNextBlock();
    }
    return out;
  },

  compile(b) {
    switch (b.type) {
      case 'jimu_scene_go': return { op: 'scene.go', sceneId: b.getFieldValue('SCENE') };
      case 'jimu_scene_next': return { op: 'scene.next' };
      case 'jimu_scene_transition': return { op: 'scene.transition', type: b.getFieldValue('TYPE'), duration: Number(b.getFieldValue('DUR')) };
      case 'jimu_el_show': return { op: 'el.show', elId: b.getFieldValue('ELEMENT') };
      case 'jimu_el_hide': return { op: 'el.hide', elId: b.getFieldValue('ELEMENT') };
      case 'jimu_el_text': return { op: 'el.text', elId: b.getFieldValue('ELEMENT'), text: this.expr(b, 'TEXT') };
      case 'jimu_el_move': return { op: 'el.move', elId: b.getFieldValue('ELEMENT'), x: this.expr(b, 'X'), y: this.expr(b, 'Y') };
      case 'jimu_el_size': return { op: 'el.size', elId: b.getFieldValue('ELEMENT'), w: this.expr(b, 'W'), h: this.expr(b, 'H') };
      case 'jimu_el_color': return { op: 'el.color', elId: b.getFieldValue('ELEMENT'), color: b.getFieldValue('COLOR') };
      case 'jimu_anim': return {
        op: 'el.anim', elId: b.getFieldValue('ELEMENT'), anim: b.getFieldValue('ANIM'),
        duration: Number(b.getFieldValue('DUR')), delay: Number(b.getFieldValue('DELAY')),
        easing: b.getFieldValue('EASE')
      };
      case 'jimu_keyframes': return {
        op: 'el.keyframes', elId: b.getFieldValue('ELEMENT'),
        loop: b.getFieldValue('LOOP') === 'TRUE'
      };
      case 'jimu_wait': return { op: 'wait', sec: this.expr(b, 'SEC') };
      case 'jimu_sfx': return {
        op: 'media.sfx', resId: b.getFieldValue('RES'),
        volume: Number(b.getFieldValue('VOL'))
      };
      case 'jimu_music_play': return {
        op: 'media.music', resId: b.getFieldValue('RES'),
        loop: b.getFieldValue('LOOP') === 'TRUE',
        volume: Number(b.getFieldValue('VOL')), fadeIn: Number(b.getFieldValue('FADE'))
      };
      case 'jimu_music_stop': return { op: 'media.music.stop', fadeOut: Number(b.getFieldValue('FADE')) };
      case 'jimu_video_ctrl': return {
        op: 'media.video', elId: b.getFieldValue('ELEMENT'),
        action: b.getFieldValue('ACTION')
      };
      case 'jimu_js': return {
        op: 'js.eval',
        code: String(b.getFieldValue('CODE') || '').replace(/\\n/g, '\n')
      };
      case 'jimu_webapp_send': return {
        op: 'webapp.send', elId: b.getFieldValue('ELEMENT'), msg: this.expr(b, 'MSG')
      };
      case 'jimu_3d_view': return {
        op: '3d.view', elId: b.getFieldValue('ELEMENT'), preset: b.getFieldValue('PRESET'),
        duration: Number(b.getFieldValue('DUR'))
      };
      case 'jimu_3d_orbit': return {
        op: '3d.orbit', elId: b.getFieldValue('ELEMENT'), duration: Number(b.getFieldValue('DUR'))
      };
      case 'jimu_3d_zoom': return {
        op: '3d.zoom', elId: b.getFieldValue('ELEMENT'),
        factor: Number(b.getFieldValue('FACTOR')), duration: Number(b.getFieldValue('DUR'))
      };
      case 'jimu_3d_anim': return {
        op: '3d.anim', elId: b.getFieldValue('ELEMENT'), name: b.getFieldValue('NAME'),
        loop: b.getFieldValue('LOOP') === 'TRUE', speed: Number(b.getFieldValue('SPEED'))
      };
      case 'jimu_3d_lights': return {
        op: '3d.lights', elId: b.getFieldValue('ELEMENT'), preset: b.getFieldValue('PRESET')
      };
      case 'jimu_3d_autorotate': return {
        op: '3d.autorotate', elId: b.getFieldValue('ELEMENT'), value: b.getFieldValue('VAL') === 'on'
      };
      case 'jimu_fx_burst': return {
        op: 'fx.burst', elId: b.getFieldValue('ELEMENT'), fxType: b.getFieldValue('FX')
      };
      case 'jimu_chart_refresh': return { op: 'chart.refresh', elId: b.getFieldValue('ELEMENT') };
      case 'jimu_sprite_ctrl': return {
        op: 'sprite.ctrl', elId: b.getFieldValue('ELEMENT'), action: b.getFieldValue('ACTION')
      };
      case 'jimu_sprite_speed': return {
        op: 'sprite.speed', elId: b.getFieldValue('ELEMENT'), value: Number(b.getFieldValue('SPEED'))
      };
      case 'procedures_callnoreturn': return {
        op: 'func.call',
        name: b.getFieldValue('NAME') || (b.extraState && b.extraState.name)
      };
      case 'controls_if': return this.compileIf(b);
      case 'controls_repeat_ext':
        return { op: 'ctrl.repeat', times: this.expr(b, 'TIMES'), body: this.statements(b.getInputTargetBlock('DO')) };
      case 'variables_set':
        return { op: 'var.set', name: b.getFieldValue('VAR'), value: this.expr(b, 'VALUE') };
      case 'text_print':
        return { op: 'log', text: this.expr(b, 'TEXT') };
      default:
        return null;
    }
  },

  compileIf(b) {
    const branches = [];
    branches.push({ cond: this.expr(b, 'IF0'), body: this.statements(b.getInputTargetBlock('DO0')) });
    const n = b.elseifCount_ || 0;
    for (let i = 1; i <= n; i++) {
      branches.push({ cond: this.expr(b, 'IF' + i), body: this.statements(b.getInputTargetBlock('DO' + i)) });
    }
    const elseBody = b.elseCount_ ? this.statements(b.getInputTargetBlock('ELSE')) : null;
    return { op: 'ctrl.if', branches, elseBody };
  },

  expr(b, name) { return this.exprOf(b.getInputTargetBlock(name)); },

  exprOf(b) {
    if (!b) return { k: 'num', v: 0 };
    switch (b.type) {
      case 'math_number': return { k: 'num', v: Number(b.getFieldValue('NUM')) || 0 };
      case 'text': return { k: 'str', v: b.getFieldValue('TEXT') };
      case 'logic_boolean': return { k: 'bool', v: b.getFieldValue('BOOL') === 'TRUE' };
      case 'variables_get': return { k: 'var', name: b.getFieldValue('VAR') };
      case 'math_arithmetic': return {
        k: 'bin', op: b.getFieldValue('OP'),
        a: this.exprOf(b.getInputTargetBlock('A')), b: this.exprOf(b.getInputTargetBlock('B'))
      };
      case 'logic_compare': return {
        k: 'cmp', op: b.getFieldValue('OP'),
        a: this.exprOf(b.getInputTargetBlock('A')), b: this.exprOf(b.getInputTargetBlock('B'))
      };
      case 'logic_operation': return {
        k: 'log', op: b.getFieldValue('OP'),
        a: this.exprOf(b.getInputTargetBlock('A')), b: this.exprOf(b.getInputTargetBlock('B'))
      };
      case 'logic_negate': return { k: 'not', v: this.exprOf(b.getInputTargetBlock('BOOL')) };
      case 'procedures_callreturn': return {
        k: 'call',
        name: b.getFieldValue('NAME') || (b.extraState && b.extraState.name)
      };
      case 'text_join': {
        const n = b.itemCount_ || 0;
        const parts = [];
        for (let i = 0; i < n; i++) parts.push(this.exprOf(b.getInputTargetBlock('ADD' + i)));
        return { k: 'join', parts };
      }
      default: return { k: 'num', v: 0 };
    }
  }
};
