import React from "react";
import type { VideoSpec, TemplateConfig } from "@faceless/core";
import { BaroqueMonoLayout } from "./templates/BaroqueMonoLayout.js";
import { CleanSplitLayout } from "./templates/CleanSplitLayout.js";
import { MinimalLayout } from "./templates/MinimalLayout.js";
import { AudioMixer, type AudioSources } from "./AudioMixer.js";

export interface MainVideoProps {
  spec?: VideoSpec;
  fontsCss?: string;
  templateConfig?: TemplateConfig;
  audioSources?: AudioSources;
  imageSources?: Record<string, string>;
}

const DEFAULT_FALLBACK_TEMPLATE: TemplateConfig = {
  id: "minimal",
  name: "Minimal Dark",
  version: "1.0.0",
  description: "Template tối giản Phase 1, nền đen chữ trắng",
  fonts: [],
  colors: {
    background: "#000000",
    text: "#ffffff",
    primary: "#888888",
    secondary: "#555555",
    accent: "#aaaaaa",
    highlight: "#ffd700",
  },
  subtitles: {
    fontFamily: "system-ui, sans-serif",
    fontSize: 44,
    color: "#ffffff",
    highlightColor: "#ffd700",
    bottomOffset: 80,
    maxWordsPerLine: 6,
    textTransform: "none",
  },
  layoutPresets: ["center-text"],
  motionPresets: ["fade-in"],
};

export const MainVideo: React.FC<MainVideoProps> = ({
  spec,
  fontsCss,
  templateConfig,
  audioSources,
  imageSources,
}) => {
  const resolvedTemplate: TemplateConfig = templateConfig || DEFAULT_FALLBACK_TEMPLATE;
  const templateId = spec?.templateId || resolvedTemplate.id;

  return (
    <>
      {fontsCss && <style dangerouslySetInnerHTML={{ __html: fontsCss }} />}
      <AudioMixer spec={spec} audioSources={audioSources} />
      {templateId === "baroque-mono" ? (
        <BaroqueMonoLayout spec={spec} templateConfig={resolvedTemplate} imageSources={imageSources} />
      ) : templateId === "clean-split" ? (
        <CleanSplitLayout spec={spec} templateConfig={resolvedTemplate} imageSources={imageSources} />
      ) : (
        <MinimalLayout spec={spec} templateConfig={resolvedTemplate} imageSources={imageSources} />
      )}
    </>
  );
};
