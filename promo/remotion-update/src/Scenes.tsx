import type {ReactNode} from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  BrandMark,
  BrowserFrame,
  Kicker,
  MiniBlock,
  Pill,
  SceneTitle,
  StatCard,
  TerminalLine,
} from './Visuals';
import {colors, fade, fonts, rise, slide} from './theme';

const SceneFrame = ({duration, children}: {duration: number; children: ReactNode}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, duration, 13),
        transform: `scale(${1 + interpolate(frame, [0, duration], [0, 0.008])})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const IntroScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logo = spring({frame, fps, config: {damping: 13, stiffness: 115}});
  const title = rise(frame, fps, 10, 16);
  const subtitle = rise(frame, fps, 22, 16);
  const chips = rise(frame, fps, 36, 18);
  return (
    <SceneFrame duration={100}>
      <div style={{position: 'absolute', left: 116, top: 92}}>
        <BrandMark size={84} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 116,
          top: 275,
          width: 1120,
          fontFamily: fonts.sans,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 14px',
            border: `1px solid ${colors.gold}`,
            borderRadius: 999,
            color: colors.gold,
            fontFamily: fonts.mono,
            letterSpacing: 3,
            fontSize: 18,
            marginBottom: 30,
            opacity: logo,
          }}
        >
          UPDATE · 2026.10
        </div>
        <div
          style={{
            ...title,
            fontSize: 110,
            fontWeight: 780,
            lineHeight: 1.04,
            letterSpacing: -4,
            color: colors.ink,
          }}
        >
          积木剧场
          <br />
          <span style={{color: colors.gold}}>本次更新</span>
        </div>
        <div
          style={{
            ...subtitle,
            marginTop: 30,
            fontSize: 31,
            color: colors.dim,
            lineHeight: 1.7,
          }}
        >
          素材入项目，章节自动出积木，AI 直接复用你的素材。
        </div>
        <div style={{...chips, display: 'flex', gap: 12, marginTop: 34}}>
          <Pill filled>素材区</Pill>
          <Pill color={colors.blue}>章节双模式</Pill>
          <Pill color={colors.coral}>AI × MCP</Pill>
          <Pill color={colors.green}>安全基线</Pill>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 110,
          top: 160,
          width: 560,
          height: 700,
          transform: `rotate(${interpolate(logo, [0, 1], [5, -2])}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 74,
            borderRadius: 30,
            background: 'rgba(184,134,43,.1)',
            border: `1px solid ${colors.goldSoft}`,
            filter: 'blur(.2px)',
          }}
        />
        <Img
          src={staticFile('assets/logo.png')}
          style={{
            width: 330,
            height: 330,
            position: 'absolute',
            left: 114,
            top: 112,
            opacity: logo,
            transform: `scale(${0.72 + logo * 0.28})`,
            filter: 'drop-shadow(0 28px 50px rgba(80,64,29,.18))',
          }}
        />
        {[
          {x: 70, y: 476, c: colors.coral, t: '图片'},
          {x: 210, y: 520, c: '#F2B531', t: '音频'},
          {x: 350, y: 470, c: colors.blue, t: '3D'},
        ].map((b, i) => {
          const p = spring({
            frame: frame - 25 - i * 6,
            fps,
            config: {damping: 12, stiffness: 130},
          });
          return (
            <div
              key={b.t}
              style={{
                position: 'absolute',
                left: b.x,
                top: b.y + (1 - p) * 26,
                width: 126,
                height: 58,
                borderRadius: 10,
                backgroundColor: b.c,
                opacity: p,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: fonts.sans,
                fontWeight: 700,
                fontSize: 20,
                boxShadow: '0 12px 25px rgba(30,33,40,.14)',
              }}
            >
              {b.t}
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
};

export const AssetsScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <SceneFrame duration={180}>
      <div style={{position: 'absolute', left: 104, top: 126, ...rise(frame, fps, 2)}}>
        <Kicker index="01">新增功能</Kicker>
        <SceneTitle
          width={620}
          title={
            <>
              先放素材
              <br />
              再开始创作
            </>
          }
          subtitle="图片、音频、视频、3D 和网页统一进入项目素材区。拖到舞台就能用，素材随 .bdp 一起保存。"
        />
        <div style={{display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap', width: 620}}>
          <Pill>批量导入</Pill>
          <Pill color={colors.blue}>搜索与筛选</Pill>
          <Pill color={colors.coral}>引用保护</Pill>
        </div>
        <div
          style={{
            marginTop: 37,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: colors.dim,
            fontFamily: fonts.sans,
            fontSize: 20,
          }}
        >
          <span style={{color: colors.gold, fontSize: 30}}>↗</span>
          拖到舞台 · 双击插入 · 自动生成元素
        </div>
      </div>

      <div style={{position: 'absolute', right: 76, top: 174}}>
        <BrowserFrame
          src="assets/assets-ui.png"
          width={1110}
          height={680}
          focus={{left: '83%', top: '3%', width: '16.5%', height: '94%'}}
        />
      </div>
    </SceneFrame>
  );
};

export const DualModeScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chainX = 1170;
  return (
    <SceneFrame duration={180}>
      <div style={{position: 'absolute', left: 92, top: 92, ...rise(frame, fps, 2)}}>
        <Kicker index="02">创作方式</Kicker>
        <SceneTitle
          width={900}
          title={
            <>
              章节设置
              <br />
              自动变成积木
            </>
          }
          subtitle="背景色、元素显隐、动画、等待和跳转，都会转换成真正可查看、可继续编辑的 Blockly 积木。"
        />
      </div>

      <div style={{position: 'absolute', left: 70, top: 410}}>
        <BrowserFrame
          src="assets/chapter-ui.png"
          width={900}
          height={540}
          position="left center"
          focus={{left: '.5%', top: '3%', width: '68%', height: '94%'}}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: chainX,
          top: 238,
          width: 600,
          padding: '24px 28px 27px',
          borderRadius: 18,
          backgroundColor: 'rgba(251,250,247,.86)',
          border: `1px solid ${colors.line}`,
          boxShadow: '0 24px 65px rgba(30,33,40,.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 21,
            fontFamily: fonts.sans,
          }}
        >
          <span style={{fontSize: 21, color: colors.ink, fontWeight: 700}}>自动生成的积木</span>
          <Pill filled color={colors.blue} style={{fontSize: 15, padding: '5px 10px'}}>
            AUTO
          </Pill>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 13}}>
          <MiniBlock color="#D89126" delay={20}>当进入章节</MiniBlock>
          <MiniBlock color="#368E68" delay={28} width={300}>把背景色设为</MiniBlock>
          <MiniBlock color="#368E68" delay={36} width={330}>显示 / 隐藏元素</MiniBlock>
          <MiniBlock color="#CF703F" delay={44} width={360}>播放动画</MiniBlock>
          <MiniBlock color="#8B93A2" delay={52} width={245}>等待</MiniBlock>
          <MiniBlock color={colors.blue} delay={60} width={270}>下一章节</MiniBlock>
        </div>
        <div
          style={{
            marginTop: 18,
            color: colors.dim,
            fontFamily: fonts.sans,
            fontSize: 17,
            lineHeight: 1.7,
          }}
        >
          自动模式默认锁定。转为手工积木后，可继续添加条件、函数、广播与交互。
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1088,
          top: 185,
          fontFamily: fonts.mono,
          fontSize: 16,
          color: colors.gold,
          letterSpacing: 2,
        }}
      >
        CHAPTER → BLOCKS
      </div>
    </SceneFrame>
  );
};

