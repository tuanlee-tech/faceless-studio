import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(__dirname, "../../dist/main.js");
const TEST_DIR = resolve(tmpdir(), "faceless-cli-shorts-test-" + Date.now());

function parseJsonOutput(stdout: string): any {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return JSON.parse(stdout.slice(start, end + 1));
  }
  return JSON.parse(stdout);
}

describe("CLI: studio shorts and studio render --spec", () => {
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
      await execFileAsync("node", [CLI_PATH, "shorts"]);
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
        "shorts",
        "missing-slug",
        "--base-dir",
        TEST_DIR,
      ]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe(1);
    expect(error.stderr).toContain("Project 'missing-slug' not found");
  });

  it("generates task and extracts spec-short-*.json automatically", async () => {
    // 1. Create project
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      "p-short-auto",
      "--base-dir",
      TEST_DIR,
    ]);

    // 2. Put a valid spec.json with narration words
    const specPath = resolve(TEST_DIR, "p-short-auto", "spec.json");
    const testSpec = {
      specVersion: "0.1.0",
      projectSlug: "p-short-auto",
      topicId: "sample",
      templateId: "clean-split",
      fps: 30,
      narration: {
        audioPath: "audio/narration.wav",
        durationSec: 15,
        words: [
          { id: "w1", text: "Xin", startSec: 0, endSec: 1, confidence: 1 },
          { id: "w2", text: "chào", startSec: 1, endSec: 2, confidence: 1 },
          { id: "w3", text: "các", startSec: 2, endSec: 3, confidence: 1 },
          { id: "w4", text: "bạn", startSec: 3, endSec: 4, confidence: 1 },
        ],
      },
      chapters: [
        {
          id: "c1",
          title: "Chương 1",
          beats: [
            {
              id: "b1",
              range: { startWordId: "w1", endWordId: "w4" },
              layout: "center-text",
              captions: [{ id: "cap1", wordIds: ["w1", "w2", "w3", "w4"] }],
            },
          ],
        },
      ],
      meta: { title: "Video Kịch Bản Dài" },
    };
    fs.writeFileSync(specPath, JSON.stringify(testSpec, null, 2), "utf-8");

    // 3. Run studio shorts
    const res = await execFileAsync("node", [
      CLI_PATH,
      "shorts",
      "p-short-auto",
      "--base-dir",
      TEST_DIR,
      "--json",
    ]);

    const data = parseJsonOutput(res.stdout);
    expect(data.success).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(data.files).toContain("spec-short-1.json");

    // Verify task file created
    const taskFile = resolve(TEST_DIR, "p-short-auto", "tasks", "p-short-auto-shorts.md");
    expect(fs.existsSync(taskFile)).toBe(true);

    // Verify spec-short-1.json created
    const shortSpecPath = resolve(TEST_DIR, "p-short-auto", "spec-short-1.json");
    expect(fs.existsSync(shortSpecPath)).toBe(true);
    const shortSpec = JSON.parse(fs.readFileSync(shortSpecPath, "utf-8"));
    expect(shortSpec.meta.isShort).toBe(true);
    expect(shortSpec.narration.words).toHaveLength(4);
    expect(shortSpec.narration.words[0].startSec).toBe(0);

    // Verify event in events.jsonl
    const eventsPath = resolve(TEST_DIR, "p-short-auto", "events.jsonl");
    const events = fs.readFileSync(eventsPath, "utf-8");
    expect(events).toContain("shorts_generated");
  });

  it("renders 9:16 short video using studio render --spec spec-short-1.json", async () => {
    // 1. Create project
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      "p-short-render",
      "--base-dir",
      TEST_DIR,
    ]);

    // 2. Put spec.json
    const specPath = resolve(TEST_DIR, "p-short-render", "spec.json");
    const testSpec = {
      specVersion: "0.1.0",
      projectSlug: "p-short-render",
      topicId: "sample",
      templateId: "minimal",
      fps: 30,
      narration: {
        audioPath: "audio/narration.wav",
        durationSec: 1, // 1 second
        words: [
          { id: "w1", text: "Short", startSec: 0, endSec: 0.5, confidence: 1 },
          { id: "w2", text: "Video", startSec: 0.5, endSec: 1.0, confidence: 1 },
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
              layout: "center-text",
              captions: [{ id: "cap1", wordIds: ["w1", "w2"] }],
            },
          ],
        },
      ],
      meta: { title: "Short Test" },
    };
    fs.writeFileSync(specPath, JSON.stringify(testSpec, null, 2), "utf-8");

    // 3. Generate shorts
    await execFileAsync("node", [
      CLI_PATH,
      "shorts",
      "p-short-render",
      "--base-dir",
      TEST_DIR,
    ]);

    // 4. Render using --spec spec-short-1.json
    const renderRes = await execFileAsync("node", [
      CLI_PATH,
      "render",
      "p-short-render",
      "--spec",
      "spec-short-1.json",
      "--base-dir",
      TEST_DIR,
      "--json",
    ]);

    const renderData = parseJsonOutput(renderRes.stdout);
    expect(renderData.success).toBe(true);
    expect(renderData.format).toBe("short-9x16");
    expect(renderData.status).toBe("done");

    // Output file exists and is non-empty
    expect(fs.existsSync(renderData.outPath)).toBe(true);
    const stat = fs.statSync(renderData.outPath);
    expect(stat.size).toBeGreaterThan(0);
  }, 90000);
});
