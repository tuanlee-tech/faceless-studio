import { describe, it, expect } from "vitest";
import { checkBinary } from "../utils/check-binary.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(fileURLToPath(import.meta.url), "../../../dist/main.js");

async function runCli(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("node", [CLI_PATH, ...args]);
    return stdout;
  } catch (err: any) {
    if (err.stdout) return err.stdout;
    throw err;
  }
}

describe("checkBinary", () => {
  it("finds node", async () => {
    const result = await checkBinary("node", ["--version"], /v(\d+\.\d+\.\d+)/, {
      windows: "install node",
      ubuntu: "install node",
    });
    expect(result.found).toBe(true);
    expect(result.version).toMatch(/\d+\.\d+\.\d+/);
  });

  it("reports missing for fake binary", async () => {
    const result = await checkBinary("nonexistent-binary-xyz", ["--version"], /(.*)/, {
      windows: "n/a",
      ubuntu: "n/a",
    });
    expect(result.found).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("each check result has fix.windows and fix.ubuntu", async () => {
    const result = await checkBinary("node", ["--version"], /v(\d+\.\d+\.\d+)/, {
      windows: "install node",
      ubuntu: "install node",
    });
    expect(result.fix).toBeDefined();
    expect(result.fix?.windows).toBeTypeOf("string");
    expect(result.fix?.ubuntu).toBeTypeOf("string");
  });
});

describe("runDoctor (via CLI)", () => {
  it("returns valid JSON structure with checks array and allPassed boolean", async () => {
    const stdout = await runCli(["doctor", "--json"]);

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("checks");
    expect(Array.isArray(parsed.checks)).toBe(true);
    expect(parsed).toHaveProperty("allPassed");
    expect(typeof parsed.allPassed).toBe("boolean");

    // Each check should have required fields
    for (const check of parsed.checks) {
      expect(check).toHaveProperty("name");
      expect(check).toHaveProperty("found");
      expect(check).toHaveProperty("fix");
      expect(check.fix).toHaveProperty("windows");
      expect(check.fix).toHaveProperty("ubuntu");
    }
  });

  it("console output contains check icons", async () => {
    const stdout = await runCli(["doctor"]);

    // Should contain check marks (✅ or ❌)
    expect(stdout).toMatch(/✅|❌/);
    // Should contain all 6 tool names
    expect(stdout).toContain("node");
    expect(stdout).toContain("pnpm");
    expect(stdout).toContain("python");
    expect(stdout).toContain("uv");
    expect(stdout).toContain("ffmpeg");
    expect(stdout).toContain("ffprobe");
  });
});