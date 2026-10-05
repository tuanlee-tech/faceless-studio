import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";
import { RemotionRendererAdapter } from "../adapter.js";
import type { VideoSpec } from "@faceless/core";

const TEST_DIR = resolve(tmpdir(), "faceless-remotion-test-" + Date.now());

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
          text: "Xin",
          startSec: 0,
          endSec: 0.5,
          confidence: 1.0,
        },
        {
          id: "w002",
          text: "chào",
          startSec: 0.5,
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
            range: { startWordId: "w001", endWordId: "w002" },
            layout: "title-card",
            assets: [],
            captions: [{ id: "cap1", wordIds: ["w001", "w002"] }],
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

  it("renders a still image with minimal template", async () => {
    const specPath = resolve(TEST_DIR, "spec-minimal.json");
    fs.writeFileSync(specPath, JSON.stringify(dummySpec, null, 2), "utf-8");

    const outPath = resolve(TEST_DIR, "still-minimal.png");
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

  it("renders still images for baroque-mono and clean-split templates", async () => {
    const adapter = new RemotionRendererAdapter();

    // Baroque Mono
    const baroqueSpec: VideoSpec = { ...dummySpec, templateId: "baroque-mono" };
    const baroqueSpecPath = resolve(TEST_DIR, "spec-baroque.json");
    fs.writeFileSync(baroqueSpecPath, JSON.stringify(baroqueSpec, null, 2), "utf-8");
    const baroqueOut = resolve(TEST_DIR, "still-baroque.png");

    await adapter.still({
      specPath: baroqueSpecPath,
      format: "long-16x9",
      frame: 0,
      outPath: baroqueOut,
    });
    expect(fs.existsSync(baroqueOut)).toBe(true);
    const baroqueStat = fs.statSync(baroqueOut);
    expect(baroqueStat.size).toBeGreaterThan(0);

    // Clean Split
    const cleanSpec: VideoSpec = { ...dummySpec, templateId: "clean-split" };
    const cleanSpecPath = resolve(TEST_DIR, "spec-clean.json");
    fs.writeFileSync(cleanSpecPath, JSON.stringify(cleanSpec, null, 2), "utf-8");
    const cleanOut = resolve(TEST_DIR, "still-clean.png");

    await adapter.still({
      specPath: cleanSpecPath,
      format: "long-16x9",
      frame: 0,
      outPath: cleanOut,
    });
    expect(fs.existsSync(cleanOut)).toBe(true);
    const cleanStat = fs.statSync(cleanOut);
    expect(cleanStat.size).toBeGreaterThan(0);
  }, 90000);

  it("renders short video clip to mp4", async () => {
    const specPath = resolve(TEST_DIR, "spec.json");
    fs.writeFileSync(specPath, JSON.stringify(dummySpec, null, 2), "utf-8");

    const outPath = resolve(TEST_DIR, "video.mp4");
    const adapter = new RemotionRendererAdapter();

    let lastProgress = 0;
    await adapter.render({
      specPath,
      format: "long-16x9",
      frames: [0, 5],
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
