/**
 * @faceless/media — Align client (stub)
 *
 * Mock Aligner — phân bổ đều từng từ theo thời lượng.
 * Sẽ thay bằng WhisperX/stable-ts sidecar client sau spike.
 */

import type { Aligner, Word } from "@faceless/core";

/**
 * Mock Aligner — phân bổ đều từng từ.
 */
export class MockAligner implements Aligner {
  async align(audioPath: string, text: string, lang: "vi"): Promise<Word[]> {
    const words = text.split(/\s+/).filter(Boolean);
    const avgDur = 0.3; // 300ms per word mock
    return words.map((w, i) => ({
      id: `w${String(i + 1).padStart(3, "0")}`,
      text: w,
      startSec: i * avgDur,
      endSec: (i + 1) * avgDur,
      confidence: 0.95,
    }));
  }
}