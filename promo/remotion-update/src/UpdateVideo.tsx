import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {
  AiMcpScene,
  AssetsScene,
  ClosingScene,
  DualModeScene,
  IntroScene,
  SecurityScene,
} from './Scenes';
import {PaperBackdrop, ProgressRail} from './Visuals';

export const UpdateVideo = () => {
  const frame = useCurrentFrame();
  const scene = frame < 100 ? 0 : frame < 280 ? 1 : frame < 460 ? 2 : frame < 640 ? 3 : frame < 770 ? 4 : 5;
  return (
    <AbsoluteFill>
      <PaperBackdrop />

      <Sequence from={0} durationInFrames={100}>
        <IntroScene />
      </Sequence>
      <Sequence from={100} durationInFrames={180}>
        <AssetsScene />
      </Sequence>
      <Sequence from={280} durationInFrames={180}>
        <DualModeScene />
      </Sequence>
      <Sequence from={460} durationInFrames={180}>
        <AiMcpScene />
      </Sequence>
      <Sequence from={640} durationInFrames={130}>
        <SecurityScene />
      </Sequence>
      <Sequence from={770} durationInFrames={70}>
        <ClosingScene />
      </Sequence>

      <Audio src={staticFile('audio/update-bed.mp3')} volume={0.55} />
      {[100, 280, 460, 640, 770].map((from) => (
        <Sequence key={from} from={from} durationInFrames={16}>
          <Audio src={staticFile('audio/click.wav')} volume={0.4} />
        </Sequence>
      ))}

      <ProgressRail scene={scene} />
    </AbsoluteFill>
  );
};