export const AiMcpScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const prompt = rise(frame, fps, 8);
  const terminal = rise(frame, fps, 16);
  const count = spring({frame: frame - 26, fps, config: {damping: 12, stiffness: 110}});
  return (
    <SceneFrame duration={180}>
      <div style={{position: 'absolute', left: 102, top: 110, ...rise(frame, fps, 2)}}>
        <Kicker index="03">AI × MCP</Kicker>
        <SceneTitle
          width={820}
          title={
            <>
              AI 不再猜素材
              <br />
              直接调用素材区
            </>
          }
          subtitle="AI 会读取当前项目素材清单，选择真实存在的资源，绑定 resourceId 创建元素。MCP 同步增加素材与章节流程工具。"
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 102,
          top: 470,
          width: 760,
          height: 390,
          ...prompt,
        }}
      >
        <div
          style={{
            width: 600,
            padding: '18px 22px',
            borderRadius: '18px 18px 18px 5px',
            background: colors.ink,
            color: '#fff',
            fontFamily: fonts.sans,
            fontSize: 23,
            boxShadow: '0 20px 50px rgba(30,33,40,.16)',
          }}
        >
          “用素材区的 Logo 做封面，
          <br />
          再放一段产品视频。”
        </div>
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            gap: 12,
          }}
        >
          {[
            {t: 'logo.png', c: colors.gold},
            {t: 'demo.mp4', c: colors.coral},
            {t: 'model.glb', c: colors.blue},
          ].map((a) => (
            <div
              key={a.t}
              style={{
                padding: '10px 14px',
                borderRadius: 9,
                border: `1px solid ${a.c}`,
                color: a.c,
                background: 'rgba(255,255,255,.52)',
                fontFamily: fonts.mono,
                fontSize: 16,
              }}
            >
              {a.t}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 95,
          top: 224,
          width: 895,
          padding: '24px 26px 26px',
          borderRadius: 18,
          backgroundColor: colors.dark,
          color: '#fff',
          boxShadow: '0 30px 80px rgba(20,23,29,.24)',
          ...terminal,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingBottom: 16,
            borderBottom: '1px solid rgba(255,255,255,.1)',
            marginBottom: 19,
          }}
        >
          {['#E55F52', '#E7B747', '#51A867'].map((c) => (
            <span key={c} style={{width: 10, height: 10, borderRadius: '50%', background: c}} />
          ))}
          <span
            style={{
              marginLeft: 8,
              fontFamily: fonts.mono,
              color: '#8993A5',
              fontSize: 15,
            }}
          >
            jimuchang MCP
          </span>
        </div>
        <TerminalLine delay={30} color="#E5C97E">$ jc_list_resources</TerminalLine>
        <TerminalLine delay={44} color="#8D9AB0">→ 3 assets · logo.png / demo.mp4 / model.glb</TerminalLine>
        <TerminalLine delay={62} color="#E5C97E">$ jc_add_element_from_resource</TerminalLine>
        <TerminalLine delay={77} color="#84D9B2">→ image element created · resourceId bound</TerminalLine>
        <TerminalLine delay={98} color="#E5C97E">$ jc_set_chapter_flow</TerminalLine>
        <TerminalLine delay={113} color="#84D9B2">→ background + visibility + blocks generated</TerminalLine>
        <div
          style={{
            marginTop: 19,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <span style={{fontFamily: fonts.sans, color: '#8D9AB0', fontSize: 16}}>
            失败不再伪装成成功 · 真实工具错误直接返回
          </span>
          <div
            style={{
              opacity: count,
              transform: `scale(${0.7 + count * 0.3})`,
              display: 'flex',
              alignItems: 'baseline',
              gap: 9,
            }}
          >
            <span style={{fontFamily: fonts.mono, color: colors.goldSoft, fontSize: 72, lineHeight: 1}}>
              35
            </span>
            <span style={{fontFamily: fonts.sans, color: '#C1C8D5', fontSize: 18}}>MCP Tools</span>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

export const SecurityScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <SceneFrame duration={130}>
      <div style={{position: 'absolute', left: 100, top: 95, ...rise(frame, fps, 2)}}>
        <Kicker index="04">底层更新</Kicker>
        <SceneTitle
          width={930}
          title={
            <>
              能创作
              <br />
              也要守得住
            </>
          }
          subtitle="本地 API 默认关闭，配置文件权限收紧，陌生项目执行代码前必须确认。"
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 100,
          top: 535,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 310px)',
          gap: 18,
        }}
      >
        <StatCard delay={14} icon="⌁" title="API 默认关闭" detail="用的时候再开启" color={colors.gold} />
        <StatCard delay={22} icon="▣" title="配置权限 600" detail="目录、令牌、Key 全部收紧" color={colors.blue} />
        <StatCard delay={30} icon="!" title="陌生项目拦截" detail="代码块与嵌入网页先确认" color={colors.coral} />
        <StatCard delay={38} icon="✓" title="依赖漏洞 0" detail="npm audit 无已知风险" color={colors.green} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 120,
          top: 530,
          width: 396,
          padding: '26px 30px',
          borderRadius: 17,
          backgroundColor: colors.ink,
          color: '#fff',
          boxShadow: '0 24px 60px rgba(20,23,29,.2)',
          ...rise(frame, fps, 44),
        }}
      >
        <div style={{fontFamily: fonts.mono, fontSize: 15, color: '#8D9AB0', letterSpacing: 2}}>
          QUALITY GATE
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 20, fontFamily: fonts.sans}}>
          <div>
            <div style={{fontSize: 42, fontWeight: 720, color: '#fff'}}>174</div>
            <div style={{fontSize: 16, color: '#9BA5B5'}}>积木自检</div>
          </div>
          <div>
            <div style={{fontSize: 42, fontWeight: 720, color: '#fff'}}>21</div>
            <div style={{fontSize: 16, color: '#9BA5B5'}}>完整回归</div>
          </div>
          <div>
            <div style={{fontSize: 42, fontWeight: 720, color: colors.goldSoft}}>0</div>
            <div style={{fontSize: 16, color: '#9BA5B5'}}>漏洞</div>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

