import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/main.js");
const TEST_BASE = "/tmp/faceless-cli-delete-test-" + Date.now();

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

describe("CLI: studio delete", () => {
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
    const res = await runCli(["delete"]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain("Missing required argument: <slug>");
  });

  it("fails with JSON output when slug is missing and --json is provided", async () => {
    const res = await runCli(["delete", "--json"]);
    expect(res.exitCode).toBe(1);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Missing required argument: <slug>");
  });

  it("fails when project does not exist", async () => {
    const res = await runCli(["delete", "non-existent-proj"]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain("not found");
  });

  it("deletes existing project cleanly", async () => {
    // 1. Create a project first
    const createRes = await runCli(["new", "proj-to-delete"]);
    expect(createRes.exitCode).toBe(0);
    const projDir = resolve(TEST_BASE, "proj-to-delete");
    expect(fs.existsSync(projDir)).toBe(true);

    // 2. Delete it
    const delRes = await runCli(["delete", "proj-to-delete"]);
    expect(delRes.exitCode).toBe(0);
    expect(delRes.stdout).toContain('Project "proj-to-delete" deleted successfully');
    expect(fs.existsSync(projDir)).toBe(false);
  });

  it("deletes existing project and outputs JSON when --json flag is used", async () => {
    // 1. Create project
    await runCli(["new", "proj-to-delete-json"]);
    const projDir = resolve(TEST_BASE, "proj-to-delete-json");
    expect(fs.existsSync(projDir)).toBe(true);

    // 2. Delete with --json
    const delRes = await runCli(["delete", "proj-to-delete-json", "--json"]);
    expect(delRes.exitCode).toBe(0);
    const parsed = JSON.parse(delRes.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.slug).toBe("proj-to-delete-json");
    expect(fs.existsSync(projDir)).toBe(false);
  });
});
