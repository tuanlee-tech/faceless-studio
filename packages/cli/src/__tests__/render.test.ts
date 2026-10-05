import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/main.js");
const TEST_BASE = "/tmp/faceless-cli-test-render-" + Date.now();

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

function parseJson(str: string): any {
  const jsonStart = str.indexOf("{");
  const jsonEnd = str.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    return JSON.parse(str.slice(jsonStart, jsonEnd + 1));
  }
  return JSON.parse(str);
}

describe("CLI: studio render", () => {
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

  it("fails when slug is missing", async () => {
    const res = await runCli(["render", "--json"]);
    expect(res.exitCode).toBe(1);
    const parsed = parseJson(res.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Missing required argument: <slug>");
  });

  it("fails when project does not exist", async () => {
    const res = await runCli(["render", "nonexistent-project", "--json"]);
    expect(res.exitCode).toBe(1);
    const parsed = parseJson(res.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
  });

  it("renders long-16x9 video and creates valid mp4 output", async () => {
    const slug = "test-render-16x9";
    // 1. Create project
    await runCli(["new", slug, "--formats", "long-16x9"]);

    // 2. Run studio render
    const res = await runCli(["render", slug, "--format", "long-16x9", "--json"]);
    expect(res.exitCode).toBe(0);

    const parsed = parseJson(res.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.slug).toBe(slug);
    expect(parsed.format).toBe("long-16x9");
    expect(parsed.outPath).toBeDefined();

    // Verify output file exists and is not empty
    expect(fs.existsSync(parsed.outPath)).toBe(true);
    const stat = fs.statSync(parsed.outPath);
    expect(stat.size).toBeGreaterThan(0);

    // Verify state is updated to done
    const state = JSON.parse(fs.readFileSync(resolve(TEST_BASE, slug, "state.json"), "utf-8"));
    const stage = state.stages.find((s: any) => s.stage === "long-16x9");
    expect(stage.status).toBe("done");

    // Verify event is recorded in events.jsonl
    const eventsContent = fs.readFileSync(resolve(TEST_BASE, slug, "events.jsonl"), "utf-8");
    expect(eventsContent).toContain("render_completed");
  }, 120000);
});
