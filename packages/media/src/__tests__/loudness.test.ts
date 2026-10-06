import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LoudnessProcessor } from "../loudness-processor.js";
import { probe } from "../ffmpeg.js";

const execFileAsync = promisify(execFile);
const TEST_DIR = resolve(tmpdir(), "faceless-loudness-test-" + Date.now());

describe("LoudnessProcessor", () => {
  const processor = new LoudnessProcessor();

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("measures audio loudness accurately", async () => {
    const audioPath = join(TEST_DIR, "sine-raw.wav");
    // Generate 2-second 1000Hz tone
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=2",
      "-c:a",
      "pcm_s16le",
      audioPath,
    ]);

    const measurement = await processor.measure(audioPath);
    expect(measurement.input_i).toBeDefined();
    expect(Number.isFinite(measurement.input_i)).toBe(true);
    expect(measurement.target_i).toBe(-14);
    expect(measurement.target_tp).toBe(-1);
  });

  it("normalizes audio to approximately -14 LUFS", async () => {
    const rawAudio = join(TEST_DIR, "audio-raw.wav");
    const normAudio = join(TEST_DIR, "audio-norm.wav");

    // Generate 3-second tone with loudness ~ -21 LUFS
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=3",
      "-c:a",
      "pcm_s16le",
      rawAudio,
    ]);

    await processor.normalizeAudio(rawAudio, normAudio, { targetI: -14, targetTP: -1 });

    expect(fs.existsSync(normAudio)).toBe(true);
    const measuredNorm = await processor.measure(normAudio);
    // Should be approximately -14 LUFS (within +- 0.8 LUFS)
    expect(measuredNorm.input_i).toBeGreaterThanOrEqual(-14.8);
    expect(measuredNorm.input_i).toBeLessThanOrEqual(-13.2);
  });

  it("processes video end-to-end: extracts, normalizes audio to -14 LUFS, and muxes back into MP4", async () => {
    const inputVideo = join(TEST_DIR, "video-in.mp4");
    const outputVideo = join(TEST_DIR, "video-out.mp4");

    // Generate 2-second MP4 with video and audio
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=2:size=320x240:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=2",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      inputVideo,
    ]);

    const finalPath = await processor.processVideo(inputVideo, outputVideo);
    expect(finalPath).toBe(outputVideo);
    expect(fs.existsSync(outputVideo)).toBe(true);

    // Verify video stream is preserved and audio is normalized
    const info = await probe(outputVideo);
    const videoStream = info.streams.find((s) => s.codec_type === "video");
    const audioStream = info.streams.find((s) => s.codec_type === "audio");

    expect(videoStream).toBeDefined();
    expect(audioStream).toBeDefined();

    const finalLoudness = await processor.measure(outputVideo);
    // Should be approximately -14 LUFS
    expect(finalLoudness.input_i).toBeGreaterThanOrEqual(-15.0);
    expect(finalLoudness.input_i).toBeLessThanOrEqual(-13.0);
  });

  it("handles video without audio stream gracefully without error", async () => {
    const silentVideo = join(TEST_DIR, "silent.mp4");
    const outSilentVideo = join(TEST_DIR, "silent-out.mp4");

    // Generate video without audio
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=1:size=320x240:rate=30",
      "-c:v",
      "libx264",
      silentVideo,
    ]);

    const resultPath = await processor.processVideo(silentVideo, outSilentVideo);
    expect(fs.existsSync(resultPath)).toBe(true);

    const info = await probe(resultPath);
    expect(info.streams.some((s) => s.codec_type === "video")).toBe(true);
    expect(info.streams.some((s) => s.codec_type === "audio")).toBe(false);
  });
});
