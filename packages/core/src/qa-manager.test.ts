import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";
import { QAManager, type QAMediaInspector } from "./qa-manager.js";
import type { VideoSpec } from "./schemas/video-spec.js";

const TEST_DIR = resolve(tmpdir(), "faceless-qa-test-" + Date.now());

describe("QAManager", () => {
  let qaManager: QAManager;

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    qaManager = new QAManager(tmpdir());
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  const validSpec: VideoSpec = {
    specVersion: "0.1.0",
    projectSlug: "test-qa-proj",
    topicId: "psychology",
    templateId: "minimal",
    fps: 30,
    narration: {
      audioPath: "audio/narr.wav",
      durationSec: 10,
      words: [
        { id: "w1", text: "Xin", startSec: 0, endSec: 0.5, confidence: 0.95 },
        { id: "w2", text: "chào", startSec: 0.5, endSec: 1.0, confidence: 0.92 },
      ],
    },
    chapters: [
      {
        id: "c1",
        title: "Chương 1",
        beats: [
          {
            id: "b1",
            range: { startWordId: "w1", endWordId: "w2" },
            layout: "title-card",
            assets: [
              {
                assetId: "img-01",
                filePath: "assets/img-01.png",
                kind: "image",
                license: "CC0",
              },
            ],
            captions: [{ id: "cap1", wordIds: ["w1", "w2"] }],
            sfx: [],
          },
        ],
      },
    ],
    music: [],
    meta: {},
  };

  describe("Pre-Render QA", () => {
    it("fails when spec file is missing", async () => {
      const report = await qaManager.runPreRenderQA(TEST_DIR);
      expect(report.passed).toBe(false);
      expect(report.summary.errors).toBe(1);
      expect(report.items[0].id).toBe("spec-exists");
    });

    it("fails when spec has invalid schema", async () => {
      fs.writeFileSync(join(TEST_DIR, "spec.json"), JSON.stringify({ invalid: true }));
      const report = await qaManager.runPreRenderQA(TEST_DIR);
      expect(report.passed).toBe(false);
      expect(report.summary.errors).toBeGreaterThanOrEqual(1);
      expect(report.items[0].category).toBe("schema");
    });

    it("catches missing asset files, missing licenses, and low confidence words", async () => {
      const lowConfSpec: VideoSpec = {
        ...validSpec,
        narration: {
          ...validSpec.narration,
          words: [
            { id: "w1", text: "Xin", startSec: 0, endSec: 0.5, confidence: 0.95 },
            { id: "w2", text: "chào", startSec: 0.5, endSec: 1.0, confidence: 0.65 }, // < 0.8
          ],
        },
      };

      fs.writeFileSync(join(TEST_DIR, "spec.json"), JSON.stringify(lowConfSpec, null, 2));

      const report = await qaManager.runPreRenderQA(TEST_DIR);
      // Asset "img-01.png" and audio "narr.wav" are missing on disk -> errors
      expect(report.passed).toBe(false);
      expect(report.summary.errors).toBeGreaterThanOrEqual(2);

      // Confidence warning (< 0.8) -> warning
      const confWarn = report.items.find((i) => i.category === "audio_confidence");
      expect(confWarn).toBeDefined();
      expect(confWarn?.severity).toBe("warning");
      expect(confWarn?.message).toContain("w2");
    });

    it("passes when all files exist and licenses are valid", async () => {
      // Create required files on disk
      fs.mkdirSync(join(TEST_DIR, "assets"), { recursive: true });
      fs.mkdirSync(join(TEST_DIR, "audio"), { recursive: true });

      fs.writeFileSync(join(TEST_DIR, "assets/img-01.png"), "fake image");
      fs.writeFileSync(join(TEST_DIR, "audio/narr.wav"), "fake audio");

      // Create manifest with asset
      const manifest = {
        projectSlug: "test-qa-proj",
        updatedAt: new Date().toISOString(),
        assets: [
          {
            id: "img-01",
            fileName: "img-01.png",
            filePath: "assets/img-01.png",
            kind: "image",
            source: "local",
            license: "CC0",
            importedAt: new Date().toISOString(),
          },
        ],
      };
      fs.writeFileSync(join(TEST_DIR, "assets/manifest.json"), JSON.stringify(manifest));

      fs.writeFileSync(join(TEST_DIR, "spec.json"), JSON.stringify(validSpec, null, 2));

      const report = await qaManager.runPreRenderQA(TEST_DIR);
      expect(report.passed).toBe(true);
      expect(report.summary.errors).toBe(0);
      expect(report.summary.warnings).toBe(0);
    });
  });

  describe("Post-Render QA", () => {
    const mockInspector: QAMediaInspector = {
      probeDuration: async () => 10.1, // matches ~10s
      measureLoudness: async () => ({ input_i: -14.2, input_tp: -1.0 }), // matches -14 LUFS
    };

    it("fails when video file is missing", async () => {
      const report = await qaManager.runPostRenderQA(TEST_DIR, mockInspector, {
        videoPath: "dist/long-16x9.mp4",
      });
      expect(report.passed).toBe(false);
      expect(report.summary.errors).toBe(1);
      expect(report.items[0].id).toBe("video-missing");
    });

    it("fails when video file is smaller than 1000 bytes", async () => {
      fs.mkdirSync(join(TEST_DIR, "dist"), { recursive: true });
      const vPath = join(TEST_DIR, "dist/long-16x9.mp4");
      fs.writeFileSync(vPath, "too short"); // < 1000 bytes

      const report = await qaManager.runPostRenderQA(TEST_DIR, mockInspector, {
        videoPath: "dist/long-16x9.mp4",
        expectedDuration: 10,
      });

      expect(report.passed).toBe(false);
      const sizeErr = report.items.find((i) => i.id === "video-size-invalid");
      expect(sizeErr).toBeDefined();
    });

    it("warns when loudness or duration deviates", async () => {
      fs.mkdirSync(join(TEST_DIR, "dist"), { recursive: true });
      const vPath = join(TEST_DIR, "dist/long-16x9.mp4");
      fs.writeFileSync(vPath, Buffer.alloc(2000, 1)); // > 1000 bytes

      const deviantInspector: QAMediaInspector = {
        probeDuration: async () => 13.5, // 3.5s diff from 10s -> warning
        measureLoudness: async () => ({ input_i: -10.5, input_tp: -0.2 }), // deviates from -14 LUFS, TP > -0.5
      };

      const report = await qaManager.runPostRenderQA(TEST_DIR, deviantInspector, {
        videoPath: "dist/long-16x9.mp4",
        expectedDuration: 10,
      });

      expect(report.summary.warnings).toBeGreaterThanOrEqual(2);
      const durWarn = report.items.find((i) => i.category === "duration");
      const loudWarn = report.items.find((i) => i.category === "loudness");

      expect(durWarn).toBeDefined();
      expect(loudWarn).toBeDefined();
    });

    it("passes with 0 errors when video is intact and within loudness target", async () => {
      fs.mkdirSync(join(TEST_DIR, "dist"), { recursive: true });
      const vPath = join(TEST_DIR, "dist/long-16x9.mp4");
      fs.writeFileSync(vPath, Buffer.alloc(2000, 1));

      const report = await qaManager.runPostRenderQA(TEST_DIR, mockInspector, {
        videoPath: "dist/long-16x9.mp4",
        expectedDuration: 10,
      });

      expect(report.passed).toBe(true);
      expect(report.summary.errors).toBe(0);
    });
  });
});
