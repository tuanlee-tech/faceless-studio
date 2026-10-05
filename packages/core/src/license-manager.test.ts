import { describe, it, expect } from "vitest";
import { LicenseManager, isValidLicenseFormat } from "./license-manager.js";
import { SPEC_VERSION, type VideoSpec } from "./schemas/video-spec.js";
import type { AssetManifest } from "./schemas/asset-manifest.js";
import type { Library } from "./schemas/library.js";

describe("LicenseManager", () => {
  const lm = new LicenseManager();

  it("validates open source and recognized licenses", () => {
    expect(isValidLicenseFormat("CC0")).toBe(true);
    expect(isValidLicenseFormat("CC-BY-4.0")).toBe(true);
    expect(isValidLicenseFormat("OFL-1.1")).toBe(true);
    expect(isValidLicenseFormat("MIT")).toBe(true);
    expect(isValidLicenseFormat("custom-internal")).toBe(true);

    expect(isValidLicenseFormat("")).toBe(false);
    expect(isValidLicenseFormat("unknown-unlicensed")).toBe(false);
  });

  const validSpec: VideoSpec = {
    specVersion: SPEC_VERSION,
    projectSlug: "license-test",
    topicId: "sample",
    templateId: "minimal",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 5,
      words: [{ id: "w1", text: "Test", startSec: 0, endSec: 1, confidence: 1 }],
    },
    chapters: [
      {
        id: "c1",
        title: "Chapter 1",
        beats: [
          {
            id: "b1",
            range: { startWordId: "w1", endWordId: "w1" },
            layout: "center-text",
            assets: [
              {
                assetId: "a1",
                filePath: "assets/processed/a1.png",
                kind: "image",
                license: "CC0",
              },
            ],
            captions: [],
            sfx: [{ id: "s1", anchorWordId: "w1", offsetSec: 0, sfxId: "whoosh", volume: 0.8 }],
          },
        ],
      },
    ],
    music: [{ id: "m1", libraryId: "ambient_track", startSec: 0, volume: 0.3 }],
    meta: {},
  };

  const sampleLibrary: Library = {
    music: [
      {
        id: "ambient_track",
        name: "Ambient",
        type: "music",
        path: "library/music/ambient.mp3",
        license: "CC-BY-4.0",
      },
    ],
    sfx: [
      {
        id: "whoosh",
        name: "Whoosh",
        type: "sfx",
        path: "library/sfx/whoosh.wav",
        license: "CC0",
      },
    ],
    fonts: [],
  };

  const sampleManifest: AssetManifest = {
    projectSlug: "license-test",
    updatedAt: new Date().toISOString(),
    assets: [
      {
        id: "a1",
        kind: "image",
        fileName: "a1.png",
        filePath: "assets/processed/a1.png",
        license: "CC0",
        source: "user-import",
        importedAt: new Date().toISOString(),
      },
    ],
  };

  it("passes validation when all assets and tracks have valid registered licenses", () => {
    const result = lm.validateSpecLicenses(validSpec, sampleManifest, sampleLibrary);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("detects missing or unregistered asset in manifest", () => {
    const emptyManifest: AssetManifest = {
      projectSlug: "license-test",
      updatedAt: new Date().toISOString(),
      assets: [],
    };
    const result = lm.validateSpecLicenses(validSpec, emptyManifest, sampleLibrary);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("not registered"))).toBe(true);
  });

  it("detects missing music track in library", () => {
    const emptyLib: Library = { music: [], sfx: sampleLibrary.sfx, fonts: [] };
    const result = lm.validateSpecLicenses(validSpec, sampleManifest, emptyLib);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("not found in global library"))).toBe(true);
  });
});
