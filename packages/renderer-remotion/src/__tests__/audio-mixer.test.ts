import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";
import { RemotionRendererAdapter } from "../adapter.js";
import type { VideoSpec } from "@faceless/core";

const TEST_DIR = resolve(tmpdir(), "faceless-audio-test-" + Date.now());

// Minimal valid 44-byte PCM WAV header (silence)
const SILENT_WAV_BASE64 =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

describe("Audio Mixing & Resolution", () => {
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

  const dummyAudioSpec: VideoSpec = {
    specVersion: "0.1.0",
    projectSlug: "test-audio-mix",
    topicId: "sample",
    templateId: "minimal",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 2,
      words: [
        {
          id: "w001",
          text: "Xin",
          startSec: 0,
          endSec: 0.5,
          confidence: 0.95,
        },
        {
          id: "w002",
          text: "chào",
          startSec: 0.5,
          endSec: 1.0,
          confidence: 0.95,
        },
      ],
    },
    chapters: [
      {
        id: "c1",
        title: "Chương 1",
        beats: [
          {
            id: "b1",
            range: { startWordId: "w001", endWordId: "w002" },
            layout: "title-card",
            assets: [],
            captions: [{ id: "cap1", wordIds: ["w001", "w002"] }],
            sfx: [
              {
                id: "sfx-bell",
                anchorWordId: "w001",
                offsetSec: 0,
                sfxId: "bell",
                volume: 0.8,
              },
            ],
          },
        ],
      },
    ],
    music: [
      {
        id: "bgm-1",
        libraryId: "lofi-beat",
        startSec: 0,
        volume: 0.3,
      },
    ],
    meta: {
      title: "Test Audio Mixing Video",
    },
  };

  it("resolves audio sources to Data URIs when files exist on disk", () => {
    const adapter = new RemotionRendererAdapter();

    // Create fake audio files on disk
    const audioDir = resolve(TEST_DIR, "audio");
    fs.mkdirSync(audioDir, { recursive: true });
    fs.writeFileSync(resolve(audioDir, "narration.wav"), Buffer.from(SILENT_WAV_BASE64, "base64"));

    const musicDir = resolve(TEST_DIR, "music");
    fs.mkdirSync(musicDir, { recursive: true });
    fs.writeFileSync(resolve(musicDir, "lofi-beat.mp3"), Buffer.from(SILENT_WAV_BASE64, "base64"));

    const sfxDir = resolve(TEST_DIR, "sfx");
    fs.mkdirSync(sfxDir, { recursive: true });
    fs.writeFileSync(resolve(sfxDir, "bell.wav"), Buffer.from(SILENT_WAV_BASE64, "base64"));

    const resolved = adapter.resolveAudioSources(dummyAudioSpec, TEST_DIR);

    expect(resolved.narration).toBeDefined();
    expect(resolved.narration?.startsWith("data:audio/wav;base64,")).toBe(true);

    expect(resolved.music?.["bgm-1"]).toBeDefined();
    expect(resolved.music?.["bgm-1"]?.startsWith("data:audio/mpeg;base64,")).toBe(true);

    expect(resolved.sfx?.["sfx-bell"]).toBeDefined();
    expect(resolved.sfx?.["sfx-bell"]?.startsWith("data:audio/wav;base64,")).toBe(true);
  });

  it("handles missing audio gracefully by leaving sources undefined", () => {
    const adapter = new RemotionRendererAdapter();
    const resolved = adapter.resolveAudioSources(dummyAudioSpec, TEST_DIR);

    expect(resolved.narration).toBeUndefined();
    expect(resolved.music?.["bgm-1"]).toBeUndefined();
    expect(resolved.sfx?.["sfx-bell"]).toBeUndefined();
  });

  it("preserves explicit data URIs passed in spec", () => {
    const adapter = new RemotionRendererAdapter();
    const directSpec: VideoSpec = {
      ...dummyAudioSpec,
      narration: {
        ...dummyAudioSpec.narration,
        audioPath: `data:audio/wav;base64,${SILENT_WAV_BASE64}`,
      },
      music: [
        {
          id: "m-direct",
          libraryId: `data:audio/wav;base64,${SILENT_WAV_BASE64}`,
          startSec: 0,
          volume: 0.25,
        },
      ],
    };

    const resolved = adapter.resolveAudioSources(directSpec, TEST_DIR);
    expect(resolved.narration).toBe(`data:audio/wav;base64,${SILENT_WAV_BASE64}`);
    expect(resolved.music?.["m-direct"]).toBe(`data:audio/wav;base64,${SILENT_WAV_BASE64}`);
  });

  it("renders video with audio tracks and ducking without crashing", async () => {
    const adapter = new RemotionRendererAdapter();

    const specPath = resolve(TEST_DIR, "spec-audio.json");
    const outPath = resolve(TEST_DIR, "audio-mixed-video.mp4");

    const specWithDataUris: VideoSpec = {
      ...dummyAudioSpec,
      narration: {
        ...dummyAudioSpec.narration,
        audioPath: `data:audio/wav;base64,${SILENT_WAV_BASE64}`,
      },
      music: [
        {
          id: "bgm-1",
          libraryId: `data:audio/wav;base64,${SILENT_WAV_BASE64}`,
          startSec: 0,
          volume: 0.3,
        },
      ],
    };

    fs.writeFileSync(specPath, JSON.stringify(specWithDataUris, null, 2), "utf-8");

    let progressRecorded = false;
    await adapter.render({
      specPath,
      format: "long-16x9",
      frames: [0, 5],
      outPath,
      onProgress: (p) => {
        if (p > 0) progressRecorded = true;
      },
    });

    expect(fs.existsSync(outPath)).toBe(true);
    const stat = fs.statSync(outPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(progressRecorded).toBe(true);
  }, 60000);
});
