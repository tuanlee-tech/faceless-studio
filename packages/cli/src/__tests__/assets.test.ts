import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);
const CLI_PATH = resolve(__dirname, "../../dist/main.js");
const TEST_DIR = resolve(tmpdir(), "faceless-cli-assets-test-" + Date.now());

function parseJsonOutput(stdout: string): any {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return JSON.parse(stdout.slice(start, end + 1));
  }
  return JSON.parse(stdout);
}

describe("CLI: studio assets", () => {
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
      await execFileAsync("node", [CLI_PATH, "assets"]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe(1);
    expect(error.stderr).toContain("Project slug is required");
  });

  it("fails when project does not exist", async () => {
    let error: any;
    try {
      await execFileAsync("node", [
        CLI_PATH,
        "assets",
        "non-existent-proj",
        "export",
        "--base-dir",
        TEST_DIR,
      ]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe(1);
    expect(error.stderr).toContain("Project 'non-existent-proj' not found");
  });

  it("fails when action is invalid", async () => {
    // Create project first
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      "p-test",
      "--base-dir",
      TEST_DIR,
    ]);

    let error: any;
    try {
      await execFileAsync("node", [
        CLI_PATH,
        "assets",
        "p-test",
        "invalid-action",
        "--base-dir",
        TEST_DIR,
      ]);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe(1);
    expect(error.stderr).toContain("Action must be either 'export' or 'import'");
  });

  it("exports prompt pack and logs event", async () => {
    // Create project
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      "p-export",
      "--base-dir",
      TEST_DIR,
    ]);

    // Export assets prompt pack
    const res = await execFileAsync("node", [
      CLI_PATH,
      "assets",
      "p-export",
      "export",
      "--base-dir",
      TEST_DIR,
      "--json",
    ]);

    const data = parseJsonOutput(res.stdout);
    expect(data.success).toBe(true);
    expect(data.action).toBe("export");
    expect(data.slug).toBe("p-export");
    expect(data.count).toBeGreaterThan(0);
    expect(fs.existsSync(data.path)).toBe(true);

    // Verify events.jsonl
    const eventsPath = resolve(TEST_DIR, "p-export", "events.jsonl");
    expect(fs.existsSync(eventsPath)).toBe(true);
    const events = fs.readFileSync(eventsPath, "utf-8");
    expect(events).toContain("assets_exported");
  });

  it("imports incoming assets, updates manifest, and logs event", async () => {
    // Create project
    await execFileAsync("node", [
      CLI_PATH,
      "new",
      "p-import",
      "--base-dir",
      TEST_DIR,
    ]);

    // Put a mock image into assets/incoming/
    const incomingDir = resolve(TEST_DIR, "p-import", "assets", "incoming");
    fs.mkdirSync(incomingDir, { recursive: true });
    const mockImage = resolve(incomingDir, "b1.png");
    fs.writeFileSync(mockImage, "dummy-image-binary-data");

    // Run studio assets import
    const res = await execFileAsync("node", [
      CLI_PATH,
      "assets",
      "p-import",
      "import",
      "--base-dir",
      TEST_DIR,
      "--json",
    ]);

    const data = parseJsonOutput(res.stdout);
    expect(data.success).toBe(true);
    expect(data.action).toBe("import");
    expect(data.count).toBe(1);
    expect(data.imported[0].id).toBe("b1");
    expect(data.imported[0].license).toBe("CC0");

    // Verify file moved to processed
    const processedFile = resolve(TEST_DIR, "p-import", "assets", "processed", "b1.png");
    expect(fs.existsSync(processedFile)).toBe(true);
    expect(fs.existsSync(mockImage)).toBe(false);

    // Verify manifest.json
    const manifestPath = resolve(TEST_DIR, "p-import", "assets", "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0].id).toBe("b1");

    // Verify events.jsonl
    const eventsPath = resolve(TEST_DIR, "p-import", "events.jsonl");
    const events = fs.readFileSync(eventsPath, "utf-8");
    expect(events).toContain("assets_imported");
  });
});
