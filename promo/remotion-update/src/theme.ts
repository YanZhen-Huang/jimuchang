import {Easing, interpolate, spring} from 'remotion';

export const colors = {
  paper: '#F4F2ED',
  paper2: '#FBFAF7',
  ink: '#1C1F26',
  dim: '#70757F',
  line: '#D8D4CA',
  gold: '#B8862B',
  goldSoft: '#E4C987',
  blue: '#4C6EF5',
  coral: '#E4573D',
  green: '#2E9B68',
  red: '#C84D45',
  dark: '#111419',
};

export const fonts = {
  sans: '"Source Han Sans SC", "Noto Sans CJK SC", sans-serif',
  mono: '"Source Han Mono SC", "Noto Sans Mono CJK SC", monospace',
};

export const fade = (frame: number, duration: number, edge = 14) => {
  return interpolate(
    frame,
    [0, edge, Math.max(edge + 1, duration - edge), duration - 1],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
};

export const rise = (frame: number, fps: number, delay = 0, damping = 15) => {
  const p = spring({
    frame: frame - delay,
    fps,
    config: {damping, stiffness: 120, mass: 0.8},
  });
  return {
    opacity: Math.min(1, p * 1.2),
    transform: `translateY(${(1 - p) * 34}px) scale(${0.97 + p * 0.03})`,
  };
};

export const slide = (frame: number, from: number, to: number, input: [number, number]) => {
  return interpolate(frame, input, [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
};
