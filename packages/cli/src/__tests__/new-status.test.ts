import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/main.js");
const TEST_BASE = "/tmp/faceless-cli-test-" + Date.now();

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

describe("CLI: studio new and studio status", () => {
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

  describe("studio new", () => {
    it("creates a new project with default options", async () => {
      const res = await runCli(["new", "proj-default"]);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain("Project created: proj-default");

      const projDir = resolve(TEST_BASE, "proj-default");
      expect(fs.existsSync(resolve(projDir, "project.json"))).toBe(true);
      expect(fs.existsSync(resolve(projDir, "state.json"))).toBe(true);
      expect(fs.existsSync(resolve(projDir, "events.jsonl"))).toBe(true);
      expect(fs.existsSync(resolve(projDir, "tasks"))).toBe(true);
      expect(fs.existsSync(resolve(projDir, "results"))).toBe(true);
      expect(fs.existsSync(resolve(projDir, "script"))).toBe(true);
    });

    it("creates a new project with custom flags and outputs JSON", async () => {
      const res = await runCli([
        "new",
        "proj-custom",
        "--topic",
        "science",
        "--template",
        "minimal",
        "--minutes",
        "3",
        "--formats",
        "long-16x9,short-9x16",
        "--json",
      ]);

      expect(res.exitCode).toBe(0);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.slug).toBe("proj-custom");
      expect(parsed.topicId).toBe("science");
      expect(parsed.templateId).toBe("minimal");
      expect(parsed.targetMinutes).toBe(3);
      expect(parsed.formats).toEqual(["long-16x9", "short-9x16"]);

      const projectJson = JSON.parse(
        fs.readFileSync(resolve(TEST_BASE, "proj-custom", "project.json"), "utf-8")
      );
      expect(projectJson.topicId).toBe("science");
      expect(projectJson.targetMinutes).toBe(3);
      expect(projectJson.formats).toEqual(["long-16x9", "short-9x16"]);
    });

    it("fails when project already exists", async () => {
      await runCli(["new", "proj-dup"]);
      const res = await runCli(["new", "proj-dup", "--json"]);

      expect(res.exitCode).toBe(1);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("already exists");
    });

    it("fails when slug is missing", async () => {
      const res = await runCli(["new", "--json"]);
      expect(res.exitCode).toBe(1);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Missing required argument: <slug>");
    });
  });

  describe("studio status", () => {
    it("prints human-readable status table for existing project", async () => {
      await runCli([
        "new",
        "proj-status-text",
        "--topic",
        "sample",
        "--template",
        "minimal",
        "--minutes",
        "1",
        "--formats",
        "long-16x9",
      ]);

      const res = await runCli(["status", "proj-status-text"]);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain("Project: proj-status-text");
      expect(res.stdout).toContain("outline");
      expect(res.stdout).toContain("script");
      expect(res.stdout).toContain("direct");
      expect(res.stdout).toContain("spec");
      expect(res.stdout).toContain("long-16x9");
      expect(res.stdout).toContain("pending");
    });

    it("outputs valid JSON status with --json flag", async () => {
      await runCli([
        "new",
        "proj-status-json",
        "--topic",
        "sample",
        "--template",
        "minimal",
        "--minutes",
        "2",
        "--formats",
        "long-16x9,short-9x16",
      ]);

      const res = await runCli(["status", "proj-status-json", "--json"]);
      expect(res.exitCode).toBe(0);
      const state = JSON.parse(res.stdout);
      expect(state.projectSlug).toBe("proj-status-json");
      expect(Array.isArray(state.stages)).toBe(true);
      expect(state.stages).toHaveLength(6); // outline, script, direct, spec, long-16x9, short-9x16
      expect(state.stages[0].stage).toBe("outline");
      expect(state.stages[0].status).toBe("pending");
      expect(state.updatedAt).toBeDefined();
    });

    it("fails when project does not exist", async () => {
      const res = await runCli(["status", "nonexistent-project", "--json"]);
      expect(res.exitCode).toBe(1);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.error).toBeDefined();
    });

    it("fails when slug is missing", async () => {
      const res = await runCli(["status", "--json"]);
      expect(res.exitCode).toBe(1);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.error).toContain("Missing required argument: <slug>");
    });
  });
});
