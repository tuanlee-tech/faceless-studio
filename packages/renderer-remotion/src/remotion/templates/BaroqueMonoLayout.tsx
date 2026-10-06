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

export const BaroqueMonoLayout: React.FC<LayoutProps> = ({ spec, templateConfig, imageSources }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTime = frame / fps;
  const words = spec?.narration?.words || [];
  const { activeImage, cameraScale } = getActiveBeatInfo(spec, currentTime, imageSources);

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: templateConfig.colors.background || "#0c0a09",
        color: templateConfig.colors.text || "#f5f5f4",
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
      {/* Background Visual Asset with Ken Burns & Chiaroscuro Vignette */}
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
              filter: "contrast(1.15) brightness(0.85)",
            }}
          />
          {/* Chiaroscuro volumetric subtle edge vignette */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(circle at center, rgba(12, 10, 9, 0.15) 0%, rgba(12, 10, 9, 0.5) 75%, rgba(12, 10, 9, 0.85) 100%)",
            }}
          />
        </div>
      )}

      {/* Ornate border frame */}
      <div
        style={{
          position: "absolute",
          top: "24px",
          bottom: "24px",
          left: "24px",
          right: "24px",
          border: `1px solid ${templateConfig.colors.primary}40`,
          pointerEvents: "none",
          boxSizing: "border-box",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "28px",
          bottom: "28px",
          left: "28px",
          right: "28px",
          border: `1px solid ${templateConfig.colors.primary}20`,
          pointerEvents: "none",
          boxSizing: "border-box",
          zIndex: 1,
        }}
      />

      {/* Word-level Subtitle (hiển thị 1 câu ngắn gọn, căn giữa ở đáy video) */}
      <Subtitle
        words={words}
        styleConfig={templateConfig.subtitles}
      />
    </div>
  );
};
