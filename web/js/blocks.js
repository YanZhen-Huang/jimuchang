// 积木系统：自定义积木定义 + 工具箱 + 工作区管理 + IR 编译器
(() => {
  // ---------- 动态下拉数据 ----------
  const sceneOptions = () => {
    const list = (Project.data && Project.data.chapters || []).map(s => [s.name, s.id]);
    return list.length ? list : [['（无章节）', '']];
  };
  const elementOptions = () => {
    const list = [['本克隆体（克隆脚本用）', '@self']];
    (Project.data && Project.data.elements || []).forEach(e => list.push([e.name, e.id]));
    return list;
  };
  const audioOptions = () => {
    const list = (Project.data && Project.data.resources || [])
      .filter(r => (r.mime || '').startsWith('audio'))
      .map(r => [r.name, r.id]);
    return list.length ? list : [['（无音频素材）', '']];
  };
  const videoElementOptions = () => {
    const list = (Project.data && Project.data.elements || []).filter(e => e.type === 'video').map(e => [e.name, e.id]);
    return list.length ? list : [['（无视频元素）', '']];
  };
  const chartElementOptions = () => {
    const list = (Project.data && Project.data.elements || []).filter(e => e.type === 'chart').map(e => [e.name, e.id]);
    return list.length ? list : [['（无图表元素）', '']];
  };
  const webappElementOptions = () => {
    const list = (Project.data && Project.data.elements || []).filter(e => e.type === 'webapp').map(e => [e.name, e.id]);
    return list.length ? list : [['（无小程序元素）', '']];
  };
  const modelElementOptions = () => {
    const list = (Project.data && Project.data.elements || []).filter(e => e.type === 'model3d').map(e => [e.name, e.id]);
    return list.length ? list : [['（无 3D 模型）', '']];
  };
  const spriteElementOptions = () => {
    const list = (Project.data && Project.data.elements || []).filter(e => e.type === 'sprite').map(e => [e.name, e.id]);
    return list.length ? list : [['（无帧动画元素）', '']];
  };
  const sliderElementOptions = () => {
    const list = (Project.data && Project.data.elements || []).filter(e => e.type === 'slider').map(e => [e.name, e.id]);
    return list.length ? list : [['（无滑块元素）', '']];
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
    jimu_adv: { colourPrimary: '#4CC2C0' },
    jimu_motion: { colourPrimary: '#4C8DF0' },
    jimu_sense: { colourPrimary: '#7C6CF0' },
    jimu_ctrl: { colourPrimary: '#8A93A6' },
    jimu_math: { colourPrimary: '#4E9A6B' },
    jimu_data: { colourPrimary: '#D08A3C' },
    jimu_pen: { colourPrimary: '#B36BC9' },
    jimu_func: { colourPrimary: '#A06CD5' },
    jimu_text: { colourPrimary: '#5B9BD5' }
  };

  // Blockly 13 移除了内置 FieldColour，用轻量替代（hex 输入 + 校验）
  class FieldHex extends Blockly.FieldTextInput {
    constructor(value) {
      super(value || '#6C8CFF', v => {
        const str = String(v == null ? '' : v).trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(str)) return null;
        return str.toLowerCase();
      });
    }
  }

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
      this.appendDummyInput().appendField('当进入章节')
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
  // ---- 交互三件套：滑块 / 悬停 / 图表点击（事件帽子）----
  defs['jimu_on_slider'] = {
    init() {
      this.appendDummyInput().appendField('当滑块')
        .appendField(new Blockly.FieldDropdown(sliderElementOptions), 'ELEMENT')
        .appendField('的值改变');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_on_hover'] = {
    init() {
      this.appendDummyInput().appendField('当鼠标移入')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_on_hover_out'] = {
    init() {
      this.appendDummyInput().appendField('当鼠标移出')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_on_chart_click'] = {
    init() {
      this.appendDummyInput().appendField('当点击图表')
        .appendField(new Blockly.FieldDropdown(chartElementOptions), 'ELEMENT');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };

  // ---- 场景 ----
  defs['jimu_scene_go'] = {
    init() {
      this.appendDummyInput().appendField('跳到章节')
        .appendField(new Blockly.FieldDropdown(sceneOptions), 'SCENE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_scene');
    }
  };
  defs['jimu_scene_next'] = {
    init() {
      this.appendDummyInput().appendField('下一个章节');
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
        .appendField(new FieldHex('#6C8CFF'), 'COLOR');
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

  // ---- 感知（表达式）----
  const ELEMENT_PROPS = [
    ['x 坐标', 'x'], ['y 坐标', 'y'], ['宽度', 'w'], ['高度', 'h'],
    ['旋转', 'rotation'], ['透明度', 'opacity']
  ];
  defs['jimu_get_prop'] = {
    init() {
      this.appendDummyInput().appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('的')
        .appendField(new Blockly.FieldDropdown(ELEMENT_PROPS), 'PROP');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_scene_name'] = {
    init() {
      this.appendDummyInput().appendField('当前章节名');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_timer'] = {
    init() {
      this.appendDummyInput().appendField('计时器（秒）');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_timer_reset'] = {
    init() {
      this.appendDummyInput().appendField('重置计时器');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_rand_color'] = {
    init() {
      this.appendDummyInput().appendField('随机颜色');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };

  // ---- 元素扩充（气泡/万能设置/层级/复制删除）----
  const SET_PROPS = [
    ['x', 'x'], ['y', 'y'], ['宽度', 'w'], ['高度', 'h'], ['旋转', 'rotation'],
    ['透明度', 'opacity'], ['颜色', 'color']
  ];
  defs['jimu_el_set'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('的')
        .appendField(new Blockly.FieldDropdown(SET_PROPS), 'PROP')
        .appendField('设为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_el_layer'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('置于')
        .appendField(new Blockly.FieldDropdown([['最前', 'front'], ['最后', 'back']]), 'WHERE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_say'] = {
    init() {
      this.appendDummyInput().appendField('让')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('说');
      this.appendValueInput('TEXT');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_say_secs'] = {
    init() {
      this.appendDummyInput().appendField('让')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('说');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('持续')
        .appendField(new Blockly.FieldNumber(3, 0.1, 60, 0.5), 'SECS')
        .appendField('秒');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_say_stop'] = {
    init() {
      this.appendDummyInput().appendField('停止')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('说话');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_clone'] = {
    init() {
      this.appendDummyInput().appendField('克隆')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_on_clone'] = {
    init() {
      this.appendDummyInput().appendField('当克隆体启动');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_clone_delete'] = {
    init() {
      this.appendDummyInput().appendField('删除本克隆体');
      this.setPreviousStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_el_clone'] = {
    init() {
      this.appendDummyInput().appendField('复制')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_el_remove'] = {
    init() {
      this.appendDummyInput().appendField('删除')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };

  // ---- 场景扩充 ----
  defs['jimu_scene_replay'] = {
    init() {
      this.appendDummyInput().appendField('重播本章节');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_scene');
    }
  };
  defs['jimu_scene_restart'] = {
    init() {
      this.appendDummyInput().appendField('从头开始播放');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_scene');
    }
  };
  defs['jimu_scene_bg'] = {
    init() {
      this.appendDummyInput().appendField('把背景色设为')
        .appendField(new FieldHex('#0F1115'), 'COLOR');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_scene');
    }
  };

  // ---- 逻辑扩充（自定义控制块）----
  defs['jimu_wait_until'] = {
    init() {
      this.appendDummyInput().appendField('等待直到');
      this.appendValueInput('COND');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_ctrl');
    }
  };
  defs['jimu_repeat_until'] = {
    init() {
      this.appendDummyInput().appendField('重复直到');
      this.appendValueInput('COND');
      this.setInputsInline(true);
      this.appendStatementInput('DO');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_ctrl');
    }
  };
  defs['jimu_stop_script'] = {
    init() {
      this.appendDummyInput().appendField('停止本脚本');
      this.setPreviousStatement(true);
      this.setStyle('jimu_ctrl');
    }
  };

  // ---- 媒体扩充 ----
  defs['jimu_volume'] = {
    init() {
      this.appendDummyInput().appendField('把背景音乐音量设为')
        .appendField(new Blockly.FieldNumber(80, 0, 100, 5), 'VOL')
        .appendField('%');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_stop_all_sound'] = {
    init() {
      this.appendDummyInput().appendField('停止所有声音');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };

  // ---- 3D 扩充 ----
  defs['jimu_3d_scale'] = {
    init() {
      this.appendDummyInput().appendField('设置')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField('模型缩放');
      this.appendValueInput('SCALE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_3d_pause'] = {
    init() {
      this.appendDummyInput().appendField('3D 模型')
        .appendField(new Blockly.FieldDropdown(modelElementOptions), 'ELEMENT')
        .appendField('动画')
        .appendField(new Blockly.FieldDropdown([['暂停', 'pause'], ['继续', 'resume']]), 'ACTION');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };

  // ---- 运动（Scratch 式动作积木）----
  const CHANGE_PROPS = [
    ['x', 'x'], ['y', 'y'], ['旋转', 'rotation'], ['大小(%)', 'size'], ['透明度(%)', 'opacity']
  ];

  defs['jimu_glide'] = {
    init() {
      this.appendDummyInput().appendField('让')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('在');
      this.appendValueInput('DUR');
      this.appendDummyInput().appendField('秒内滑行到');
      this.appendValueInput('X');
      this.appendDummyInput().appendField('y:');
      this.appendValueInput('Y');
      this.appendDummyInput().appendField('缓动')
        .appendField(new Blockly.FieldDropdown(EASINGS), 'EASE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_steps'] = {
    init() {
      this.appendDummyInput().appendField('让')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('沿朝向移动');
      this.appendValueInput('STEPS');
      this.appendDummyInput().appendField('步');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_face'] = {
    init() {
      this.appendDummyInput().appendField('让')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('面向');
      this.appendValueInput('ANGLE');
      this.appendDummyInput().appendField('度');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_change'] = {
    init() {
      this.appendDummyInput().appendField('将')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('的')
        .appendField(new Blockly.FieldDropdown(CHANGE_PROPS), 'PROP')
        .appendField('增加');
      this.appendValueInput('DELTA');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_frame'] = {
    init() {
      this.appendDummyInput().appendField('让')
        .appendField(new Blockly.FieldDropdown(spriteElementOptions), 'ELEMENT')
        .appendField(new Blockly.FieldDropdown([
          ['下一个造型', 'next'], ['切换到第', 'set']
        ]), 'ACTION');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
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
  // ---- 交互三件套：图表数据读写 + 滑块读写 ----
  defs['jimu_chart_set'] = {
    init() {
      this.appendDummyInput().appendField('设置图表')
        .appendField(new Blockly.FieldDropdown(chartElementOptions), 'ELEMENT')
        .appendField('的数值为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_chart_cats'] = {
    init() {
      this.appendDummyInput().appendField('设置图表')
        .appendField(new Blockly.FieldDropdown(chartElementOptions), 'ELEMENT')
        .appendField('的分类为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_slider_set'] = {
    init() {
      this.appendDummyInput().appendField('设置滑块')
        .appendField(new Blockly.FieldDropdown(sliderElementOptions), 'ELEMENT')
        .appendField('的值为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_slider_value'] = {
    init() {
      this.appendDummyInput().appendField('滑块')
        .appendField(new Blockly.FieldDropdown(sliderElementOptions), 'ELEMENT')
        .appendField('的值');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_chart_click'] = {
    init() {
      this.appendDummyInput().appendField('图表点击的')
        .appendField(new Blockly.FieldDropdown([
          ['类别', 'name'], ['数值', 'value'], ['序号', 'index'], ['系列名', 'series']
        ]), 'WHAT');
      this.setOutput(true);
      this.setStyle('jimu_sense');
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

  // ================================================================
  // 自我版积木（元素脚本专用）：无元素下拉，天然作用于"自己"
  // 命名规则：jimu_self_ + 原块名（去 jimu_）= 编译层自动归一映射
  // ================================================================

  // ---- 自我版：事件（元素脚本域帽子）----
  defs['jimu_self_on_start'] = {
    init() {
      this.appendDummyInput().appendField('当我开始');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_self_on_click'] = {
    init() {
      this.appendDummyInput().appendField('当点击我');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_self_on_message'] = {
    init() {
      this.appendDummyInput().appendField('当收到消息');
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('消息1'), 'MSG');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_self_on_clone'] = {
    init() {
      this.appendDummyInput().appendField('当克隆体启动时');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  // ---- 自我版：交互三件套事件 ----
  defs['jimu_self_on_slider'] = {
    init() {
      this.appendDummyInput().appendField('当我的滑块值改变');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_self_on_hover'] = {
    init() {
      this.appendDummyInput().appendField('当鼠标移入我');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_self_on_hover_out'] = {
    init() {
      this.appendDummyInput().appendField('当鼠标移出我');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };
  defs['jimu_self_on_chart_click'] = {
    init() {
      this.appendDummyInput().appendField('当我的图表被点击');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };

  // ---- 自我版：运动 ----
  defs['jimu_self_steps'] = {
    init() {
      this.appendDummyInput().appendField('沿朝向移动');
      this.appendValueInput('STEPS');
      this.appendDummyInput().appendField('步');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_self_glide'] = {
    init() {
      this.appendDummyInput().appendField('在');
      this.appendValueInput('DUR');
      this.appendDummyInput().appendField('秒内滑行到');
      this.appendValueInput('X');
      this.appendDummyInput().appendField('y:');
      this.appendValueInput('Y');
      this.appendDummyInput().appendField('缓动')
        .appendField(new Blockly.FieldDropdown(EASINGS), 'EASE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_self_face'] = {
    init() {
      this.appendDummyInput().appendField('面向');
      this.appendValueInput('ANGLE');
      this.appendDummyInput().appendField('度');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_self_change'] = {
    init() {
      this.appendDummyInput().appendField('将')
        .appendField(new Blockly.FieldDropdown(CHANGE_PROPS), 'PROP')
        .appendField('增加');
      this.appendValueInput('DELTA');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_self_el_move'] = {
    init() {
      this.appendDummyInput().appendField('移到 x:');
      this.appendValueInput('X');
      this.appendDummyInput().appendField('y:');
      this.appendValueInput('Y');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };
  defs['jimu_self_frame'] = {
    init() {
      this.appendDummyInput().appendField('帧动画')
        .appendField(new Blockly.FieldDropdown([
          ['下一个造型', 'next'], ['切换到第', 'set']
        ]), 'ACTION');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_motion');
    }
  };

  // ---- 自我版：外观 ----
  defs['jimu_self_el_show'] = {
    init() {
      this.appendDummyInput().appendField('显示');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_el_hide'] = {
    init() {
      this.appendDummyInput().appendField('隐藏');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_el_text'] = {
    init() {
      this.appendDummyInput().appendField('把文字设为');
      this.appendValueInput('TEXT');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_el_size'] = {
    init() {
      this.appendDummyInput().appendField('大小设为 宽:');
      this.appendValueInput('W');
      this.appendDummyInput().appendField('高:');
      this.appendValueInput('H');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_el_color'] = {
    init() {
      this.appendDummyInput().appendField('颜色设为')
        .appendField(new FieldHex('#6C8CFF'), 'COLOR');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_el_set'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(SET_PROPS), 'PROP')
        .appendField('设为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_el_layer'] = {
    init() {
      this.appendDummyInput().appendField('置于')
        .appendField(new Blockly.FieldDropdown([['最前', 'front'], ['最后', 'back']]), 'WHERE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_say'] = {
    init() {
      this.appendDummyInput().appendField('说');
      this.appendValueInput('TEXT');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_say_secs'] = {
    init() {
      this.appendDummyInput().appendField('说');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('持续')
        .appendField(new Blockly.FieldNumber(3, 0.1, 60, 0.5), 'SECS')
        .appendField('秒');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_self_say_stop'] = {
    init() {
      this.appendDummyInput().appendField('停止说话');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };

  // ---- 自我版：动画 ----
  defs['jimu_self_anim'] = {
    init() {
      this.appendDummyInput().appendField('播放动画')
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
  defs['jimu_self_keyframes'] = {
    init() {
      this.appendDummyInput().appendField('播放关键帧动画');
      this.appendDummyInput().appendField('循环')
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'LOOP');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_anim');
    }
  };

  // ---- 自我版：克隆 ----
  defs['jimu_self_clone'] = {
    init() {
      this.appendDummyInput().appendField('克隆自己');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };

  // ---- 自我版：媒体 ----
  defs['jimu_self_video_ctrl'] = {
    init() {
      this.appendDummyInput().appendField('视频')
        .appendField(new Blockly.FieldDropdown([
          ['播放', 'play'], ['暂停', 'pause'], ['停止', 'stop'],
          ['静音', 'mute'], ['取消静音', 'unmute']
        ]), 'ACTION');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_self_sprite_ctrl'] = {
    init() {
      this.appendDummyInput().appendField('帧动画')
        .appendField(new Blockly.FieldDropdown([
          ['播放', 'play'], ['暂停', 'pause'], ['停止', 'stop']
        ]), 'ACTION');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_self_sprite_speed'] = {
    init() {
      this.appendDummyInput().appendField('帧动画速度设为')
        .appendField(new Blockly.FieldNumber(1, 0.1, 5, 0.1), 'SPEED');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_self_chart_refresh'] = {
    init() {
      this.appendDummyInput().appendField('刷新图表');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_self_chart_set'] = {
    init() {
      this.appendDummyInput().appendField('设置我的图表数值为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_self_chart_cats'] = {
    init() {
      this.appendDummyInput().appendField('设置我的图表分类为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_self_slider_set'] = {
    init() {
      this.appendDummyInput().appendField('设置我的滑块值为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_self_slider_value'] = {
    init() {
      this.appendDummyInput().appendField('我的滑块值');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };

  // ---- 自我版：感知（表达式）----
  defs['jimu_self_get_prop'] = {
    init() {
      this.appendDummyInput().appendField('我的')
        .appendField(new Blockly.FieldDropdown(ELEMENT_PROPS), 'PROP');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };

  // ---- 自我版：特效 ----
  defs['jimu_self_fx_burst'] = {
    init() {
      this.appendDummyInput().appendField('播放粒子')
        .appendField(new Blockly.FieldDropdown([
          ['星尘', 'stardust'], ['彩带', 'confetti'], ['爱心', 'heart'], ['花瓣', 'petal']
        ]), 'FX');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_fx');
    }
  };

  // ---- 自我版：3D ----
  defs['jimu_self_3d_view'] = {
    init() {
      this.appendDummyInput().appendField('镜头到')
        .appendField(new Blockly.FieldDropdown(VIEW_PRESETS), 'PRESET');
      this.appendDummyInput().appendField('时长')
        .appendField(new Blockly.FieldNumber(1, 0, 60, 0.5), 'DUR')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_self_3d_orbit'] = {
    init() {
      this.appendDummyInput().appendField('环绕一圈');
      this.appendDummyInput().appendField('时长')
        .appendField(new Blockly.FieldNumber(5, 0.5, 60, 0.5), 'DUR')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_self_3d_zoom'] = {
    init() {
      this.appendDummyInput().appendField('推进/拉远 比例')
        .appendField(new Blockly.FieldNumber(0.7, 0.1, 5, 0.1), 'FACTOR');
      this.appendDummyInput().appendField('时长')
        .appendField(new Blockly.FieldNumber(1, 0, 60, 0.5), 'DUR')
        .appendField('秒');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_self_3d_anim'] = {
    init() {
      this.appendDummyInput().appendField('播放模型动画');
      this.appendDummyInput().appendField('名称')
        .appendField(new Blockly.FieldTextInput('Dance'), 'NAME')
        .appendField('循环').appendField(new Blockly.FieldCheckbox('TRUE'), 'LOOP')
        .appendField('速度').appendField(new Blockly.FieldNumber(1, 0.1, 5, 0.1), 'SPEED');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_self_3d_lights'] = {
    init() {
      this.appendDummyInput().appendField('灯光')
        .appendField(new Blockly.FieldDropdown(LIGHT_PRESETS), 'PRESET');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_self_3d_autorotate'] = {
    init() {
      this.appendDummyInput().appendField('自动旋转')
        .appendField(new Blockly.FieldDropdown([['开启', 'on'], ['关闭', 'off']]), 'VAL');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_self_3d_scale'] = {
    init() {
      this.appendDummyInput().appendField('模型缩放');
      this.appendValueInput('SCALE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };
  defs['jimu_self_3d_pause'] = {
    init() {
      this.appendDummyInput().appendField('模型动画')
        .appendField(new Blockly.FieldDropdown([['暂停', 'pause'], ['继续', 'resume']]), 'ACTION');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_3d');
    }
  };

  // ================================================================
  // S2 补全积木：数学扩展 / 文本处理 / 侦测 / 控制
  // ================================================================
  const touchTargetOptions = () => {
    const list = [['舞台边缘', '@edge']];
    (Project.data && Project.data.elements || []).forEach(e => list.push([e.name, e.id]));
    return list;
  };

  // ---- 数学扩展 ----
  defs['jimu_bitwise'] = {
    init() {
      this.appendValueInput('A');
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([['与', 'and'], ['或', 'or'], ['异或', 'xor']]), 'OP');
      this.appendValueInput('B');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_math');
    }
  };
  defs['jimu_shift'] = {
    init() {
      this.appendValueInput('A');
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([['左移', 'shl'], ['右移', 'shr']]), 'OP');
      this.appendValueInput('B');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_math');
    }
  };

  // ---- 文本处理 ----
  defs['jimu_text_letter'] = {
    init() {
      this.appendDummyInput().appendField('文字');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('的第');
      this.appendValueInput('N');
      this.appendDummyInput().appendField('个字符');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_text');
    }
  };
  defs['jimu_text_contains'] = {
    init() {
      this.appendDummyInput().appendField('文字');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('包含');
      this.appendValueInput('SUB');
      this.appendDummyInput().appendField('？');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_text');
    }
  };
  defs['jimu_text_replace'] = {
    init() {
      this.appendDummyInput().appendField('把文字');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('中的');
      this.appendValueInput('FROM');
      this.appendDummyInput().appendField('替换为');
      this.appendValueInput('TO');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_text');
    }
  };
  defs['jimu_text_case'] = {
    init() {
      this.appendDummyInput().appendField('文字');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('转为')
        .appendField(new Blockly.FieldDropdown([['大写', 'upper'], ['小写', 'lower']]), 'OP');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_text');
    }
  };
  defs['jimu_text_trim'] = {
    init() {
      this.appendDummyInput().appendField('文字');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('去掉首尾空格');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_text');
    }
  };

  // ---- 侦测 ----
  defs['jimu_mouse'] = {
    init() {
      this.appendDummyInput().appendField('鼠标')
        .appendField(new Blockly.FieldDropdown([['x 坐标', 'x'], ['y 坐标', 'y']]), 'AXIS');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_mouse_down'] = {
    init() {
      this.appendDummyInput().appendField('鼠标按下？');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_touch'] = {
    init() {
      this.appendDummyInput().appendField('元素')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT');
      this.appendDummyInput().appendField('碰到')
        .appendField(new Blockly.FieldDropdown(touchTargetOptions), 'TARGET');
      this.appendDummyInput().appendField('？');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_self_touch'] = {
    init() {
      this.appendDummyInput().appendField('我碰到')
        .appendField(new Blockly.FieldDropdown(touchTargetOptions), 'TARGET');
      this.appendDummyInput().appendField('？');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_ask'] = {
    init() {
      this.appendDummyInput().appendField('询问');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('并等待');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_answer'] = {
    init() {
      this.appendDummyInput().appendField('回答');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };

  // ---- 控制扩充 ----
  defs['jimu_stop_all'] = {
    init() {
      this.appendDummyInput().appendField('停止全部脚本');
      this.setPreviousStatement(true);
      this.setStyle('jimu_ctrl');
    }
  };

  // ---- 数据/列表 ----
  const listNameField = () => new Blockly.FieldTextInput('列表1');
  defs['jimu_list_add'] = {
    init() {
      this.appendDummyInput().appendField('把');
      this.appendValueInput('VALUE');
      this.appendDummyInput().appendField('加入列表').appendField(listNameField(), 'NAME');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_delete'] = {
    init() {
      this.appendDummyInput().appendField('删除列表').appendField(listNameField(), 'NAME');
      this.appendDummyInput().appendField('的第');
      this.appendValueInput('N');
      this.appendDummyInput().appendField('项');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_insert'] = {
    init() {
      this.appendDummyInput().appendField('在列表').appendField(listNameField(), 'NAME');
      this.appendDummyInput().appendField('的第');
      this.appendValueInput('N');
      this.appendDummyInput().appendField('项前插入');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_replace'] = {
    init() {
      this.appendDummyInput().appendField('把列表').appendField(listNameField(), 'NAME');
      this.appendDummyInput().appendField('的第');
      this.appendValueInput('N');
      this.appendDummyInput().appendField('项替换为');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_clear'] = {
    init() {
      this.appendDummyInput().appendField('清空列表').appendField(listNameField(), 'NAME');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_split'] = {
    init() {
      this.appendDummyInput().appendField('把文字');
      this.appendValueInput('TEXT');
      this.appendDummyInput().appendField('按');
      this.appendValueInput('SEP');
      this.appendDummyInput().appendField('分割到列表').appendField(listNameField(), 'NAME');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_item'] = {
    init() {
      this.appendDummyInput().appendField('列表').appendField(listNameField(), 'NAME');
      this.appendDummyInput().appendField('的第');
      this.appendValueInput('N');
      this.appendDummyInput().appendField('项');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_length'] = {
    init() {
      this.appendDummyInput().appendField('列表').appendField(listNameField(), 'NAME')
        .appendField('的项目数');
      this.setOutput(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_contains'] = {
    init() {
      this.appendDummyInput().appendField('列表').appendField(listNameField(), 'NAME');
      this.appendDummyInput().appendField('包含');
      this.appendValueInput('VALUE');
      this.appendDummyInput().appendField('？');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_index_of'] = {
    init() {
      this.appendDummyInput().appendField('列表').appendField(listNameField(), 'NAME');
      this.appendDummyInput().appendField('中');
      this.appendValueInput('VALUE');
      this.appendDummyInput().appendField('的编号');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_data');
    }
  };
  defs['jimu_list_join'] = {
    init() {
      this.appendDummyInput().appendField('把列表').appendField(listNameField(), 'NAME');
      this.appendDummyInput().appendField('用');
      this.appendValueInput('SEP');
      this.appendDummyInput().appendField('连接成文字');
      this.setInputsInline(true);
      this.setOutput(true);
      this.setStyle('jimu_data');
    }
  };

  // ---- 小众包：日期时间 / 音乐 / 拖拽 / 画笔 ----
  defs['jimu_datetime'] = {
    init() {
      this.appendDummyInput().appendField('当前')
        .appendField(new Blockly.FieldDropdown([
          ['时间（时:分:秒）', 'time'], ['日期（年-月-日）', 'date'], ['星期', 'weekday'],
          ['年', 'year'], ['月', 'month'], ['日', 'day'],
          ['小时', 'hour'], ['分钟', 'minute'], ['秒', 'second']
        ]), 'WHAT');
      this.setOutput(true);
      this.setStyle('jimu_sense');
    }
  };
  defs['jimu_play_note'] = {
    init() {
      this.appendDummyInput().appendField('弹奏音高（60=中央C）');
      this.appendValueInput('NOTE');
      this.appendDummyInput().appendField('时长');
      this.appendValueInput('DUR');
      this.appendDummyInput().appendField('秒');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_media');
    }
  };
  defs['jimu_self_draggable'] = {
    init() {
      this.appendDummyInput().appendField('把我设为')
        .appendField(new Blockly.FieldDropdown([['可拖动', 'on'], ['不可拖动', 'off']]), 'VAL');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_draggable'] = {
    init() {
      this.appendDummyInput().appendField('把')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('设为')
        .appendField(new Blockly.FieldDropdown([['可拖动', 'on'], ['不可拖动', 'off']]), 'VAL');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_element');
    }
  };
  defs['jimu_pen_state'] = {
    init() {
      this.appendDummyInput().appendField('画笔')
        .appendField(new Blockly.FieldDropdown([['落笔', 'down'], ['抬笔', 'up']]), 'VAL');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_pen');
    }
  };
  defs['jimu_pen_clear'] = {
    init() {
      this.appendDummyInput().appendField('清空画笔');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_pen');
    }
  };
  defs['jimu_pen_size'] = {
    init() {
      this.appendDummyInput().appendField('画笔粗细设为')
        .appendField(new Blockly.FieldNumber(6, 1, 60, 1), 'N');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_pen');
    }
  };
  defs['jimu_pen_color'] = {
    init() {
      this.appendDummyInput().appendField('画笔颜色设为')
        .appendField(new FieldHex('#FFFFFF'), 'COLOR');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_pen');
    }
  };
  defs['jimu_self_pen_line'] = {
    init() {
      this.appendDummyInput().appendField('画线到 x:');
      this.appendValueInput('X');
      this.appendDummyInput().appendField('y:');
      this.appendValueInput('Y');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_pen');
    }
  };
  defs['jimu_pen_line'] = {
    init() {
      this.appendDummyInput().appendField('让')
        .appendField(new Blockly.FieldDropdown(elementOptions), 'ELEMENT')
        .appendField('画线到 x:');
      this.appendValueInput('X');
      this.appendDummyInput().appendField('y:');
      this.appendValueInput('Y');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_pen');
    }
  };

  // ---- 广播（S3）----
  defs['jimu_broadcast'] = {
    init() {
      this.appendDummyInput().appendField('广播消息');
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('消息1'), 'MSG');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_hat');
    }
  };
  defs['jimu_on_broadcast'] = {
    init() {
      this.appendDummyInput().appendField('当收到消息');
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('消息1'), 'MSG');
      this.setStyle('jimu_hat');
      this.setNextStatement(true);
    }
  };

  // ---- 带参函数（S3）----
  defs['jimu_func_def'] = {
    init() {
      this.appendDummyInput().appendField('定义函数')
        .appendField(new Blockly.FieldTextInput('函数1'), 'NAME')
        .appendField('参数（逗号分隔）')
        .appendField(new Blockly.FieldTextInput('x'), 'PARAMS');
      this.setStyle('jimu_func');
      this.setNextStatement(true);
    }
  };
  defs['jimu_func_call'] = {
    init() {
      this.appendDummyInput().appendField('调用函数')
        .appendField(new Blockly.FieldTextInput('函数1'), 'NAME');
      this.appendDummyInput().appendField('①');
      this.appendValueInput('ARG0');
      this.appendDummyInput().appendField('②');
      this.appendValueInput('ARG1');
      this.appendDummyInput().appendField('③');
      this.appendValueInput('ARG2');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle('jimu_func');
    }
  };
  defs['jimu_func_args'] = {
    init() {
      this.appendDummyInput().appendField('函数参数')
        .appendField(new Blockly.FieldTextInput('x'), 'NAME');
      this.setOutput(true);
      this.setStyle('jimu_func');
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
        toolbox: this.filterAdvancedTb(this.toolbox()),
        renderer: 'zelos',
        theme,
        sounds: (typeof Settings !== 'undefined') ? Settings.get('blockSounds') : false,
        media: 'vendor/blockly/media/',
        grid: { spacing: 26, length: 3, colour: '#1C212B', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.3 },
        trashcan: true,
        move: { scrollbars: true, drag: true, wheel: true }
      });
      Blockly.ContextMenuRegistry.registry.unregister?.('blockDelete');
      this.ws = ws;
      this.current = null;
      ws.addChangeListener(e => {
        if (!e) return;
        if (e.type === 'create' || e.type === 'delete') {
          if (typeof App !== 'undefined' && App.updateBlocklyEmpty) App.updateBlocklyEmpty();
          if (typeof App !== 'undefined' && App.updateBlockCount) App.updateBlockCount();
        }
      });
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
              { kind: 'block', type: 'jimu_on_click' },
              { kind: 'block', type: 'jimu_on_slider' },
              { kind: 'block', type: 'jimu_on_hover' },
              { kind: 'block', type: 'jimu_on_hover_out' },
              { kind: 'block', type: 'jimu_on_chart_click' },
              { kind: 'block', type: 'jimu_on_broadcast' }
            ]
          },
          {
            kind: 'category', name: '章节', colour: C.scene,
            contents: [
              { kind: 'block', type: 'jimu_scene_go' },
              { kind: 'block', type: 'jimu_scene_next' },
              { kind: 'block', type: 'jimu_scene_replay' },
              { kind: 'block', type: 'jimu_scene_restart' },
              { kind: 'block', type: 'jimu_scene_bg' },
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
              { kind: 'block', type: 'jimu_el_color' },
              { kind: 'block', type: 'jimu_el_set', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_el_layer' },
              { kind: 'block', type: 'jimu_say', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '你好！' } } } } },
              { kind: 'block', type: 'jimu_say_secs', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '大家好' } } } } },
              { kind: 'block', type: 'jimu_say_stop' },
              { kind: 'block', type: 'jimu_el_clone' },
              { kind: 'block', type: 'jimu_clone' },
              { kind: 'block', type: 'jimu_clone_delete' },
              { kind: 'block', type: 'jimu_el_remove' },
              { kind: 'block', type: 'jimu_draggable' }
            ]
          },
          {
            kind: 'category', name: '运动', colour: '#4C8DF0',
            contents: [
              { kind: 'block', type: 'jimu_glide', inputs: { DUR: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } }, X: { shadow: { type: 'math_number', fields: { NUM: 100 } } }, Y: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_steps', inputs: { STEPS: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_face', inputs: { ANGLE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
              { kind: 'block', type: 'jimu_change', inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
              { kind: 'block', type: 'jimu_frame', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } }
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
              { kind: 'block', type: 'jimu_volume' },
              { kind: 'block', type: 'jimu_stop_all_sound' },
              { kind: 'block', type: 'jimu_sprite_ctrl' },
              { kind: 'block', type: 'jimu_sprite_speed' },
              { kind: 'block', type: 'jimu_chart_refresh' },
              { kind: 'block', type: 'jimu_chart_set', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '120,200,150' } } } } },
              { kind: 'block', type: 'jimu_chart_cats', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '一月,二月,三月' } } } } },
              { kind: 'block', type: 'jimu_play_note', inputs: { NOTE: { shadow: { type: 'math_number', fields: { NUM: 60 } } }, DUR: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } } } }
            ]
          },
          {
            kind: 'category', name: '感知', colour: '#7C6CF0',
            contents: [
              { kind: 'block', type: 'jimu_get_prop' },
              { kind: 'block', type: 'jimu_scene_name' },
              { kind: 'block', type: 'jimu_timer' },
              { kind: 'block', type: 'jimu_timer_reset' },
              { kind: 'block', type: 'jimu_rand_color' },
              { kind: 'block', type: 'jimu_mouse' },
              { kind: 'block', type: 'jimu_mouse_down' },
              { kind: 'block', type: 'jimu_touch' },
              { kind: 'block', type: 'jimu_slider_value' },
              { kind: 'block', type: 'jimu_slider_set', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 50 } } } } },
              { kind: 'block', type: 'jimu_chart_click' },
              { kind: 'block', type: 'jimu_ask', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '你叫什么名字？' } } } } },
              { kind: 'block', type: 'jimu_answer' },
              { kind: 'block', type: 'jimu_datetime' }
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
              { kind: 'block', type: 'jimu_broadcast' },
              { kind: 'block', type: 'jimu_js' },
              { kind: 'block', type: 'jimu_webapp_send', inputs: { MSG: { shadow: { type: 'text', fields: { TEXT: 'hello' } } } } },
              { kind: 'block', type: 'jimu_on_message' },
              { kind: 'block', type: 'jimu_on_clone' }
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
              { kind: 'block', type: 'jimu_3d_autorotate' },
              { kind: 'block', type: 'jimu_3d_scale', inputs: { SCALE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_3d_pause' }
            ]
          },
          {
            kind: 'category', name: '逻辑', colour: '#8A93A6',
            contents: [
              { kind: 'block', type: 'controls_if' },
              { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 3 } } } } },
              { kind: 'block', type: 'jimu_wait_until' },
              { kind: 'block', type: 'jimu_repeat_until' },
              { kind: 'block', type: 'jimu_stop_script' },
              { kind: 'block', type: 'jimu_stop_all' },
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
            kind: 'category', name: '数学', colour: '#4E9A6B',
            contents: [
              { kind: 'block', type: 'math_round' },
              { kind: 'block', type: 'math_number_property' },
              { kind: 'block', type: 'math_constant' },
              { kind: 'block', type: 'math_single' },
              { kind: 'block', type: 'math_trig' },
              { kind: 'block', type: 'jimu_bitwise' },
              { kind: 'block', type: 'jimu_shift' }
            ]
          },
          {
            kind: 'category', name: '文本', colour: '#5B9BD5',
            contents: [
              { kind: 'block', type: 'text' },
              { kind: 'block', type: 'text_join' },
              { kind: 'block', type: 'text_length' },
              { kind: 'block', type: 'text_isEmpty' },
              { kind: 'block', type: 'jimu_text_letter' },
              { kind: 'block', type: 'jimu_text_contains' },
              { kind: 'block', type: 'jimu_text_replace' },
              { kind: 'block', type: 'jimu_text_case' },
              { kind: 'block', type: 'jimu_text_trim' }
            ]
          },
          {
            kind: 'category', name: '数据', colour: '#D08A3C',
            contents: [
              { kind: 'block', type: 'jimu_list_add', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '项目' } } } } },
              { kind: 'block', type: 'jimu_list_delete', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_insert', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_replace', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_clear' },
              { kind: 'block', type: 'jimu_list_split', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'a,b,c' } } }, SEP: { shadow: { type: 'text', fields: { TEXT: ',' } } } } },
              { kind: 'block', type: 'jimu_list_item', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_length' },
              { kind: 'block', type: 'jimu_list_contains' },
              { kind: 'block', type: 'jimu_list_index_of' },
              { kind: 'block', type: 'jimu_list_join', inputs: { SEP: { shadow: { type: 'text', fields: { TEXT: '，' } } } } }
            ]
          },
          {
            kind: 'category', name: '画笔', colour: '#B36BC9',
            contents: [
              { kind: 'block', type: 'jimu_pen_state' },
              { kind: 'block', type: 'jimu_pen_clear' },
              { kind: 'block', type: 'jimu_pen_size' },
              { kind: 'block', type: 'jimu_pen_color' },
              { kind: 'block', type: 'jimu_pen_line', inputs: { X: { shadow: { type: 'math_number', fields: { NUM: 400 } } }, Y: { shadow: { type: 'math_number', fields: { NUM: 300 } } } } }
            ]
          },
          {
            kind: 'category', name: '变量', colour: '#A06CD5', custom: 'VARIABLE'
          },
          {
            kind: 'category', name: '带参函数', colour: '#A06CD5',
            contents: [
              { kind: 'block', type: 'jimu_func_def' },
              { kind: 'block', type: 'jimu_func_call', inputs: { ARG0: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_func_args' }
            ]
          },
          {
            kind: 'category', name: '函数', colour: '#A06CD5', custom: 'PROCEDURE'
          }
        ]
      };
    },

    // 元素脚本专用工具箱（自我版积木，无元素下拉）
    selfToolbox() {
      return {
        kind: 'categoryToolbox',
        contents: [
          {
            kind: 'category', name: '事件', colour: C.event,
            contents: [
              { kind: 'block', type: 'jimu_self_on_start' },
              { kind: 'block', type: 'jimu_self_on_click' },
              { kind: 'block', type: 'jimu_self_on_message' },
              { kind: 'block', type: 'jimu_self_on_clone' },
              { kind: 'block', type: 'jimu_self_on_slider' },
              { kind: 'block', type: 'jimu_self_on_hover' },
              { kind: 'block', type: 'jimu_self_on_hover_out' },
              { kind: 'block', type: 'jimu_self_on_chart_click' }
            ]
          },
          {
            kind: 'category', name: '章节', colour: C.scene,
            contents: [
              { kind: 'block', type: 'jimu_scene_go' },
              { kind: 'block', type: 'jimu_scene_next' },
              { kind: 'block', type: 'jimu_scene_replay' },
              { kind: 'block', type: 'jimu_scene_restart' },
              { kind: 'block', type: 'jimu_scene_bg' },
              { kind: 'block', type: 'jimu_scene_transition' },
              { kind: 'block', type: 'jimu_wait', inputs: { SEC: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } }
            ]
          },
          {
            kind: 'category', name: '运动', colour: '#4C8DF0',
            contents: [
              { kind: 'block', type: 'jimu_self_steps', inputs: { STEPS: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_self_glide', inputs: { DUR: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } }, X: { shadow: { type: 'math_number', fields: { NUM: 100 } } }, Y: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_self_face', inputs: { ANGLE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
              { kind: 'block', type: 'jimu_self_change', inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
              { kind: 'block', type: 'jimu_self_el_move', inputs: { X: { shadow: { type: 'math_number', fields: { NUM: 100 } } }, Y: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_self_frame', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } }
            ]
          },
          {
            kind: 'category', name: '外观', colour: C.element,
            contents: [
              { kind: 'block', type: 'jimu_self_el_show' },
              { kind: 'block', type: 'jimu_self_el_hide' },
              { kind: 'block', type: 'jimu_self_el_text', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '你好' } } } } },
              { kind: 'block', type: 'jimu_self_el_size', inputs: { W: { shadow: { type: 'math_number', fields: { NUM: 400 } } }, H: { shadow: { type: 'math_number', fields: { NUM: 200 } } } } },
              { kind: 'block', type: 'jimu_self_el_color' },
              { kind: 'block', type: 'jimu_self_el_set', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_self_el_layer' },
              { kind: 'block', type: 'jimu_self_say', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '你好！' } } } } },
              { kind: 'block', type: 'jimu_self_say_secs', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '大家好' } } } } },
              { kind: 'block', type: 'jimu_self_say_stop' },
              { kind: 'block', type: 'jimu_self_draggable' }
            ]
          },
          {
            kind: 'category', name: '其他元素', colour: C.element,
            contents: [
              { kind: 'block', type: 'jimu_el_text', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '你好' } } } } },
              { kind: 'block', type: 'jimu_el_show' },
              { kind: 'block', type: 'jimu_el_hide' },
              { kind: 'block', type: 'jimu_anim' },
              { kind: 'block', type: 'jimu_el_move', inputs: { X: { shadow: { type: 'math_number', fields: { NUM: 100 } } }, Y: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
              { kind: 'block', type: 'jimu_el_color' }
            ]
          },
          {
            kind: 'category', name: '动画', colour: C.anim,
            contents: [
              { kind: 'block', type: 'jimu_self_anim' },
              { kind: 'block', type: 'jimu_self_keyframes' }
            ]
          },
          {
            kind: 'category', name: '克隆', colour: C.element,
            contents: [
              { kind: 'block', type: 'jimu_self_clone' },
              { kind: 'block', type: 'jimu_clone_delete' }
            ]
          },
          {
            kind: 'category', name: '媒体', colour: C.media,
            contents: [
              { kind: 'block', type: 'jimu_sfx' },
              { kind: 'block', type: 'jimu_self_video_ctrl' },
              { kind: 'block', type: 'jimu_self_sprite_ctrl' },
              { kind: 'block', type: 'jimu_self_sprite_speed' },
              { kind: 'block', type: 'jimu_self_chart_refresh' },
              { kind: 'block', type: 'jimu_self_chart_set', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '120,200,150' } } } } },
              { kind: 'block', type: 'jimu_self_chart_cats', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '一月,二月,三月' } } } } },
              { kind: 'block', type: 'jimu_music_play' },
              { kind: 'block', type: 'jimu_music_stop' },
              { kind: 'block', type: 'jimu_volume' },
              { kind: 'block', type: 'jimu_stop_all_sound' },
              { kind: 'block', type: 'jimu_play_note', inputs: { NOTE: { shadow: { type: 'math_number', fields: { NUM: 60 } } }, DUR: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } } } }
            ]
          },
          {
            kind: 'category', name: '感知', colour: '#7C6CF0',
            contents: [
              { kind: 'block', type: 'jimu_self_get_prop' },
              { kind: 'block', type: 'jimu_timer' },
              { kind: 'block', type: 'jimu_timer_reset' },
              { kind: 'block', type: 'jimu_scene_name' },
              { kind: 'block', type: 'jimu_rand_color' },
              { kind: 'block', type: 'jimu_mouse' },
              { kind: 'block', type: 'jimu_mouse_down' },
              { kind: 'block', type: 'jimu_self_touch' },
              { kind: 'block', type: 'jimu_self_slider_value' },
              { kind: 'block', type: 'jimu_self_slider_set', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 50 } } } } },
              { kind: 'block', type: 'jimu_chart_click' },
              { kind: 'block', type: 'jimu_ask', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '你叫什么名字？' } } } } },
              { kind: 'block', type: 'jimu_answer' },
              { kind: 'block', type: 'jimu_datetime' }
            ]
          },
          {
            kind: 'category', name: '特效', colour: C.fx,
            contents: [
              { kind: 'block', type: 'jimu_self_fx_burst' }
            ]
          },
          {
            kind: 'category', name: '高级', colour: '#4CC2C0',
            contents: [
              { kind: 'block', type: 'jimu_broadcast' },
              { kind: 'block', type: 'jimu_js' }
            ]
          },
          {
            kind: 'category', name: '3D', colour: C.three,
            contents: [
              { kind: 'block', type: 'jimu_self_3d_view' },
              { kind: 'block', type: 'jimu_self_3d_orbit' },
              { kind: 'block', type: 'jimu_self_3d_zoom' },
              { kind: 'block', type: 'jimu_self_3d_anim' },
              { kind: 'block', type: 'jimu_self_3d_lights' },
              { kind: 'block', type: 'jimu_self_3d_autorotate' },
              { kind: 'block', type: 'jimu_self_3d_scale', inputs: { SCALE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_self_3d_pause' }
            ]
          },
          {
            kind: 'category', name: '逻辑', colour: '#8A93A6',
            contents: [
              { kind: 'block', type: 'controls_if' },
              { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 3 } } } } },
              { kind: 'block', type: 'jimu_wait_until' },
              { kind: 'block', type: 'jimu_repeat_until' },
              { kind: 'block', type: 'jimu_stop_script' },
              { kind: 'block', type: 'jimu_stop_all' },
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
            kind: 'category', name: '数学', colour: '#4E9A6B',
            contents: [
              { kind: 'block', type: 'math_round' },
              { kind: 'block', type: 'math_number_property' },
              { kind: 'block', type: 'math_constant' },
              { kind: 'block', type: 'math_single' },
              { kind: 'block', type: 'math_trig' },
              { kind: 'block', type: 'jimu_bitwise' },
              { kind: 'block', type: 'jimu_shift' }
            ]
          },
          {
            kind: 'category', name: '文本', colour: '#5B9BD5',
            contents: [
              { kind: 'block', type: 'text' },
              { kind: 'block', type: 'text_join' },
              { kind: 'block', type: 'text_length' },
              { kind: 'block', type: 'text_isEmpty' },
              { kind: 'block', type: 'jimu_text_letter' },
              { kind: 'block', type: 'jimu_text_contains' },
              { kind: 'block', type: 'jimu_text_replace' },
              { kind: 'block', type: 'jimu_text_case' },
              { kind: 'block', type: 'jimu_text_trim' }
            ]
          },
          {
            kind: 'category', name: '数据', colour: '#D08A3C',
            contents: [
              { kind: 'block', type: 'jimu_list_add', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '项目' } } } } },
              { kind: 'block', type: 'jimu_list_delete', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_insert', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_replace', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_clear' },
              { kind: 'block', type: 'jimu_list_split', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'a,b,c' } } }, SEP: { shadow: { type: 'text', fields: { TEXT: ',' } } } } },
              { kind: 'block', type: 'jimu_list_item', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_list_length' },
              { kind: 'block', type: 'jimu_list_contains' },
              { kind: 'block', type: 'jimu_list_index_of' },
              { kind: 'block', type: 'jimu_list_join', inputs: { SEP: { shadow: { type: 'text', fields: { TEXT: '，' } } } } }
            ]
          },
          {
            kind: 'category', name: '画笔', colour: '#B36BC9',
            contents: [
              { kind: 'block', type: 'jimu_pen_state' },
              { kind: 'block', type: 'jimu_pen_clear' },
              { kind: 'block', type: 'jimu_pen_size' },
              { kind: 'block', type: 'jimu_pen_color' },
              { kind: 'block', type: 'jimu_self_pen_line', inputs: { X: { shadow: { type: 'math_number', fields: { NUM: 400 } } }, Y: { shadow: { type: 'math_number', fields: { NUM: 300 } } } } }
            ]
          },
          {
            kind: 'category', name: '变量', colour: '#A06CD5', custom: 'VARIABLE'
          },
          {
            kind: 'category', name: '带参函数', colour: '#A06CD5',
            contents: [
              { kind: 'block', type: 'jimu_func_def' },
              { kind: 'block', type: 'jimu_func_call', inputs: { ARG0: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
              { kind: 'block', type: 'jimu_func_args' }
            ]
          },
          {
            kind: 'category', name: '函数', colour: '#A06CD5', custom: 'PROCEDURE'
          }
        ]
      };
    },

    // ---------- 工作区切换 ----------
    // key：'global' | 章节 id | 'el:<元素id>'（元素脚本）
    switchTo(key) {
      this.save();
      this.current = key;
      let state = null;
      let selfMode = false;
      if (key === 'global') {
        state = Project.data.globalBlocks;
      } else if (key.indexOf('el:') === 0) {
        const el = Project.getElement(key.slice(3));
        state = el ? el.blocks : null;
        selfMode = true;
      } else {
        state = (Project.getScene(key) || {}).blocks;
      }
      this.ws.clear();
      if (state) {
        try { Blockly.serialization.workspaces.load(state, this.ws); } catch (e) { console.warn('积木加载失败', e); }
      }
      try { this.refreshToolbox(); } catch (e) { console.warn('工具箱切换失败', e); }
      if (typeof App !== 'undefined' && App.updateBlocklyEmpty) App.updateBlocklyEmpty();
    },

    // 高级分类开关：关闭时从工具箱里去掉「高级」分类
    filterAdvancedTb(tb) {
      if (!tb || !tb.contents) return tb;
      if (typeof Settings === 'undefined' || Settings.get('showAdvanced')) return tb;
      return { kind: 'categoryToolbox', contents: tb.contents.filter(c => c.name !== '高级') };
    },

    // 按当前上下文重建工具箱（含高级过滤）；上下文类型未变时跳过重建（性能）
    refreshToolbox(force) {
      if (!this.ws || !this.current) return;
      const wantSelf = this.current.indexOf('el:') === 0;
      if (!force && this._tbSelf === wantSelf) return;
      this._tbSelf = wantSelf;
      const tb = wantSelf ? this.selfToolbox() : this.toolbox();
      this.ws.updateToolbox(this.filterAdvancedTb(tb));
    },

    save() {
      if (!this.ws || !this.current || !Project.data) return;
      const state = Blockly.serialization.workspaces.save(this.ws);
      const empty = !(state.blocks && state.blocks.blocks && state.blocks.blocks.length);
      if (this.current === 'global') Project.data.globalBlocks = state;
      else if (this.current.indexOf('el:') === 0) {
        const el = Project.getElement(this.current.slice(3));
        if (el) el.blocks = empty ? null : state;
      } else {
        const sc = Project.getScene(this.current);
        if (sc) sc.blocks = state;
      }
    }
  };
})();

// ---------- IR 编译器 ----------
const IRCompiler = {
  lastOrphanCount: 0,

  compileWorkspace(workspace, opts) {
    const prevSelf = this._selfMode;
    this._selfMode = !!(opts && opts.selfMode);
    const scripts = [];
    const funcs = [];
    let orphans = 0;
    workspace.getTopBlocks(true).forEach(b => {
      if (b.type === 'jimu_func_def') {
        funcs.push({
          name: String(b.getFieldValue('NAME') || ''),
          params: this.parseParams(b.getFieldValue('PARAMS')),
          body: this.statements(b.getNextBlock())
        });
        return;
      }
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
    this._selfMode = prevSelf;
    return scripts;
  },

  // 元素引用：自我版块（jimu_self_*）= 自己；普通块（带元素下拉）= 下拉选定元素
  // （此前 selfMode 会强制所有块指向 @self，导致元素脚本无法操作其他元素；现按块类型精确判断）
  EL(b) {
    if (b.type && b.type.indexOf('jimu_self_') === 0) return '@self';
    return b.getFieldValue('ELEMENT');
  },

  // 参数字符串解析（"x, y" → ['x','y']；带参函数用）
  parseParams(str) {
    return String(str || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
  },

  hatOf(b) {
    // 自我版帽子（元素脚本域）
    switch (b.type) {
      case 'jimu_self_on_start': return { kind: 'onStart' };
      case 'jimu_self_on_click': return { kind: 'onElementClick', elId: '@self' };
      case 'jimu_self_on_message': return { kind: 'onMessage', message: String(b.getFieldValue('MSG') || '') };
      case 'jimu_self_on_clone': return { kind: 'onCloneStart' };
      case 'jimu_self_on_slider': return { kind: 'onSliderChange', elId: '@self' };
      case 'jimu_self_on_hover': return { kind: 'onMouseEnter', elId: '@self' };
      case 'jimu_self_on_hover_out': return { kind: 'onMouseLeave', elId: '@self' };
      case 'jimu_self_on_chart_click': return { kind: 'onChartClick', elId: '@self' };
    }
    switch (b.type) {
      case 'jimu_on_start': return { kind: 'onStart' };
      case 'jimu_on_broadcast': return { kind: 'onMessage', message: String(b.getFieldValue('MSG') || '') };
      case 'jimu_func_def': return { kind: 'funcDef' };
      case 'jimu_on_scene': return { kind: 'onSceneEnter', sceneId: b.getFieldValue('SCENE') };
      case 'jimu_on_key': return { kind: 'onKey', key: b.getFieldValue('KEY') };
      case 'jimu_on_click': return { kind: 'onElementClick', elId: this.EL(b) };
      case 'jimu_on_message': return { kind: 'onWebappMessage', elId: this.EL(b) };
      case 'jimu_on_clone': return { kind: 'onCloneStart' };
      case 'jimu_on_slider': return { kind: 'onSliderChange', elId: this.EL(b) };
      case 'jimu_on_hover': return { kind: 'onMouseEnter', elId: this.EL(b) };
      case 'jimu_on_hover_out': return { kind: 'onMouseLeave', elId: this.EL(b) };
      case 'jimu_on_chart_click': return { kind: 'onChartClick', elId: this.EL(b) };
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
    const t = b.type.indexOf('jimu_self_') === 0 ? 'jimu_' + b.type.slice(10) : b.type;
    switch (t) {
      case 'jimu_scene_go': return { op: 'scene.go', sceneId: b.getFieldValue('SCENE') };
      case 'jimu_scene_next': return { op: 'scene.next' };
      case 'jimu_scene_transition': return { op: 'scene.transition', type: b.getFieldValue('TYPE'), duration: Number(b.getFieldValue('DUR')) };
      case 'jimu_el_show': return { op: 'el.show', elId: this.EL(b) };
      case 'jimu_el_hide': return { op: 'el.hide', elId: this.EL(b) };
      case 'jimu_el_text': return { op: 'el.text', elId: this.EL(b), text: this.expr(b, 'TEXT') };
      case 'jimu_el_move': return { op: 'el.move', elId: this.EL(b), x: this.expr(b, 'X'), y: this.expr(b, 'Y') };
      case 'jimu_el_size': return { op: 'el.size', elId: this.EL(b), w: this.expr(b, 'W'), h: this.expr(b, 'H') };
      case 'jimu_el_color': return { op: 'el.color', elId: this.EL(b), color: b.getFieldValue('COLOR') };
      case 'jimu_anim': return {
        op: 'el.anim', elId: this.EL(b), anim: b.getFieldValue('ANIM'),
        duration: Number(b.getFieldValue('DUR')), delay: Number(b.getFieldValue('DELAY')),
        easing: b.getFieldValue('EASE')
      };
      case 'jimu_keyframes': return {
        op: 'el.keyframes', elId: this.EL(b),
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
        op: 'media.video', elId: this.EL(b),
        action: b.getFieldValue('ACTION')
      };
      case 'jimu_js': return {
        op: 'js.eval',
        code: String(b.getFieldValue('CODE') || '').replace(/\\n/g, '\n')
      };
      case 'jimu_webapp_send': return {
        op: 'webapp.send', elId: this.EL(b), msg: this.expr(b, 'MSG')
      };
      case 'jimu_timer_reset': return { op: 'timer.reset' };
      case 'jimu_el_set': return {
        op: 'el.set', elId: this.EL(b), prop: b.getFieldValue('PROP'),
        value: this.expr(b, 'VALUE')
      };
      case 'jimu_el_layer': return {
        op: 'el.layer', elId: this.EL(b), where: b.getFieldValue('WHERE')
      };
      case 'jimu_say': return {
        op: 'el.say', elId: this.EL(b), text: this.expr(b, 'TEXT'), seconds: 0
      };
      case 'jimu_say_secs': return {
        op: 'el.say', elId: this.EL(b), text: this.expr(b, 'TEXT'),
        seconds: Number(b.getFieldValue('SECS'))
      };
      case 'jimu_say_stop': return { op: 'el.say.stop', elId: this.EL(b) };
      case 'jimu_clone': return { op: 'el.clone.start', elId: this.EL(b) };
      case 'jimu_clone_delete': return { op: 'el.remove', elId: '@self' };
      case 'jimu_el_clone': return { op: 'el.clone', elId: this.EL(b) };
      case 'jimu_el_remove': return { op: 'el.remove', elId: this.EL(b) };
      case 'jimu_scene_replay': return { op: 'scene.replay' };
      case 'jimu_scene_restart': return { op: 'scene.restart' };
      case 'jimu_scene_bg': return { op: 'scene.bg', color: b.getFieldValue('COLOR') };
      case 'jimu_wait_until': return { op: 'ctrl.waituntil', cond: this.expr(b, 'COND') };
      case 'jimu_repeat_until': return {
        op: 'ctrl.repeatuntil', cond: this.expr(b, 'COND'),
        body: this.statements(b.getInputTargetBlock('DO'))
      };
      case 'jimu_stop_script': return { op: 'ctrl.stopscript' };
      case 'jimu_stop_all': return { op: 'ctrl.stopall' };
      case 'jimu_ask': return { op: 'ask', text: this.expr(b, 'TEXT') };
      case 'jimu_broadcast': return { op: 'broadcast', msg: this.expr(b, 'MSG') };
      case 'jimu_func_call': {
        const args = [];
        ['ARG0', 'ARG1', 'ARG2'].forEach(inp => {
          const t = b.getInputTargetBlock(inp);
          if (t) args.push(this.exprOf(t));
        });
        return { op: 'func.call', name: b.getFieldValue('NAME'), args };
      }
      case 'jimu_list_add': return {
        op: 'list.add', name: b.getFieldValue('NAME'), value: this.expr(b, 'VALUE')
      };
      case 'jimu_list_delete': return {
        op: 'list.delete', name: b.getFieldValue('NAME'), n: this.expr(b, 'N')
      };
      case 'jimu_list_insert': return {
        op: 'list.insert', name: b.getFieldValue('NAME'), n: this.expr(b, 'N'), value: this.expr(b, 'VALUE')
      };
      case 'jimu_list_replace': return {
        op: 'list.replace', name: b.getFieldValue('NAME'), n: this.expr(b, 'N'), value: this.expr(b, 'VALUE')
      };
      case 'jimu_list_clear': return { op: 'list.clear', name: b.getFieldValue('NAME') };
      case 'jimu_list_split': return {
        op: 'list.split', name: b.getFieldValue('NAME'), text: this.expr(b, 'TEXT'), sep: this.expr(b, 'SEP')
      };
      case 'jimu_play_note': return {
        op: 'music.note', note: this.expr(b, 'NOTE'), dur: this.expr(b, 'DUR')
      };
      case 'jimu_draggable': return { op: 'el.drag', elId: this.EL(b), on: b.getFieldValue('VAL') === 'on' };
      case 'jimu_pen_state': return { op: 'pen.state', down: b.getFieldValue('VAL') === 'down' };
      case 'jimu_pen_clear': return { op: 'pen.clear' };
      case 'jimu_pen_size': return { op: 'pen.size', n: Number(b.getFieldValue('N')) };
      case 'jimu_pen_color': return { op: 'pen.color', color: b.getFieldValue('COLOR') };
      case 'jimu_pen_line': return {
        op: 'pen.line', elId: this.EL(b), x: this.expr(b, 'X'), y: this.expr(b, 'Y')
      };
      case 'jimu_volume': return { op: 'media.volume', value: Number(b.getFieldValue('VOL')) };
      case 'jimu_stop_all_sound': return { op: 'media.stopall' };
      case 'jimu_3d_scale': return {
        op: '3d.scale', elId: this.EL(b), value: this.expr(b, 'SCALE')
      };
      case 'jimu_3d_pause': return {
        op: '3d.animctl', elId: this.EL(b), action: b.getFieldValue('ACTION')
      };
      case 'jimu_glide': return {
        op: 'el.glide', elId: this.EL(b),
        duration: this.expr(b, 'DUR'), x: this.expr(b, 'X'), y: this.expr(b, 'Y'),
        easing: b.getFieldValue('EASE')
      };
      case 'jimu_steps': return {
        op: 'el.steps', elId: this.EL(b), steps: this.expr(b, 'STEPS')
      };
      case 'jimu_face': return {
        op: 'el.face', elId: this.EL(b), angle: this.expr(b, 'ANGLE')
      };
      case 'jimu_change': return {
        op: 'el.change', elId: this.EL(b),
        prop: b.getFieldValue('PROP'), delta: this.expr(b, 'DELTA')
      };
      case 'jimu_frame': return {
        op: 'el.frame', elId: this.EL(b),
        action: b.getFieldValue('ACTION'), value: this.expr(b, 'VALUE')
      };
      case 'jimu_3d_view': return {
        op: '3d.view', elId: this.EL(b), preset: b.getFieldValue('PRESET'),
        duration: Number(b.getFieldValue('DUR'))
      };
      case 'jimu_3d_orbit': return {
        op: '3d.orbit', elId: this.EL(b), duration: Number(b.getFieldValue('DUR'))
      };
      case 'jimu_3d_zoom': return {
        op: '3d.zoom', elId: this.EL(b),
        factor: Number(b.getFieldValue('FACTOR')), duration: Number(b.getFieldValue('DUR'))
      };
      case 'jimu_3d_anim': return {
        op: '3d.anim', elId: this.EL(b), name: b.getFieldValue('NAME'),
        loop: b.getFieldValue('LOOP') === 'TRUE', speed: Number(b.getFieldValue('SPEED'))
      };
      case 'jimu_3d_lights': return {
        op: '3d.lights', elId: this.EL(b), preset: b.getFieldValue('PRESET')
      };
      case 'jimu_3d_autorotate': return {
        op: '3d.autorotate', elId: this.EL(b), value: b.getFieldValue('VAL') === 'on'
      };
      case 'jimu_fx_burst': return {
        op: 'fx.burst', elId: this.EL(b), fxType: b.getFieldValue('FX')
      };
      case 'jimu_chart_refresh': return { op: 'chart.refresh', elId: this.EL(b) };
      case 'jimu_chart_set': return {
        op: 'chart.set', elId: this.EL(b), value: this.expr(b, 'VALUE')
      };
      case 'jimu_chart_cats': return {
        op: 'chart.cats', elId: this.EL(b), value: this.expr(b, 'VALUE')
      };
      case 'jimu_slider_set': return {
        op: 'slider.set', elId: this.EL(b), value: this.expr(b, 'VALUE')
      };
      case 'jimu_sprite_ctrl': return {
        op: 'sprite.ctrl', elId: this.EL(b), action: b.getFieldValue('ACTION')
      };
      case 'jimu_sprite_speed': return {
        op: 'sprite.speed', elId: this.EL(b), value: Number(b.getFieldValue('SPEED'))
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
    const t = b.type.indexOf('jimu_self_') === 0 ? 'jimu_' + b.type.slice(10) : b.type;
    switch (t) {
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
      case 'jimu_get_prop': return {
        k: 'prop', el: this.EL(b), prop: b.getFieldValue('PROP')
      };
      case 'jimu_slider_value': return { k: 'slider', el: this.EL(b) };
      case 'jimu_chart_click': return { k: 'chartclick', what: b.getFieldValue('WHAT') };
      case 'jimu_scene_name': return { k: 'scenename' };
      case 'jimu_timer': return { k: 'timer' };
      case 'jimu_rand_color': return { k: 'randcolor' };
      case 'text_join': {
        const n = b.itemCount_ || 0;
        const parts = [];
        for (let i = 0; i < n; i++) parts.push(this.exprOf(b.getInputTargetBlock('ADD' + i)));
        return { k: 'join', parts };
      }
      case 'math_random_int': return {
        k: 'randint', a: this.exprOf(b.getInputTargetBlock('FROM')), b: this.exprOf(b.getInputTargetBlock('TO'))
      };
      case 'math_random_float': return { k: 'randfloat' };
      case 'math_round': return {
        k: 'round', op: b.getFieldValue('OP'), v: this.exprOf(b.getInputTargetBlock('NUM'))
      };
      case 'math_modulo': return {
        k: 'mod', a: this.exprOf(b.getInputTargetBlock('DIVIDEND')), b: this.exprOf(b.getInputTargetBlock('DIVISOR'))
      };
      case 'math_single': return {
        k: 'single', op: b.getFieldValue('OP'), v: this.exprOf(b.getInputTargetBlock('NUM'))
      };
      case 'math_number_property': return {
        k: 'numprop', op: b.getFieldValue('PROPERTY'), v: this.exprOf(b.getInputTargetBlock('NUMBER_TO_CHECK'))
      };
      case 'text_length': return { k: 'strlen', v: this.exprOf(b.getInputTargetBlock('VALUE')) };
      case 'text_isEmpty': return { k: 'strempty', v: this.exprOf(b.getInputTargetBlock('VALUE')) };
      case 'math_constant': return { k: 'const', name: b.getFieldValue('CONSTANT') };
      case 'math_trig': return {
        k: 'trig', op: b.getFieldValue('OP'), v: this.exprOf(b.getInputTargetBlock('NUM'))
      };
      case 'jimu_bitwise': return {
        k: 'bitwise', op: b.getFieldValue('OP'),
        a: this.exprOf(b.getInputTargetBlock('A')), b: this.exprOf(b.getInputTargetBlock('B'))
      };
      case 'jimu_shift': return {
        k: 'shift', op: b.getFieldValue('OP'),
        a: this.exprOf(b.getInputTargetBlock('A')), b: this.exprOf(b.getInputTargetBlock('B'))
      };
      case 'jimu_text_letter': return {
        k: 'letter', text: this.exprOf(b.getInputTargetBlock('TEXT')), n: this.exprOf(b.getInputTargetBlock('N'))
      };
      case 'jimu_text_contains': return {
        k: 'contains', text: this.exprOf(b.getInputTargetBlock('TEXT')), sub: this.exprOf(b.getInputTargetBlock('SUB'))
      };
      case 'jimu_text_replace': return {
        k: 'replace', text: this.exprOf(b.getInputTargetBlock('TEXT')),
        from: this.exprOf(b.getInputTargetBlock('FROM')), to: this.exprOf(b.getInputTargetBlock('TO'))
      };
      case 'jimu_text_case': return {
        k: 'textcase', op: b.getFieldValue('OP'), v: this.exprOf(b.getInputTargetBlock('TEXT'))
      };
      case 'jimu_text_trim': return { k: 'trim', v: this.exprOf(b.getInputTargetBlock('TEXT')) };
      case 'jimu_mouse': return { k: 'mouse', axis: b.getFieldValue('AXIS') };
      case 'jimu_mouse_down': return { k: 'mousedown' };
      case 'jimu_touch': return { k: 'touch', a: this.EL(b), b: b.getFieldValue('TARGET') };
      case 'jimu_answer': return { k: 'answer' };
      case 'jimu_datetime': return { k: 'datetime', what: b.getFieldValue('WHAT') };
      case 'jimu_func_args': return { k: 'argv', name: b.getFieldValue('NAME') };
      case 'jimu_list_item': return {
        k: 'list.item', name: b.getFieldValue('NAME'), n: this.exprOf(b.getInputTargetBlock('N'))
      };
      case 'jimu_list_length': return { k: 'list.len', name: b.getFieldValue('NAME') };
      case 'jimu_list_contains': return {
        k: 'list.contains', name: b.getFieldValue('NAME'), value: this.exprOf(b.getInputTargetBlock('VALUE'))
      };
      case 'jimu_list_index_of': return {
        k: 'list.indexOf', name: b.getFieldValue('NAME'), value: this.exprOf(b.getInputTargetBlock('VALUE'))
      };
      case 'jimu_list_join': return {
        k: 'list.join', name: b.getFieldValue('NAME'), sep: this.exprOf(b.getInputTargetBlock('SEP'))
      };
      default:
        return { k: 'unsupported', type: b.type };
    }
  }
};