export const ClosingScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame, fps, config: {damping: 14, stiffness: 105}});
  const line1 = rise(frame, fps, 8);
  const line2 = rise(frame, fps, 18);
  const line3 = rise(frame, fps, 28);
  return (
    <SceneFrame duration={70}>
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 138,
          transform: `scale(${0.8 + p * 0.2})`,
          transformOrigin: 'left top',
        }}
      >
        <BrandMark size={104} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 350,
          width: 1300,
          fontFamily: fonts.sans,
        }}
      >
        <div
          style={{
            ...line1,
            fontSize: 74,
            fontWeight: 770,
            lineHeight: 1.1,
            color: colors.ink,
            letterSpacing: -2,
          }}
        >
          素材入项目
          <span style={{color: colors.gold}}> · </span>
          章节出积木
        </div>
        <div
          style={{
            ...line2,
            fontSize: 74,
            fontWeight: 770,
            lineHeight: 1.1,
            color: colors.ink,
            marginTop: 12,
            letterSpacing: -2,
          }}
        >
          AI <span style={{color: colors.gold}}>直接调用</span>你的创作素材
        </div>
        <div
          style={{
            ...line3,
            display: 'flex',
            gap: 12,
            marginTop: 38,
          }}
        >
          <Pill filled>本次更新</Pill>
          <Pill color={colors.blue}>安全默认</Pill>
          <Pill color={colors.green}>21 / 21 回归通过</Pill>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 280,
          width: 430,
          height: 430,
          borderRadius: 55,
          background: `linear-gradient(145deg, ${colors.goldSoft}, rgba(184,134,43,.18))`,
          transform: `rotate(${interpolate(p, [0, 1], [12, -4])}deg)`,
          opacity: p,
        }}
      >
        <Img
          src={staticFile('assets/logo.png')}
          style={{
            width: 310,
            height: 310,
            position: 'absolute',
            left: 60,
            top: 60,
            filter: 'drop-shadow(0 22px 40px rgba(90,68,25,.18))',
          }}
        />
      </div>
    </SceneFrame>
  );
};
