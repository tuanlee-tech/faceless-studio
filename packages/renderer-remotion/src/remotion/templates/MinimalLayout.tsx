import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoSpec, TemplateConfig } from "@faceless/core";
import { Subtitle } from "../Subtitle.js";

export interface LayoutProps {
  spec?: VideoSpec;
  templateConfig: TemplateConfig;
}

export const MinimalLayout: React.FC<LayoutProps> = ({ spec, templateConfig }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const title = (spec?.meta?.title as string) || spec?.projectSlug || "Faceless Studio";
  const seconds = (frame / fps).toFixed(1);
  const chapter = spec?.chapters?.[0];
  const chapterTitle = chapter?.title || "Chapter 1";

  const isPortrait = height > width;

  const words = spec?.narration?.words || [];
  const captions = chapter?.beats?.flatMap((b) => b.captions || []) || [];

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
        fontFamily: templateConfig.subtitles?.fontFamily || "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: isPortrait ? "60px 40px" : "40px 80px",
        position: "relative",
      }}
    >
      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "4px",
          fontSize: isPortrait ? 24 : 20,
          color: templateConfig.colors.primary || "#888888",
          marginBottom: 16,
        }}
      >
        {chapterTitle}
      </div>

      <h1
        style={{
          fontSize: isPortrait ? 56 : 64,
          fontWeight: 700,
          textAlign: "center",
          margin: "0 0 24px 0",
          maxWidth: "90%",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>

      <div
        style={{
          display: "flex",
          gap: "20px",
          fontSize: isPortrait ? 24 : 20,
          color: templateConfig.colors.secondary || "#aaaaaa",
        }}
      >
        <span>Time: {seconds}s</span>
        <span>•</span>
        <span>Frame: {frame}</span>
      </div>

      <Subtitle
        words={words}
        captions={captions}
        styleConfig={templateConfig.subtitles}
      />
    </div>
  );
};
