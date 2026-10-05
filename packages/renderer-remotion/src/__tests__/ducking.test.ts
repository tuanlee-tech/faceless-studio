import { describe, it, expect } from "vitest";
import {
  buildSpeechSegments,
  getDuckingAlpha,
  calculateDuckedVolume,
  createDuckedVolumeEvaluator,
} from "../remotion/audio/ducking.js";

describe("Audio Ducking Logic", () => {
  describe("buildSpeechSegments", () => {
    it("returns empty array for empty or invalid words", () => {
      expect(buildSpeechSegments([])).toEqual([]);
      expect(
        buildSpeechSegments([
          { startSec: 2, endSec: 1 }, // invalid
        ])
      ).toEqual([]);
    });

    it("merges words separated by silence < 0.5s into a single segment", () => {
      const words = [
        { startSec: 1.0, endSec: 1.4 },
        { startSec: 1.6, endSec: 2.0 }, // gap 0.2s < 0.5s -> merge
        { startSec: 2.2, endSec: 2.5 }, // gap 0.2s < 0.5s -> merge
      ];

      const segments = buildSpeechSegments(words, 0.5);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({ startSec: 1.0, endSec: 2.5 });
    });

    it("splits segments when pause is >= 0.5s", () => {
      const words = [
        { startSec: 1.0, endSec: 1.5 },
        { startSec: 2.1, endSec: 3.0 }, // gap 0.6s >= 0.5s -> split!
      ];

      const segments = buildSpeechSegments(words, 0.5);
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({ startSec: 1.0, endSec: 1.5 });
      expect(segments[1]).toEqual({ startSec: 2.1, endSec: 3.0 });
    });

    it("sorts unsorted words properly", () => {
      const words = [
        { startSec: 5.0, endSec: 6.0 },
        { startSec: 1.0, endSec: 2.0 },
      ];

      const segments = buildSpeechSegments(words, 0.5);
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({ startSec: 1.0, endSec: 2.0 });
      expect(segments[1]).toEqual({ startSec: 5.0, endSec: 6.0 });
    });
  });

  describe("getDuckingAlpha", () => {
    const segments = [
      { startSec: 2.0, endSec: 4.0 },
    ];
    const fade = 0.2;

    it("returns 0 when far before speech", () => {
      expect(getDuckingAlpha(1.0, segments, fade)).toBe(0);
    });

    it("ramps up during lead-in fade (1.8s to 2.0s)", () => {
      expect(getDuckingAlpha(1.8, segments, fade)).toBeCloseTo(0, 4);
      expect(getDuckingAlpha(1.9, segments, fade)).toBeCloseTo(0.5, 4);
      expect(getDuckingAlpha(2.0, segments, fade)).toBe(1);
    });

    it("returns 1 during active narration", () => {
      expect(getDuckingAlpha(2.5, segments, fade)).toBe(1);
      expect(getDuckingAlpha(3.0, segments, fade)).toBe(1);
      expect(getDuckingAlpha(4.0, segments, fade)).toBe(1);
    });

    it("ramps down during recovery fade (4.0s to 4.2s)", () => {
      expect(getDuckingAlpha(4.1, segments, fade)).toBeCloseTo(0.5, 4);
      expect(getDuckingAlpha(4.2, segments, fade)).toBeCloseTo(0, 4);
      expect(getDuckingAlpha(5.0, segments, fade)).toBe(0);
    });
  });

  describe("calculateDuckedVolume & createDuckedVolumeEvaluator", () => {
    const fps = 30;
    const baseVolume = 0.4;
    const duckRatio = 0.25; // 25% of 0.4 = 0.1

    const words = [
      { startSec: 2.0, endSec: 3.0 },
      // gap of 1.0s (silence >= 0.5s)
      { startSec: 4.0, endSec: 5.0 },
    ];

    it("provides full base volume before speech starts", () => {
      const evaluator = createDuckedVolumeEvaluator(fps, words, baseVolume, { duckRatio });
      // Frame 30 = 1.0s -> before speech
      expect(evaluator(30)).toBeCloseTo(0.4, 4);
    });

    it("ducks volume down to duckRatio (25%) during speech", () => {
      const evaluator = createDuckedVolumeEvaluator(fps, words, baseVolume, { duckRatio });
      // Frame 75 = 2.5s -> inside speech segment 1
      expect(evaluator(75)).toBeCloseTo(0.1, 4); // 0.4 * 0.25 = 0.1
    });

    it("recovers to base volume during silence >= 0.5s", () => {
      const evaluator = createDuckedVolumeEvaluator(fps, words, baseVolume, { duckRatio });
      // Frame 105 = 3.5s -> in the middle of pause between 3.0s and 4.0s
      // (fade-out ends at 3.2s, lead-in starts at 3.8s, so 3.5s is fully recovered)
      expect(evaluator(105)).toBeCloseTo(0.4, 4);
    });

    it("ducks again during second speech segment", () => {
      const evaluator = createDuckedVolumeEvaluator(fps, words, baseVolume, { duckRatio });
      // Frame 135 = 4.5s -> inside speech segment 2
      expect(evaluator(135)).toBeCloseTo(0.1, 4);
    });

    it("recovers after all speech ends", () => {
      const evaluator = createDuckedVolumeEvaluator(fps, words, baseVolume, { duckRatio });
      // Frame 180 = 6.0s -> after all speech
      expect(evaluator(180)).toBeCloseTo(0.4, 4);
    });

    it("handles zero base volume gracefully", () => {
      const evaluator = createDuckedVolumeEvaluator(fps, words, 0);
      expect(evaluator(30)).toBe(0);
      expect(evaluator(75)).toBe(0);
    });
  });
});
