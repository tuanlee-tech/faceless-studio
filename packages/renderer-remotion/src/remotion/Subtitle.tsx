import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Word, Caption, TemplateSubtitleStyle } from "@faceless/core";

export interface SubtitleProps {
  words?: Word[];
  captions?: Caption[];
  styleConfig?: Partial<TemplateSubtitleStyle>;
  frameOverride?: number;
  fpsOverride?: number;
}

export interface SubtitleChunk {
  words: Word[];
  startSec: number;
  endSec: number;
}

export function groupWordsIntoChunks(words: Word[], maxWordsPerLine = 6): SubtitleChunk[] {
  if (!words || words.length === 0) return [];
  const chunks: SubtitleChunk[] = [];
  let currentGroup: Word[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentGroup.push(word);

    const isLast = i === words.length - 1;
    const reachedLimit = currentGroup.length >= maxWordsPerLine;
    const nextWord = !isLast ? words[i + 1] : null;
    const hasPause = nextWord && nextWord.startSec - word.endSec > 0.4;

    if (reachedLimit || hasPause || isLast) {
      chunks.push({
        words: [...currentGroup],
        startSec: currentGroup[0].startSec,
        endSec: currentGroup[currentGroup.length - 1].endSec,
      });
      currentGroup = [];
    }
  }

  return chunks;
}

export const Subtitle: React.FC<SubtitleProps> = ({
  words = [],
  captions = [],
  styleConfig = {},
  frameOverride,
  fpsOverride,
}) => {
  let frame = 0;
  let fps = 30;

  try {
    frame = frameOverride ?? useCurrentFrame();
    fps = fpsOverride ?? useVideoConfig().fps;
  } catch {
    frame = frameOverride ?? 0;
    fps = fpsOverride ?? 30;
  }

  const currentTime = frame / fps;

  // Determine active words to display
  let activeDisplayWords: Word[] = [];

  if (captions.length > 0) {
    const wordMap = new Map<string, Word>(words.map((w) => [w.id, w]));
    for (const cap of captions) {
      const capWords = cap.wordIds.map((id) => wordMap.get(id)).filter(Boolean) as Word[];
      if (capWords.length > 0) {
        const start = capWords[0].startSec;
        const end = capWords[capWords.length - 1].endSec + 0.3;
        if (currentTime >= start && currentTime <= end) {
          activeDisplayWords = capWords;
          break;
        }
      }
    }
  }

  if (activeDisplayWords.length === 0 && words.length > 0) {
    const chunks = groupWordsIntoChunks(words, styleConfig.maxWordsPerLine ?? 6);
    for (const chunk of chunks) {
      if (currentTime >= chunk.startSec && currentTime <= chunk.endSec + 0.3) {
        activeDisplayWords = chunk.words;
        break;
      }
    }
  }

  if (activeDisplayWords.length === 0) {
    return null;
  }

  const fontFamily = styleConfig.fontFamily ?? "system-ui, sans-serif";
  const fontSize = styleConfig.fontSize ?? 48;
  const defaultColor = styleConfig.color ?? "#ffffff";
  const highlightColor = styleConfig.highlightColor ?? "#ffd700";
  const bottomOffset = styleConfig.bottomOffset ?? 80;
  const textTransform = styleConfig.textTransform ?? "none";

  return (
    <div
      style={{
        position: "absolute",
        bottom: `${bottomOffset}px`,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 60px",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px",
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          padding: "12px 28px",
          borderRadius: "16px",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          maxWidth: "85%",
        }}
      >
        {activeDisplayWords.map((word) => {
          const isActive =
            currentTime >= word.startSec && currentTime <= word.endSec + 0.05;

          return (
            <span
              key={word.id}
              style={{
                fontFamily,
                fontSize: `${fontSize}px`,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? highlightColor : defaultColor,
                textTransform,
                textShadow: isActive
                  ? `0 0 16px ${highlightColor}66, 0 2px 4px rgba(0, 0, 0, 0.8)`
                  : "0 2px 4px rgba(0, 0, 0, 0.8)",
                transform: isActive ? "scale(1.08)" : "scale(1)",
                transition: "none", // Golden rule #4: no CSS transitions
                display: "inline-block",
                lineHeight: 1.3,
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
