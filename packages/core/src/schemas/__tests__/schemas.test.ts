import { describe, it, expect } from "vitest";
import { VideoSpecSchema, SPEC_VERSION } from "../video-spec.js";
import { ProjectConfigSchema } from "../project-config.js";
import { ProjectStateSchema } from "../stage-state.js";
import { TemplateConfigSchema } from "../template-config.js";
import { AssetManifestSchema } from "../asset-manifest.js";
import { LibrarySchema } from "../library.js";

describe("VideoSpecSchema", () => {
  const validSpec = {
    specVersion: SPEC_VERSION,
    projectSlug: "test-01",
    topicId: "sample",
    templateId: "minimal",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 60,
      words: [
        { id: "w001", text: "Xin", startSec: 0, endSec: 0.3, confidence: 0.95 },
        { id: "w002", text: "chào", startSec: 0.3, endSec: 0.6, confidence: 0.92 },
      ],
    },
    chapters: [
      {
        id: "c1",
        title: "Mở đầu",
        beats: [
          {
            id: "b1",
            range: { startWordId: "w001", endWordId: "w002" },
            layout: "center-text",
            captions: [{ id: "cap1", wordIds: ["w001", "w002"] }],
          },
        ],
      },
    ],
  };

  it("parses a valid spec", () => {
    const result = VideoSpecSchema.parse(validSpec);
    expect(result.specVersion).toBe(SPEC_VERSION);
    expect(result.chapters).toHaveLength(1);
  });

  it("roundtrip: parse → serialize → parse", () => {
    const first = VideoSpecSchema.parse(validSpec);
    const json = JSON.stringify(first);
    const second = VideoSpecSchema.parse(JSON.parse(json));
    expect(second).toEqual(first);
  });

  it("rejects missing chapters", () => {
    const bad = { ...validSpec, chapters: [] };
    expect(() => VideoSpecSchema.parse(bad)).toThrow();
  });

  it("rejects missing narration.words", () => {
    const bad = { ...validSpec, narration: { ...validSpec.narration, words: undefined } };
    expect(() => VideoSpecSchema.parse(bad)).toThrow();
  });
});

describe("ProjectConfigSchema", () => {
  const validConfig = {
    slug: "test-01",
    topicId: "sample",
    templateId: "minimal",
    targetMinutes: 5,
    formats: ["long-16x9"],
    createdAt: "2026-10-05T00:00:00Z",
  };

  it("parses valid config with defaults", () => {
    const result = ProjectConfigSchema.parse(validConfig);
    expect(result.assetBudget).toBe(50);
    expect(result.qaThreshold).toBe(70);
    expect(result.voice).toBe("default");
  });

  it("rejects invalid slug", () => {
    expect(() =>
      ProjectConfigSchema.parse({ ...validConfig, slug: "Test 01" }),
    ).toThrow();
  });
});

describe("ProjectStateSchema", () => {
  it("parses valid state", () => {
    const state = {
      projectSlug: "test-01",
      stages: [
        { stage: "outline", status: "done", inputHash: "abc123", completedAt: "2026-10-05T00:00:00Z" },
        { stage: "script", status: "pending" },
      ],
      updatedAt: "2026-10-05T00:00:00Z",
    };
    const result = ProjectStateSchema.parse(state);
    expect(result.stages).toHaveLength(2);
  });
});

describe("TemplateConfigSchema", () => {
  const validTemplate = {
    id: "baroque-mono",
    name: "Baroque Monochrome",
    colors: {
      background: "#0a0a0c",
      text: "#f3f3f3",
      primary: "#c5a059",
      highlight: "#e5c07b",
    },
    fonts: [
      {
        family: "Playfair Display",
        file: "fonts/PlayfairDisplay-Regular.ttf",
      },
    ],
    subtitles: {
      fontSize: 52,
      color: "#f3f3f3",
      highlightColor: "#e5c07b",
    },
  };

  it("parses valid template config with defaults", () => {
    const result = TemplateConfigSchema.parse(validTemplate);
    expect(result.id).toBe("baroque-mono");
    expect(result.version).toBe("1.0.0");
    expect(result.layoutPresets).toContain("center-text");
    expect(result.subtitles.bottomOffset).toBe(80);
  });

  it("roundtrip: parse -> stringify -> parse", () => {
    const first = TemplateConfigSchema.parse(validTemplate);
    const json = JSON.stringify(first);
    const second = TemplateConfigSchema.parse(JSON.parse(json));
    expect(second).toEqual(first);
  });

  it("rejects invalid template missing colors", () => {
    const bad = { id: "bad", name: "Bad" };
    expect(() => TemplateConfigSchema.parse(bad)).toThrow();
  });
});

describe("AssetManifestSchema", () => {
  it("parses valid manifest with defaults", () => {
    const manifest = {
      projectSlug: "p1",
      updatedAt: "2026-10-05T00:00:00Z",
      assets: [
        {
          id: "a1",
          fileName: "a1.png",
          filePath: "assets/processed/a1.png",
          license: "CC0",
          importedAt: "2026-10-05T00:00:00Z",
        },
      ],
    };
    const parsed = AssetManifestSchema.parse(manifest);
    expect(parsed.assets[0].kind).toBe("image");
    expect(parsed.assets[0].license).toBe("CC0");
  });
});

describe("LibrarySchema", () => {
  it("parses valid library.json", () => {
    const lib = {
      music: [],
      sfx: [],
      fonts: [
        {
          id: "f1",
          name: "Font 1",
          type: "font",
          path: "fonts/f1.ttf",
          license: "OFL-1.1",
        },
      ],
    };
    const parsed = LibrarySchema.parse(lib);
    expect(parsed.fonts).toHaveLength(1);
    expect(parsed.fonts[0].license).toBe("OFL-1.1");
  });
});