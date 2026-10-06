import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(__dirname, "../../dist/main.js");
const TEST_DIR = resolve(tmpdir(), "faceless-cli-qa-test-" + Date.now());

function parseJsonOutput(stdout: string): any {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return JSON.parse(stdout.slice(start, end + 1));
  }
  return JSON.parse(stdout);
}

describe("CLI: studio qa", () => {
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

  it("fails when slug is missing", async () => {
    let error: any;
    try {
      await execFileAsync("node", [CLI_PATH, "qa"]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe(1);
    expect(error.stderr).toContain("Missing required argument: <slug>");
  });

  it("fails when project does not exist", async () => {
    let error: any;
    try {
      await execFileAsync("node", [
        CLI_PATH,
        "qa",
        "missing-slug",
        "--base-dir",
        TEST_DIR,
      ]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe(1);
  });

  it("runs studio qa --pre and passes when spec and assets are fully valid", async () => {
    const slug = "qa-valid-proj";
    // 1. Create project
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      slug,
      "--topic",
      "psychology",
      "--template",
      "minimal",
      "--base-dir",
      TEST_DIR,
    ]);

    const projDir = resolve(TEST_DIR, slug);

    // 2. Create assets and audio files on disk
    fs.mkdirSync(join(projDir, "assets"), { recursive: true });
    fs.mkdirSync(join(projDir, "audio"), { recursive: true });
    fs.writeFileSync(join(projDir, "assets/diagram.png"), "mock image content");
    fs.writeFileSync(join(projDir, "audio/narr.wav"), "mock audio content");

    // 3. Write manifest.json
    const manifest = {
      projectSlug: slug,
      updatedAt: new Date().toISOString(),
      assets: [
        {
          id: "asset-diagram",
          fileName: "diagram.png",
          filePath: "assets/diagram.png",
          kind: "image",
          source: "local",
          license: "CC0",
          importedAt: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(join(projDir, "assets/manifest.json"), JSON.stringify(manifest, null, 2));

    // 4. Write valid spec.json
    const spec = {
      specVersion: "0.1.0",
      projectSlug: slug,
      topicId: "psychology",
      templateId: "minimal",
      fps: 30,
      narration: {
        audioPath: "audio/narr.wav",
        durationSec: 10,
        words: [
          { id: "w1", text: "Tâm", startSec: 0, endSec: 0.5, confidence: 0.95 },
          { id: "w2", text: "lý", startSec: 0.5, endSec: 1.0, confidence: 0.92 },
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
                  assetId: "asset-diagram",
                  filePath: "assets/diagram.png",
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
    fs.writeFileSync(join(projDir, "spec.json"), JSON.stringify(spec, null, 2));

    // 5. Run studio qa --pre with --json
    const { stdout: jsonOut } = await execFileAsync("node", [
      CLI_PATH,
      "qa",
      slug,
      "--pre",
      "--base-dir",
      TEST_DIR,
      "--json",
    ]);

    const report = parseJsonOutput(jsonOut);
    expect(report.gate).toBe("pre");
    expect(report.passed).toBe(true);
    expect(report.summary.errors).toBe(0);

    // 6. Run studio qa --pre human-readable
    const { stdout: tableOut } = await execFileAsync("node", [
      CLI_PATH,
      "qa",
      slug,
      "--pre",
      "--base-dir",
      TEST_DIR,
    ]);

    expect(tableOut).toContain("PRE-RENDER");
    expect(tableOut).toContain("PASSED");
  });

  it("runs studio qa --pre and catches schema or asset errors", async () => {
    const slug = "qa-invalid-proj";
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      slug,
      "--base-dir",
      TEST_DIR,
    ]);

    const projDir = resolve(TEST_DIR, slug);

    // Write spec pointing to non-existent asset and narration
    const spec = {
      specVersion: "0.1.0",
      projectSlug: slug,
      topicId: "psychology",
      templateId: "minimal",
      fps: 30,
      narration: {
        audioPath: "audio/missing.wav",
        durationSec: 5,
        words: [
          { id: "w1", text: "Xin", startSec: 0, endSec: 0.5, confidence: 0.70 }, // < 0.8 -> warning
        ],
      },
      chapters: [
        {
          id: "c1",
          title: "Chương 1",
          beats: [
            {
              id: "b1",
              range: { startWordId: "w1", endWordId: "w1" },
              layout: "title-card",
              assets: [
                {
                  assetId: "missing-img",
                  filePath: "assets/missing.png",
                  kind: "image",
                  license: "CC0",
                },
              ],
              captions: [{ id: "cap1", wordIds: ["w1"] }],
              sfx: [],
            },
          ],
        },
      ],
      music: [],
      meta: {},
    };
    fs.writeFileSync(join(projDir, "spec.json"), JSON.stringify(spec, null, 2));

    let runError: any;
    try {
      await execFileAsync("node", [
        CLI_PATH,
        "qa",
        slug,
        "--pre",
        "--base-dir",
        TEST_DIR,
        "--json",
      ]);
    } catch (err) {
      runError = err;
    }

    expect(runError).toBeDefined();
    expect(runError.code).toBe(1);
    const report = parseJsonOutput(runError.stdout);
    expect(report.gate).toBe("pre");
    expect(report.passed).toBe(false);
    expect(report.summary.errors).toBeGreaterThan(0);
    // Has audio_confidence warning
    const confWarn = report.items.find((i: any) => i.category === "audio_confidence");
    expect(confWarn).toBeDefined();
  });

  it("runs studio qa --post and validates MP4 file integrity and audio loudness", async () => {
    const slug = "qa-post-proj";
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      slug,
      "--base-dir",
      TEST_DIR,
    ]);

    const projDir = resolve(TEST_DIR, slug);

    // Create spec with duration 3s
    const spec = {
      specVersion: "0.1.0",
      projectSlug: slug,
      topicId: "psychology",
      templateId: "minimal",
      fps: 30,
      narration: {
        audioPath: "audio/narr.wav",
        durationSec: 3,
        words: [
          { id: "w1", text: "Xin", startSec: 0, endSec: 1.5, confidence: 0.95 },
          { id: "w2", text: "chào", startSec: 1.5, endSec: 3.0, confidence: 0.95 },
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
              assets: [],
              captions: [],
              sfx: [],
            },
          ],
        },
      ],
      music: [],
      meta: {},
    };
    fs.writeFileSync(join(projDir, "spec.json"), JSON.stringify(spec, null, 2));

    // Generate valid MP4 file in dist/long-16x9.mp4 with normalized audio (~ -14 LUFS)
    fs.mkdirSync(join(projDir, "dist"), { recursive: true });
    const videoOut = join(projDir, "dist/long-16x9.mp4");

    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3:size=320x240:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=3",
      "-af",
      "loudnorm=I=-14:TP=-1:LRA=7",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      videoOut,
    ]);

    const { stdout: jsonOut } = await execFileAsync("node", [
      CLI_PATH,
      "qa",
      slug,
      "--post",
      "--base-dir",
      TEST_DIR,
      "--json",
    ]);

    const report = parseJsonOutput(jsonOut);
    expect(report.gate).toBe("post");
    expect(report.passed).toBe(true);
    expect(report.summary.errors).toBe(0);
  });
});
