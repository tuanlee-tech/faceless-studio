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

export const CleanSplitLayout: React.FC<LayoutProps> = ({ spec, templateConfig, imageSources }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const currentTime = frame / fps;
  const isPortrait = height > width;

  const words = spec?.narration?.words || [];
  const { activeImage, cameraScale } = getActiveBeatInfo(spec, currentTime, imageSources);

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: templateConfig.colors.background || "#0f172a",
        color: templateConfig.colors.text || "#f8fafc",
        display: "flex",
        flexDirection: isPortrait ? "column" : "row",
        fontFamily: templateConfig.subtitles?.fontFamily || "'Be Vietnam Pro', system-ui, sans-serif",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Full Visual Stage */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {activeImage ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              position: "relative",
              backgroundColor: "#000000",
            }}
          >
            <Img
              src={activeImage}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${cameraScale})`,
              }}
            />
            {/* Subtle bottom vignette to ensure subtitles are 100% legible */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "35%",
                background: "linear-gradient(to top, rgba(15, 23, 42, 0.85) 0%, transparent 100%)",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: "80%",
              height: "80%",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderRadius: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: templateConfig.colors.secondary || "#64748b",
            }}
          >
            Clean Split
          </div>
        )}
      </div>

      {/* Subtitles anchored at bottom */}
      <Subtitle
        words={words}
        styleConfig={templateConfig.subtitles}
      />
    </div>
  );
};
