import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoSpec, TemplateConfig } from "@faceless/core";
import { Subtitle } from "../Subtitle.js";

export interface LayoutProps {
  spec?: VideoSpec;
  templateConfig: TemplateConfig;
}

export const BaroqueMonoLayout: React.FC<LayoutProps> = ({ spec, templateConfig }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const title = (spec?.meta?.title as string) || spec?.projectSlug || "Faceless Studio";
  const seconds = (frame / fps).toFixed(1);
  const chapter = spec?.chapters?.[0];
  const chapterTitle = chapter?.title || "Chương 1";
  const isPortrait = height > width;

  const words = spec?.narration?.words || [];
  const captions = chapter?.beats?.flatMap((b) => b.captions || []) || [];

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
        fontFamily: templateConfig.subtitles?.fontFamily || "'Playfair Display', Georgia, serif",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        padding: isPortrait ? "80px 40px" : "60px 100px",
      }}
    >
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
        }}
      />

      {/* Chapter header */}
      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "6px",
          fontSize: isPortrait ? 22 : 18,
          color: templateConfig.colors.primary || "#d97706",
          marginBottom: 20,
          fontWeight: 600,
        }}
      >
        — {chapterTitle} —
      </div>

      {/* Main Title */}
      <h1
        style={{
          fontSize: isPortrait ? 52 : 62,
          fontWeight: 700,
          textAlign: "center",
          margin: "0 0 24px 0",
          maxWidth: "85%",
          lineHeight: 1.25,
          color: templateConfig.colors.text || "#f5f5f4",
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        }}
      >
        {title}
      </h1>

      {/* Decorative divider */}
      <div
        style={{
          width: "120px",
          height: "2px",
          backgroundColor: templateConfig.colors.primary || "#d97706",
          opacity: 0.6,
          marginBottom: 28,
        }}
      />

      {/* Time & Frame counter */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          fontSize: isPortrait ? 20 : 18,
          color: templateConfig.colors.secondary || "#78716c",
          letterSpacing: "2px",
        }}
      >
        <span>{seconds}s</span>
        <span>•</span>
        <span>FRAME {frame}</span>
      </div>

      {/* Word-level Subtitle */}
      <Subtitle
        words={words}
        captions={captions}
        styleConfig={templateConfig.subtitles}
      />
    </div>
  );
};
