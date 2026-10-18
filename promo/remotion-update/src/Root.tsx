import {Composition} from 'remotion';
import {UpdateVideo} from './UpdateVideo';

export const RemotionRoot = () => {
  return (
    <Composition
      id="JimuchangUpdate"
      component={UpdateVideo}
      durationInFrames={840}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
