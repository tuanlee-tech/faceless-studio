/**
 * @faceless/media — TTS client (stub)
 *
 * Mock TTS engine — sinh file WAV trống (silence) cho testing.
 * Sẽ thay bằng VieNeu sidecar client ở Phase 1.
 */

import type { TtsEngine, TtsJob, TtsResult } from "@faceless/core";

/**
 * Mock TTS engine — sinh file WAV silence cho testing.
 */
export class MockTtsEngine implements TtsEngine {
  async *synthesizeBatch(jobs: TtsJob[]): AsyncIterable<TtsResult> {
    for (const job of jobs) {
      yield {
        jobId: job.id,
        audioPath: `audio/chunks/mock-${job.id}.wav`,
        durationSec: job.text.length * 0.08, // ~80ms per char estimate
      };
    }
  }
}