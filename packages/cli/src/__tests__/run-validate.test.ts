import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/main.js");
const TEST_BASE = "/tmp/faceless-cli-test-rv-" + Date.now();

interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCli(args: string[]): Promise<CliRunResult> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args, "--base-dir", TEST_BASE]);
    return { stdout, stderr, exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: err.code || 1,
    };
  }
}

describe("CLI: studio run and studio validate", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_BASE)) {
      fs.rmSync(TEST_BASE, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_BASE, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_BASE)) {
      fs.rmSync(TEST_BASE, { recursive: true, force: true });
    }
  });

  it("full workflow: new -> run outline -> mock result -> validate passes", async () => {
    const slug = "test-flow-01";

    // 1. studio new
    const newRes = await runCli(["new", slug, "--topic", "sample", "--template", "minimal", "--minutes", "1", "--formats", "long-16x9"]);
    expect(newRes.exitCode).toBe(0);

    // 2. studio run outline
    const runRes = await runCli(["run", slug, "outline"]);
    expect(runRes.exitCode).toBe(0);
    expect(runRes.stdout).toContain("Task generated");
    expect(runRes.stdout).toContain("Stage 'outline' is now running");
    expect(runRes.stdout).toContain("Task generated. Agent must fulfill results/... then run studio validate.");

    // Verify task markdown file was created
    const taskPath = resolve(TEST_BASE, slug, "tasks", "001-outline.md");
    expect(fs.existsSync(taskPath)).toBe(true);
    const taskContent = fs.readFileSync(taskPath, "utf-8");
    expect(taskContent).toContain("stage: outline");
    expect(taskContent).toContain("skill: faceless-director");

    // Verify state is running
    const stateMid = JSON.parse(fs.readFileSync(resolve(TEST_BASE, slug, "state.json"), "utf-8"));
    const outlineStage = stateMid.stages.find((s: any) => s.stage === "outline");
    expect(outlineStage.status).toBe("running");

    // 3. Mock agent fulfilling the result: results/001-outline.json
    const resultsDir = resolve(TEST_BASE, slug, "results");
    fs.mkdirSync(resultsDir, { recursive: true });
    const validResult = {
      title: "Video Outline: Khám phá công nghệ",
      points: ["Giới thiệu", "Nội dung chính", "Tóm tắt"],
    };
    fs.writeFileSync(resolve(resultsDir, "001-outline.json"), JSON.stringify(validResult), "utf-8");

    // 4. studio validate
    const valRes = await runCli(["validate", slug]);
    expect(valRes.exitCode).toBe(0);
    expect(valRes.stdout).toContain("[PASSED] Task 001 (stage: outline)");
    expect(valRes.stdout).toContain("All validated tasks PASSED");

    // 5. Verify state is updated to done
    const stateFinal = JSON.parse(fs.readFileSync(resolve(TEST_BASE, slug, "state.json"), "utf-8"));
    const outlineFinal = stateFinal.stages.find((s: any) => s.stage === "outline");
    expect(outlineFinal.status).toBe("done");
  });

  it("studio run automatically picks first pending stage if not specified", async () => {
    const slug = "test-auto-stage";
    await runCli(["new", slug]);

    const runRes = await runCli(["run", slug, "--json"]);
    expect(runRes.exitCode).toBe(0);
    const parsed = JSON.parse(runRes.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.stage).toBe("outline");
    expect(parsed.status).toBe("running");
  });

  it("studio validate fails and creates errors.md when result is invalid", async () => {
    const slug = "test-val-fail";
    await runCli(["new", slug]);
    await runCli(["run", slug, "outline"]);

    // Write invalid result (title must be string, provide number)
    const resultsDir = resolve(TEST_BASE, slug, "results");
    fs.mkdirSync(resultsDir, { recursive: true });
    const invalidResult = {
      title: 12345, // invalid
      points: "not-an-array", // invalid
    };
    fs.writeFileSync(resolve(resultsDir, "001-outline.json"), JSON.stringify(invalidResult), "utf-8");

    const valRes = await runCli(["validate", slug, "--json"]);
    expect(valRes.exitCode).toBe(1);
    const parsed = JSON.parse(valRes.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.results[0].status).toBe("FAILED");

    // Verify error file was created
    const errPath = resolve(resultsDir, "001-errors.md");
    expect(fs.existsSync(errPath)).toBe(true);

    // Stage should not be done
    const state = JSON.parse(fs.readFileSync(resolve(TEST_BASE, slug, "state.json"), "utf-8"));
    const outline = state.stages.find((s: any) => s.stage === "outline");
    expect(outline.status).toBe("running");
  });

  it("studio run tts generates mock audio and completes deterministic stage", async () => {
    const slug = "test-tts-deterministic";
    await runCli(["new", slug]);

    const runRes = await runCli(["run", slug, "tts", "--json"]);
    expect(runRes.exitCode).toBe(0);
    const parsed = JSON.parse(runRes.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.stage).toBe("tts");
    expect(parsed.status).toBe("done");

    const narrationPath = resolve(TEST_BASE, slug, "audio", "narration.wav");
    expect(fs.existsSync(narrationPath)).toBe(true);
  });

  it("studio run align generates mock word alignment", async () => {
    const slug = "test-align-deterministic";
    await runCli(["new", slug]);

    const runRes = await runCli(["run", slug, "align", "--json"]);
    expect(runRes.exitCode).toBe(0);
    const parsed = JSON.parse(runRes.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.stage).toBe("align");
    expect(parsed.status).toBe("done");

    const wordsPath = resolve(TEST_BASE, slug, "audio", "words.json");
    expect(fs.existsSync(wordsPath)).toBe(true);
    const words = JSON.parse(fs.readFileSync(wordsPath, "utf-8"));
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBeGreaterThan(0);
    expect(words[0]).toHaveProperty("id");
    expect(words[0]).toHaveProperty("text");
    expect(words[0]).toHaveProperty("startSec");
  });

  it("studio validate fails when result file is missing", async () => {
    const slug = "test-missing-res";
    await runCli(["new", slug]);
    await runCli(["run", slug, "outline"]);

    // Do NOT write result file
    const valRes = await runCli(["validate", slug, "--json"]);
    expect(valRes.exitCode).toBe(1);
    const parsed = JSON.parse(valRes.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.results[0].status).toBe("FAILED");
    expect(parsed.results[0].error).toContain("Result file not found");
  });
});
