import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { VideoSpec } from "@faceless/core";

export interface MainVideoProps {
  spec?: VideoSpec;
}

export const MainVideo: React.FC<MainVideoProps> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const title = (spec?.meta?.title as string) || spec?.projectSlug || "Faceless Studio";
  const seconds = (frame / fps).toFixed(1);
  const chapterTitle = spec?.chapters?.[0]?.title || "Chapter 1";

  const isPortrait = height > width;

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "#000000",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: isPortrait ? "60px 40px" : "40px 80px",
      }}
    >
      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "4px",
          fontSize: isPortrait ? 24 : 20,
          color: "#888888",
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
          color: "#aaaaaa",
        }}
      >
        <span>Time: {seconds}s</span>
        <span>•</span>
        <span>Frame: {frame}</span>
      </div>
    </div>
  );
};
