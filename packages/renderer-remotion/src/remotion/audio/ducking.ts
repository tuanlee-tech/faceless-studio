/**
 * Audio Ducking calculation utilities for Remotion.
 *
 * Implements deterministic volume calculation based on narration words.
 * Merges speech intervals with silence < 0.5s into continuous segments,
 * ducks background music to 20-30% (default 25%) during narration,
 * and recovers volume smoothly during pauses >= 0.5s.
 */

export interface SpeechSegment {
  startSec: number;
  endSec: number;
}

export interface WordTimestamp {
  startSec: number;
  endSec: number;
}

export interface DuckingOptions {
  /**
   * Minimum pause duration (seconds) required between words to treat as silence.
   * If pause is less than this value, words are merged into one continuous speech segment.
   * Default: 0.5s.
   */
  minSilenceSec?: number;

  /**
   * Volume ratio when ducked (0 to 1).
   * E.g. 0.25 means 25% of base volume (75% reduction).
   * Default: 0.25 (in the 20-30% range).
   */
  duckRatio?: number;

  /**
   * Fade in/out ramp duration in seconds for smooth volume transitions.
   * Default: 0.2s.
   */
  fadeDurationSec?: number;
}

/**
 * Merges narration words into continuous speech segments.
 * Consecutive words separated by less than `minSilenceSec` are combined.
 */
export function buildSpeechSegments(
  words: readonly WordTimestamp[],
  minSilenceSec = 0.5
): SpeechSegment[] {
  if (!words || words.length === 0) {
    return [];
  }

  // Filter valid words and sort by startSec
  const validWords = words
    .filter((w) => typeof w.startSec === "number" && typeof w.endSec === "number" && w.endSec >= w.startSec)
    .map((w) => ({ startSec: Math.max(0, w.startSec), endSec: Math.max(0, w.endSec) }))
    .sort((a, b) => a.startSec - b.startSec);

  if (validWords.length === 0) {
    return [];
  }

  const segments: SpeechSegment[] = [
    { startSec: validWords[0].startSec, endSec: validWords[0].endSec },
  ];

  for (let i = 1; i < validWords.length; i++) {
    const word = validWords[i];
    const currentSegment = segments[segments.length - 1];

    if (word.startSec - currentSegment.endSec < minSilenceSec) {
      // Extend current segment
      currentSegment.endSec = Math.max(currentSegment.endSec, word.endSec);
    } else {
      // New speech segment
      segments.push({ startSec: word.startSec, endSec: word.endSec });
    }
  }

  return segments;
}

/**
 * Calculates ducking factor alpha in [0, 1] at a given timestamp.
 * alpha = 0: Full base volume (no ducking).
 * alpha = 1: Fully ducked.
 *
 * Smooth ramps occur in [startSec - fade, startSec] and [endSec, endSec + fade].
 */
export function getDuckingAlpha(
  timeSec: number,
  segments: readonly SpeechSegment[],
  fadeDurationSec = 0.2
): number {
  if (segments.length === 0 || timeSec < 0) {
    return 0;
  }

  const fade = Math.max(0.001, fadeDurationSec);
  let maxAlpha = 0;

  for (const seg of segments) {
    const fadeStart = Math.max(0, seg.startSec - fade);
    const fadeEnd = seg.endSec + fade;

    if (timeSec < fadeStart) {
      // Segments are sorted; if time is before this segment's lead-in,
      // it might still be in the tail of a previous segment, but we check all relevant.
      continue;
    }

    if (timeSec > fadeEnd) {
      // After this segment's fade-out, check next segment
      continue;
    }

    // Inside active speech segment: full ducking
    if (timeSec >= seg.startSec && timeSec <= seg.endSec) {
      return 1;
    }

    // Lead-in ramp (ducking down): from fadeStart to seg.startSec
    if (timeSec >= fadeStart && timeSec < seg.startSec) {
      const alpha = (timeSec - fadeStart) / (seg.startSec - fadeStart);
      if (alpha > maxAlpha) maxAlpha = alpha;
    }

    // Tail-out ramp (recovering up): from seg.endSec to fadeEnd
    if (timeSec > seg.endSec && timeSec <= fadeEnd) {
      const alpha = 1 - (timeSec - seg.endSec) / fade;
      if (alpha > maxAlpha) maxAlpha = alpha;
    }
  }

  return Math.min(1, Math.max(0, maxAlpha));
}

/**
 * Computes ducked volume at a specific frame.
 * Formula: baseVolume * (1 - alpha * (1 - duckRatio))
 */
export function calculateDuckedVolume(
  frame: number,
  fps: number,
  segments: readonly SpeechSegment[],
  baseVolume: number,
  duckRatio = 0.25,
  fadeDurationSec = 0.2
): number {
  if (baseVolume <= 0) {
    return 0;
  }

  const timeSec = frame / fps;
  const alpha = getDuckingAlpha(timeSec, segments, fadeDurationSec);
  const factor = 1 - alpha * (1 - duckRatio);
  return Math.max(0, baseVolume * factor);
}

/**
 * Creates a pre-compiled ducking evaluator function for Remotion volume callback.
 * Fast O(1) ~ O(K) lookup per frame where K is number of speech segments.
 */
export function createDuckedVolumeEvaluator(
  fps: number,
  words: readonly WordTimestamp[],
  baseVolume: number,
  options: DuckingOptions = {}
): (frame: number) => number {
  const minSilenceSec = options.minSilenceSec ?? 0.5;
  const duckRatio = options.duckRatio ?? 0.25;
  const fadeDurationSec = options.fadeDurationSec ?? 0.2;

  const segments = buildSpeechSegments(words, minSilenceSec);

  return (frame: number): number => {
    return calculateDuckedVolume(frame, fps, segments, baseVolume, duckRatio, fadeDurationSec);
  };
}
