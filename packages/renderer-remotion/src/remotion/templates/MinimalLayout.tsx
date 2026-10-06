import React from "react";
import { useCurrentFrame, useVideoConfig, Img } from "remotion";
import type { VideoSpec, TemplateConfig } from "@faceless/core";
import { Subtitle } from "../Subtitle.js";
import { getActiveBeatInfo } from "../getActiveBeatInfo.js";

export interface LayoutProps {
  spec?: VideoSpec;
  templateConfig: TemplateConfig;
  imageSources?: Record<string, string>;
}

export const MinimalLayout: React.FC<LayoutProps> = ({ spec, templateConfig, imageSources }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTime = frame / fps;
  const words = spec?.narration?.words || [];
  const { activeImage, cameraScale } = getActiveBeatInfo(spec, currentTime, imageSources);

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: templateConfig.colors.background || "#000000",
        color: templateConfig.colors.text || "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background Visual Asset */}
      {activeImage && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            overflow: "hidden",
            zIndex: 0,
          }}
        >
          <Img
            src={activeImage}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${cameraScale})`,
              filter: "contrast(1.1) brightness(0.75)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
            }}
          />
        </div>
      )}

      {/* Subtitles anchored at bottom */}
      <Subtitle
        words={words}
        styleConfig={templateConfig.subtitles}
      />
    </div>
  );
};
