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

/**
 * Chia danh sách từ thành các câu / vế ngắn gọn (hiển thị 1 câu / 1 dòng duy nhất tại một thời điểm).
 * Tách ngay khi gặp dấu câu kết thúc (. ? ! ; … :), hoặc dấu phẩy khi đã có >= 4 từ, hoặc tối đa 6-7 từ.
 */
export function groupWordsIntoChunks(words: Word[], maxWordsPerLine = 7): SubtitleChunk[] {
  if (!words || words.length === 0) return [];
  const chunks: SubtitleChunk[] = [];
  let currentGroup: Word[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentGroup.push(word);

    const isLast = i === words.length - 1;
    const cleanText = word.text.trim();
    const isSentenceEnd = /[.?!;…]$/.test(cleanText);
    const isClauseEnd = /[,:]$/.test(cleanText);
    const nextWord = !isLast ? words[i + 1] : null;
    const hasPause = nextWord ? nextWord.startSec - word.endSec > 0.35 : false;
    const reachedLimit = currentGroup.length >= maxWordsPerLine;

    // Ngắt câu / vế tự nhiên:
    if (
      isSentenceEnd ||
      (isClauseEnd && currentGroup.length >= 4) ||
      reachedLimit ||
      hasPause ||
      isLast
    ) {
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

  // Luôn phân rã danh sách từ thành các câu / vế ngắn gọn (1 câu / dòng duy nhất)
  const chunks = groupWordsIntoChunks(words, styleConfig.maxWordsPerLine ?? 7);

  let activeDisplayWords: Word[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const nextChunk = i < chunks.length - 1 ? chunks[i + 1] : null;
    // Giữ phụ đề hiển thị cho đến khi bắt đầu câu kế tiếp hoặc dứt câu + 0.3s
    const bufferEnd = nextChunk ? nextChunk.startSec : chunk.endSec + 0.3;

    if (currentTime >= chunk.startSec && currentTime < bufferEnd) {
      activeDisplayWords = chunk.words;
      break;
    }
  }

  if (activeDisplayWords.length === 0) {
    return null;
  }

  const fontFamily = styleConfig.fontFamily ?? "'Playfair Display', Georgia, serif";
  const fontSize = styleConfig.fontSize ?? 44;
  const defaultColor = styleConfig.color ?? "#ffffff";
  const highlightColor = styleConfig.highlightColor ?? "#ffd700";
  const bottomOffset = styleConfig.bottomOffset ?? 90;
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
        padding: "0 40px",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap", // Hiển thị trên 1 dòng duy nhất, không rườm rà
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          padding: "14px 28px",
          borderRadius: "16px",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7)",
          maxWidth: "92%",
          whiteSpace: "nowrap",
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
                  ? `0 0 16px ${highlightColor}80, 0 2px 4px rgba(0, 0, 0, 0.9)`
                  : "0 2px 4px rgba(0, 0, 0, 0.9)",
                transform: isActive ? "scale(1.08)" : "scale(1)",
                transition: "none", // Golden rule #4: Tất định
                display: "inline-block",
                lineHeight: 1.25,
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
