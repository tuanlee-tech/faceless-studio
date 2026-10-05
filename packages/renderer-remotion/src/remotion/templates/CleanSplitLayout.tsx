import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoSpec, TemplateConfig } from "@faceless/core";
import { Subtitle } from "../Subtitle.js";

export interface LayoutProps {
  spec?: VideoSpec;
  templateConfig: TemplateConfig;
}

export const CleanSplitLayout: React.FC<LayoutProps> = ({ spec, templateConfig }) => {
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
        backgroundColor: templateConfig.colors.background || "#0f172a",
        color: templateConfig.colors.text || "#f8fafc",
        display: "flex",
        flexDirection: isPortrait ? "column" : "row",
        fontFamily: templateConfig.subtitles?.fontFamily || "'Be Vietnam Pro', system-ui, sans-serif",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Primary Split Area (Text & Context) */}
      <div
        style={{
          flex: isPortrait ? 1 : 1.1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: isPortrait ? "40px 40px" : "60px 80px",
          boxSizing: "border-box",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "6px 14px",
            backgroundColor: `${templateConfig.colors.primary}20`,
            border: `1px solid ${templateConfig.colors.primary}60`,
            borderRadius: "6px",
            color: templateConfig.colors.primary || "#38bdf8",
            fontSize: isPortrait ? 18 : 16,
            fontWeight: 600,
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          {chapterTitle}
        </div>

        <h1
          style={{
            fontSize: isPortrait ? 44 : 54,
            fontWeight: 800,
            margin: "0 0 20px 0",
            lineHeight: 1.2,
            color: templateConfig.colors.text || "#f8fafc",
          }}
        >
          {title}
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: isPortrait ? 18 : 16,
            color: templateConfig.colors.secondary || "#64748b",
            fontWeight: 500,
          }}
        >
          <span>⏱ {seconds}s</span>
          <span>•</span>
          <span>FPS: {fps}</span>
          <span>•</span>
          <span>Frame: {frame}</span>
        </div>
      </div>

      {/* Secondary Split Area (Visual Card / Media Placeholder) */}
      <div
        style={{
          flex: isPortrait ? 1 : 0.9,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: isPortrait ? "20px 40px 100px 40px" : "60px 80px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "85%",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            border: `2px dashed ${templateConfig.colors.primary}40`,
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: templateConfig.colors.secondary || "#64748b",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: `${templateConfig.colors.primary}15`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
              color: templateConfig.colors.primary,
              fontSize: "28px",
            }}
          >
            ✦
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: templateConfig.colors.text,
              marginBottom: 8,
            }}
          >
            Visual Showcase
          </div>
          <div
            style={{
              fontSize: 15,
              textAlign: "center",
              maxWidth: "80%",
              lineHeight: 1.4,
            }}
          >
            Clean Split Layout • Template {templateConfig.id}
          </div>
        </div>
      </div>

      {/* Subtitles anchored at bottom */}
      <Subtitle
        words={words}
        captions={captions}
        styleConfig={templateConfig.subtitles}
      />
    </div>
  );
};
