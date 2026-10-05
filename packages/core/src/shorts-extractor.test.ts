import { describe, it, expect } from "vitest";
import { extractShort, autoDetectShortCandidates } from "./shorts-extractor.js";
import { SPEC_VERSION, type VideoSpec } from "./schemas/video-spec.js";

describe("ShortsExtractor (extractShort)", () => {
  const longSpec: VideoSpec = {
    specVersion: SPEC_VERSION,
    projectSlug: "long-video-01",
    topicId: "psychology",
    templateId: "clean-split",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 120,
      words: [
        { id: "w01", text: "Xin", startSec: 10.0, endSec: 10.4, confidence: 0.95 },
        { id: "w02", text: "chào", startSec: 10.4, endSec: 10.8, confidence: 0.95 },
        { id: "w03", text: "các", startSec: 10.8, endSec: 11.2, confidence: 0.95 },
        { id: "w04", text: "bạn", startSec: 11.2, endSec: 11.6, confidence: 0.95 },
        { id: "w05", text: "hãy", startSec: 15.0, endSec: 15.5, confidence: 0.95 },
        { id: "w06", text: "lắng", startSec: 15.5, endSec: 16.0, confidence: 0.95 },
        { id: "w07", text: "nghe", startSec: 16.0, endSec: 16.5, confidence: 0.95 },
        { id: "w08", text: "điều", startSec: 25.0, endSec: 25.5, confidence: 0.95 },
        { id: "w09", text: "này", startSec: 25.5, endSec: 26.0, confidence: 0.95 },
      ],
    },
    chapters: [
      {
        id: "c1",
        title: "Chương 1: Mở đầu",
        beats: [
          {
            id: "b1",
            range: { startWordId: "w01", endWordId: "w04" },
            layout: "center-text",
            assets: [],
            captions: [{ id: "cap1", wordIds: ["w01", "w02", "w03", "w04"] }],
            sfx: [{ id: "s1", anchorWordId: "w01", offsetSec: 0, sfxId: "bell", volume: 0.8 }],
          },
          {
            id: "b2",
            range: { startWordId: "w05", endWordId: "w07" },
            layout: "split-left",
            assets: [],
            captions: [{ id: "cap2", wordIds: ["w05", "w06", "w07"] }],
            sfx: [],
          },
        ],
      },
      {
        id: "c2",
        title: "Chương 2: Thân bài",
        beats: [
          {
            id: "b3",
            range: { startWordId: "w08", endWordId: "w09" },
            layout: "full-bleed",
            assets: [],
            captions: [{ id: "cap3", wordIds: ["w08", "w09"] }],
            sfx: [],
          },
        ],
      },
    ],
    music: [{ id: "m1", libraryId: "ambient", startSec: 5, endSec: 30, volume: 0.3 }],
    meta: {
      title: "Tâm lý học hành vi",
    },
  };

  it("extracts short spec and shifts timestamps to start at 0", () => {
    // Extract words w01 to w07 (from 10.0s to 16.5s)
    const shortSpec = extractShort(longSpec, {
      startWordId: "w01",
      endWordId: "w07",
      title: "Short Hook #1",
      shortIndex: 1,
    });

    expect(shortSpec.narration.words).toHaveLength(7);
    // Shifted: original 10.0s becomes 0.0s
    expect(shortSpec.narration.words[0].startSec).toBe(0);
    expect(shortSpec.narration.words[0].endSec).toBe(0.4);
    // w07 was 16.0s to 16.5s -> 6.0s to 6.5s
    const lastWord = shortSpec.narration.words[6];
    expect(lastWord.startSec).toBe(6.0);
    expect(lastWord.endSec).toBe(6.5);
    expect(shortSpec.narration.durationSec).toBe(6.5);

    // Meta check
    expect(shortSpec.meta.isShort).toBe(true);
    expect(shortSpec.meta.title).toBe("Short Hook #1");
  });

  it("clamps beats and omits unincluded chapters/beats", () => {
    // Extract only w05 to w07 (Chương 1 Beat 2)
    const shortSpec = extractShort(longSpec, {
      startWordId: "w05",
      endWordId: "w07",
    });

    expect(shortSpec.chapters).toHaveLength(1);
    expect(shortSpec.chapters[0].beats).toHaveLength(1);
    expect(shortSpec.chapters[0].beats[0].id).toBe("b2");
    expect(shortSpec.chapters[0].beats[0].range.startWordId).toBe("w05");
    expect(shortSpec.chapters[0].beats[0].range.endWordId).toBe("w07");
  });

  it("throws error for non-existent word IDs", () => {
    expect(() =>
      extractShort(longSpec, {
        startWordId: "invalid_start",
        endWordId: "w04",
      }),
    ).toThrow("not found");
  });

  it("auto-detects sensible candidates from spec", () => {
    const candidates = autoDetectShortCandidates(longSpec, 60, 2);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0].startWordId).toBeDefined();
    expect(candidates[0].endWordId).toBeDefined();
    expect(candidates[0].estimatedSeconds).toBeGreaterThan(0);
  });
});
