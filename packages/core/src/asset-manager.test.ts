import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import * as fs from "node:fs";
import { AssetManager } from "./asset-manager.js";

const TEST_DIR = resolve(tmpdir(), "faceless-asset-test-" + Date.now());

describe("AssetManager", () => {
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

  it("initializes project asset directories and empty manifest", () => {
    const am = new AssetManager(TEST_DIR);
    const { assetDir, manifestPath, requestsDir, incomingDir, processedDir } =
      am.initAssetDirs("test-slug");

    expect(fs.existsSync(assetDir)).toBe(true);
    expect(fs.existsSync(requestsDir)).toBe(true);
    expect(fs.existsSync(incomingDir)).toBe(true);
    expect(fs.existsSync(processedDir)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = am.loadManifest("test-slug");
    expect(manifest.projectSlug).toBe("test-slug");
    expect(manifest.assets).toEqual([]);
  });

  it("exports prompt-pack.md for project", () => {
    const am = new AssetManager(TEST_DIR);
    const { path, count } = am.exportPromptPack("test-slug");

    expect(fs.existsSync(path)).toBe(true);
    expect(count).toBeGreaterThan(0);
    const content = fs.readFileSync(path, "utf-8");
    expect(content).toContain("# Prompt Pack — Dự án: test-slug");
    expect(content).toContain("Target File Name");
    expect(content).toContain("--ar 16:9");
  });

  it("imports valid images from incoming directory to processed and updates manifest", () => {
    const am = new AssetManager(TEST_DIR);
    const { incomingDir, processedDir } = am.initAssetDirs("test-slug");

    // Put mock image file in incoming
    const mockImagePath = resolve(incomingDir, "b1.png");
    fs.writeFileSync(mockImagePath, "fake-png-content-data-123456", "utf-8");

    const result = am.importAssets("test-slug");
    expect(result.count).toBe(1);
    expect(result.imported[0].id).toBe("b1");
    expect(result.imported[0].fileName).toBe("b1.png");
    expect(result.imported[0].filePath).toBe("assets/processed/b1.png");
    expect(result.imported[0].license).toBe("CC0");
    expect(result.imported[0].sha256).toBeDefined();

    // Destination file exists
    const destFile = resolve(processedDir, "b1.png");
    expect(fs.existsSync(destFile)).toBe(true);

    // Source file moved
    expect(fs.existsSync(mockImagePath)).toBe(false);

    // Manifest reloaded has the asset
    const manifest = am.loadManifest("test-slug");
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0].id).toBe("b1");
  });
});
