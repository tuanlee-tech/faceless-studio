import React from "react";
import { Composition } from "remotion";
import { MainVideo, type MainVideoProps } from "./MainVideo.js";

const DEFAULT_PROPS: MainVideoProps = {
  spec: undefined,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Long16x9"
        component={MainVideo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={({ props }: { props: MainVideoProps }) => {
          const fps = props.spec?.fps || 30;
          const durationSec = props.spec?.narration?.durationSec || 5;
          const durationInFrames = Math.max(30, Math.round(durationSec * fps));
          return {
            fps,
            durationInFrames,
          };
        }}
      />
      <Composition
        id="Short9x16"
        component={MainVideo}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={({ props }: { props: MainVideoProps }) => {
          const fps = props.spec?.fps || 30;
          const durationSec = props.spec?.narration?.durationSec || 5;
          const durationInFrames = Math.max(30, Math.round(durationSec * fps));
          return {
            fps,
            durationInFrames,
          };
        }}
      />
    </>
  );
};
