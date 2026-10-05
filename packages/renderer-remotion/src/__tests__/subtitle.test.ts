import { describe, it, expect } from "vitest";
import { groupWordsIntoChunks } from "../remotion/Subtitle.js";
import type { Word } from "@faceless/core";

describe("Subtitle word-level timing & chunking", () => {
  const words: Word[] = [
    { id: "w01", text: "Xin", startSec: 0.0, endSec: 0.3, confidence: 1.0 },
    { id: "w02", text: "chào", startSec: 0.3, endSec: 0.6, confidence: 1.0 },
    { id: "w03", text: "các", startSec: 0.6, endSec: 0.9, confidence: 1.0 },
    { id: "w04", text: "bạn", startSec: 0.9, endSec: 1.2, confidence: 1.0 },
    { id: "w05", text: "đến", startSec: 1.2, endSec: 1.5, confidence: 1.0 },
    { id: "w06", text: "với", startSec: 1.5, endSec: 1.8, confidence: 1.0 },
    { id: "w07", text: "kênh", startSec: 1.8, endSec: 2.1, confidence: 1.0 },
    { id: "w08", text: "này", startSec: 2.1, endSec: 2.4, confidence: 1.0 },
  ];

  it("chunks words respecting maxWordsPerLine limit", () => {
    const chunks = groupWordsIntoChunks(words, 4);
    expect(chunks.length).toBe(2);
    expect(chunks[0].words.map((w) => w.text)).toEqual(["Xin", "chào", "các", "bạn"]);
    expect(chunks[0].startSec).toBe(0.0);
    expect(chunks[0].endSec).toBe(1.2);
    expect(chunks[1].words.map((w) => w.text)).toEqual(["đến", "với", "kênh", "này"]);
    expect(chunks[1].startSec).toBe(1.2);
    expect(chunks[1].endSec).toBe(2.4);
  });

  it("splits chunks early on spoken pauses > 0.4s", () => {
    const wordsWithPause: Word[] = [
      { id: "w01", text: "Xin", startSec: 0.0, endSec: 0.3, confidence: 1.0 },
      { id: "w02", text: "chào", startSec: 0.3, endSec: 0.6, confidence: 1.0 },
      // Pause of 0.8s between 0.6 and 1.4
      { id: "w03", text: "Việt", startSec: 1.4, endSec: 1.8, confidence: 1.0 },
      { id: "w04", text: "Nam", startSec: 1.8, endSec: 2.2, confidence: 1.0 },
    ];

    const chunks = groupWordsIntoChunks(wordsWithPause, 6);
    expect(chunks.length).toBe(2);
    expect(chunks[0].words.map((w) => w.text)).toEqual(["Xin", "chào"]);
    expect(chunks[1].words.map((w) => w.text)).toEqual(["Việt", "Nam"]);
  });

  it("handles empty words array gracefully", () => {
    const chunks = groupWordsIntoChunks([]);
    expect(chunks).toEqual([]);
  });
});
