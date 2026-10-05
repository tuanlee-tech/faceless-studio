import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import * as fs from "node:fs";
import { RemotionRendererAdapter } from "../adapter.js";
import type { VideoSpec } from "@faceless/core";

const TEST_DIR = "/tmp/faceless-remotion-test-" + Date.now();

describe("RemotionRendererAdapter", () => {
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

  const dummySpec: VideoSpec = {
    specVersion: "0.1.0",
    projectSlug: "test-render",
    topicId: "sample",
    templateId: "minimal",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 1, // 1 sec = 30 frames
      words: [
        {
          id: "w001",
          text: "Xin chào",
          startSec: 0,
          endSec: 1.0,
          confidence: 1.0,
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
            range: { startWordId: "w001", endWordId: "w001" },
            layout: "title-card",
            assets: [],
            captions: [],
            sfx: [],
          },
        ],
      },
    ],
    music: [],
    meta: {
      title: "Test Remotion Video",
    },
  };

  it("renders a still image", async () => {
    const specPath = resolve(TEST_DIR, "spec.json");
    fs.writeFileSync(specPath, JSON.stringify(dummySpec, null, 2), "utf-8");

    const outPath = resolve(TEST_DIR, "still.png");
    const adapter = new RemotionRendererAdapter();

    await adapter.still({
      specPath,
      format: "long-16x9",
      frame: 0,
      outPath,
    });

    expect(fs.existsSync(outPath)).toBe(true);
    const stat = fs.statSync(outPath);
    expect(stat.size).toBeGreaterThan(0);
  }, 60000);

  it("renders short video clip to mp4", async () => {
    const specPath = resolve(TEST_DIR, "spec.json");
    fs.writeFileSync(specPath, JSON.stringify(dummySpec, null, 2), "utf-8");

    const outPath = resolve(TEST_DIR, "video.mp4");
    const adapter = new RemotionRendererAdapter();

    let lastProgress = 0;
    await adapter.render({
      specPath,
      format: "long-16x9",
      frames: [0, 5], // render first 5 frames for fast testing
      outPath,
      onProgress: (p) => {
        lastProgress = p;
      },
    });

    expect(fs.existsSync(outPath)).toBe(true);
    const stat = fs.statSync(outPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(lastProgress).toBeGreaterThan(0);
  }, 60000);
});
