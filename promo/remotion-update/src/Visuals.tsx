import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, fonts, rise} from './theme';

export const PaperBackdrop = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 840], [-70, 80]);
  const y = interpolate(frame, [0, 840], [30, -35]);
  return (
    <AbsoluteFill style={{backgroundColor: colors.paper, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(28,31,38,.16) 1px, transparent 1.3px)',
          backgroundSize: '72px 72px',
          opacity: 0.36,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 850,
          height: 850,
          borderRadius: '50%',
          background: 'rgba(184,134,43,.18)',
          filter: 'blur(140px)',
          right: -180 + x,
          top: -250 + y,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'rgba(76,110,245,.10)',
          filter: 'blur(120px)',
          left: -120 - x * 0.4,
          bottom: -210 - y * 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 26,
          border: `1px solid ${colors.line}`,
          borderRadius: 22,
          opacity: 0.72,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 24,
          height: 24,
          left: 42,
          top: 42,
          borderRadius: 6,
          border: `2px solid ${colors.gold}`,
          boxShadow: `inset 5px 5px 0 ${colors.gold}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 46,
          top: 46,
          display: 'flex',
          gap: 8,
          opacity: 0.5,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{width: 9, height: 9, borderRadius: '50%', backgroundColor: colors.gold}}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const BrandMark = ({size = 76}: {size?: number}) => {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
      <Img src={staticFile('assets/logo.png')} style={{width: size, height: size}} />
      <div>
        <div
          style={{
            fontFamily: fonts.sans,
            fontWeight: 750,
            fontSize: size * 0.28,
            letterSpacing: 1,
            color: colors.ink,
          }}
        >
          积木剧场
        </div>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: size * 0.13,
            color: colors.gold,
            letterSpacing: 3,
            marginTop: 2,
          }}
        >
          JIMUCHANG
        </div>
      </div>
    </div>
  );
};

export const Kicker = ({children, index}: {children: ReactNode; index: string}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22}}>
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 21,
        color: colors.gold,
        border: `1px solid ${colors.gold}`,
        borderRadius: 999,
        padding: '5px 12px',
        letterSpacing: 1.2,
      }}
    >
      {index}
    </span>
    <span
      style={{
        fontFamily: fonts.sans,
        fontSize: 21,
        color: colors.dim,
        letterSpacing: 3,
      }}
    >
      {children}
    </span>
  </div>
);

export const SceneTitle = ({
  title,
  subtitle,
  width = 720,
}: {
  title: ReactNode;
  subtitle?: string;
  width?: number;
}) => (
  <div style={{width, fontFamily: fonts.sans}}>
    <div
      style={{
        color: colors.ink,
        fontSize: 76,
        lineHeight: 1.16,
        fontWeight: 760,
        letterSpacing: -1.8,
      }}
    >
      {title}
    </div>
    {subtitle ? (
      <div
        style={{
          color: colors.dim,
          fontSize: 27,
          lineHeight: 1.8,
          marginTop: 23,
          maxWidth: 670,
        }}
      >
        {subtitle}
      </div>
    ) : null}
  </div>
);

export const Pill = ({
  children,
  color = colors.gold,
  filled = false,
  style,
}: {
  children: ReactNode;
  color?: string;
  filled?: boolean;
  style?: CSSProperties;
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 15px',
      borderRadius: 999,
      border: `1px solid ${color}`,
      backgroundColor: filled ? color : 'rgba(255,255,255,.58)',
      color: filled ? '#fff' : color,
      fontFamily: fonts.sans,
      fontSize: 20,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </span>
);

export const FocusRect = ({
  left,
  top,
  width,
  height,
  delay = 20,
  color = colors.gold,
}: {
  left: string;
  top: string;
  width: string;
  height: string;
  delay?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const pulse = 0.55 + Math.sin((frame - delay) / 11) * 0.22;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: `3px solid ${color}`,
        borderRadius: 15,
        boxShadow: `0 0 0 9999px rgba(13,16,22,${Math.max(0.08, pulse * 0.1)})`,
        opacity: frame < delay ? 0 : 1,
        transform: `scale(${frame < delay ? 0.96 : 1})`,
      }}
    />
  );
};

export const BrowserFrame = ({
  src,
  width,
  height,
  enterDelay = 10,
  style,
  focus,
  position = 'center center',
}: {
  src: string;
  width: number;
  height: number;
  enterDelay?: number;
  style?: CSSProperties;
  focus?: {left: string; top: string; width: string; height: string};
  position?: string;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - enterDelay, fps, config: {damping: 16, stiffness: 100}});
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 17,
        overflow: 'hidden',
        border: `1px solid ${colors.line}`,
        background: colors.paper2,
        boxShadow: '0 34px 85px rgba(30,33,40,.18)',
        opacity: p,
        transform: `translateY(${(1 - p) * 38}px) scale(${0.96 + p * 0.04})`,
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          height: 39,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px',
          background: '#ECEAE4',
          borderBottom: '1px solid #D9D5CC',
        }}
      >
        {['#E35B4F', '#E7B747', '#51A867'].map((c) => (
          <div key={c} style={{width: 10, height: 10, borderRadius: '50%', background: c}} />
        ))}
        <div
          style={{
            marginLeft: 10,
            width: 260,
            height: 20,
            borderRadius: 6,
            background: 'rgba(255,255,255,.7)',
          }}
        />
      </div>
      <div style={{position: 'relative', width: '100%', height: height - 39}}>
        <Img
          src={staticFile(src)}
          style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: position}}
        />
        {focus ? <FocusRect {...focus} /> : null}
      </div>
    </div>
  );
};

export const MiniBlock = ({
  children,
  color,
  delay,
  width = 270,
}: {
  children: ReactNode;
  color: string;
  delay: number;
  width?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 14, stiffness: 130}});
  return (
    <div
      style={{
        width,
        minHeight: 58,
        borderRadius: 11,
        backgroundColor: color,
        color: '#fff',
        padding: '13px 18px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        fontFamily: fonts.sans,
        fontSize: 20,
        fontWeight: 650,
        boxShadow: '0 9px 20px rgba(30,33,40,.12)',
        opacity: p,
        transform: `translateX(${(1 - p) * -35}px) scale(${0.92 + p * 0.08})`,
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 10,
          top: -6,
          width: 14,
          height: 10,
          borderRadius: '5px 5px 0 0',
          backgroundColor: color,
          filter: 'brightness(1.16)',
        }}
      />
      {children}
    </div>
  );
};

export const StatCard = ({
  icon,
  title,
  detail,
  color,
  delay,
}: {
  icon: string;
  title: string;
  detail: string;
  color: string;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const style = rise(frame, 30, delay);
  return (
    <div
      style={{
        width: 310,
        minHeight: 160,
        padding: '22px 24px',
        boxSizing: 'border-box',
        borderRadius: 15,
        border: `1px solid ${colors.line}`,
        backgroundColor: 'rgba(251,250,247,.9)',
        boxShadow: '0 18px 48px rgba(30,33,40,.09)',
        fontFamily: fonts.sans,
        ...style,
      }}
    >
      <div style={{fontSize: 34, color, marginBottom: 13}}>{icon}</div>
      <div style={{fontSize: 24, fontWeight: 700, color: colors.ink}}>{title}</div>
      <div style={{fontSize: 18, color: colors.dim, lineHeight: 1.6, marginTop: 7}}>{detail}</div>
    </div>
  );
};

export const TerminalLine = ({
  children,
  delay,
  color = '#D9E2F2',
}: {
  children: ReactNode;
  delay: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const chars = String(children).length;
  const shown = Math.max(0, Math.min(chars, Math.floor((frame - delay) * 1.7)));
  return (
    <div
      style={{
        minHeight: 38,
        color,
        fontFamily: fonts.mono,
        fontSize: 20,
        letterSpacing: -0.3,
        opacity: frame < delay ? 0 : 1,
      }}
    >
      {String(children).slice(0, shown)}
      {frame >= delay && shown < chars ? (
        <span style={{color: colors.goldSoft}}>▌</span>
      ) : null}
    </div>
  );
};

export const ProgressRail = ({scene}: {scene: number}) => {
  const labels = ['更新概览', '素材区', '章节双模式', 'AI × MCP', '安全与质量', '结束'];
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        bottom: 35,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        fontFamily: fonts.sans,
      }}
    >
      <span style={{fontSize: 15, color: colors.gold, width: 100}}>{labels[scene]}</span>
      {labels.map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i <= scene ? colors.gold : 'rgba(28,31,38,.13)',
            opacity: i === scene ? 1 : 0.72,
          }}
        />
      ))}
      <span style={{fontFamily: fonts.mono, fontSize: 15, color: colors.dim}}>
        0{scene + 1} / 06
      </span>
    </div>
  );
};
