import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { VideoSpecSchema, type VideoSpec } from "./schemas/video-spec.js";
import { AssetManifestSchema } from "./schemas/asset-manifest.js";
import { LibrarySchema } from "./schemas/library.js";

export type QASeverity = "error" | "warning";

export type QACategory =
  | "schema"
  | "asset"
  | "license"
  | "audio_confidence"
  | "file_integrity"
  | "duration"
  | "loudness";

export interface QAItem {
  id: string;
  category: QACategory;
  severity: QASeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface QAReport {
  projectSlug: string;
  gate: "pre" | "post";
  passed: boolean;
  timestamp: string;
  summary: {
    total: number;
    errors: number;
    warnings: number;
  };
  items: QAItem[];
}

export interface QAMediaInspector {
  probeDuration(filePath: string): Promise<number>;
  measureLoudness(filePath: string): Promise<{ input_i: number; input_tp: number }>;
}

export interface PreRenderQAOptions {
  specFileName?: string;
  confidenceThreshold?: number; // default: 0.8
  libraryDir?: string;
}

export interface PostRenderQAOptions {
  videoPath?: string;
  specFileName?: string;
  expectedDuration?: number;
  durationToleranceSec?: number; // default: 2.0
  loudnessTargetLUFS?: number;   // default: -14.0
  loudnessToleranceLUFS?: number; // default: 2.0
}

/**
 * QAManager implements QA Gates before (pre) and after (post) rendering.
 * Provides schema validation, asset & license verification, word confidence checks,
 * file integrity inspection, duration verification, and audio loudness compliance.
 */
export class QAManager {
  private baseDir: string;

  constructor(baseDir = "projects") {
    this.baseDir = baseDir;
  }

  private getProjectDir(slugOrPath: string): string {
    if (existsSync(slugOrPath) && statSync(slugOrPath).isDirectory()) {
      return slugOrPath;
    }
    return resolve(this.baseDir, slugOrPath);
  }

  /**
   * Pre-Render QA Gate:
   * 1. Schema Validation (spec.json)
   * 2. Asset & License Check (files on disk, manifest & library ledger)
   * 3. Audio Confidence Check (words confidence >= 0.8)
   */
  async runPreRenderQA(projectSlugOrDir: string, options: PreRenderQAOptions = {}): Promise<QAReport> {
    const projectDir = this.getProjectDir(projectSlugOrDir);
    const slug = projectDir.split(/[/\\]/).pop() || projectSlugOrDir;
    const items: QAItem[] = [];

    const specFileName = options.specFileName || "spec.json";
    const specPath = resolve(projectDir, specFileName);

    // 1. Check spec file existence
    if (!existsSync(specPath)) {
      items.push({
        id: "spec-exists",
        category: "schema",
        severity: "error",
        message: `Spec file not found at: ${specPath}`,
      });

      return {
        projectSlug: slug,
        gate: "pre",
        passed: false,
        timestamp: new Date().toISOString(),
        summary: { total: 1, errors: 1, warnings: 0 },
        items,
      };
    }

    // 2. Schema Validation
    let spec: VideoSpec;
    try {
      const raw = JSON.parse(readFileSync(specPath, "utf-8"));
      const parsed = VideoSpecSchema.safeParse(raw);
      if (!parsed.success) {
        items.push({
          id: "schema-valid",
          category: "schema",
          severity: "error",
          message: `VideoSpec validation failed: ${parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`,
          details: { issues: parsed.error.errors },
        });

        return {
          projectSlug: slug,
          gate: "pre",
          passed: false,
          timestamp: new Date().toISOString(),
          summary: { total: 1, errors: 1, warnings: 0 },
          items,
        };
      }
      spec = parsed.data;
    } catch (err: any) {
      items.push({
        id: "schema-json",
        category: "schema",
        severity: "error",
        message: `Failed to parse spec JSON: ${err.message}`,
      });

      return {
        projectSlug: slug,
        gate: "pre",
        passed: false,
        timestamp: new Date().toISOString(),
        summary: { total: 1, errors: 1, warnings: 0 },
        items,
      };
    }

    // 3. Asset & License Check
    // Load manifest
    const manifestPath = resolve(projectDir, "assets/manifest.json");
    const manifestAssetIds = new Set<string>();
    if (existsSync(manifestPath)) {
      try {
        const manifestRaw = JSON.parse(readFileSync(manifestPath, "utf-8"));
        const parsedManifest = AssetManifestSchema.safeParse(manifestRaw);
        if (parsedManifest.success) {
          for (const a of parsedManifest.data.assets) {
            manifestAssetIds.add(a.id);
          }
        } else {
          items.push({
            id: "manifest-schema-invalid",
            category: "license",
            severity: "error",
            message: `Manifest assets/manifest.json schema invalid: ${parsedManifest.error.message}`,
          });
        }
      } catch (err: any) {
        items.push({
          id: "manifest-parse-failed",
          category: "license",
          severity: "error",
          message: `Failed to parse assets/manifest.json: ${err.message}`,
        });
      }
    }

    // Load library
    const libraryDir = options.libraryDir || resolve(process.cwd(), "library");
    const libraryJsonPath = resolve(libraryDir, "library.json");
    const libraryAssetIds = new Set<string>();
    if (existsSync(libraryJsonPath)) {
      try {
        const libRaw = JSON.parse(readFileSync(libraryJsonPath, "utf-8"));
        const parsedLib = LibrarySchema.safeParse(libRaw);
        if (parsedLib.success) {
          for (const m of parsedLib.data.music) libraryAssetIds.add(m.id);
          for (const s of parsedLib.data.sfx) libraryAssetIds.add(s.id);
          for (const f of parsedLib.data.fonts) libraryAssetIds.add(f.id);
        }
      } catch {}
    }

    // Check beat visual assets
    for (const ch of spec.chapters) {
      for (const beat of ch.beats) {
        for (const asset of beat.assets) {
          // License check
          if (!asset.license || asset.license.trim() === "") {
            items.push({
              id: `license-empty-${asset.assetId}`,
              category: "license",
              severity: "error",
              message: `Asset "${asset.assetId}" in beat "${beat.id}" has no license specified`,
            });
          }

          // File existence
          const assetFilePath = resolve(projectDir, asset.filePath);
          if (!existsSync(assetFilePath)) {
            items.push({
              id: `asset-missing-${asset.assetId}`,
              category: "asset",
              severity: "error",
              message: `Visual asset file missing on disk: ${asset.filePath}`,
            });
          }

          // Manifest registration
          if (existsSync(manifestPath) && !manifestAssetIds.has(asset.assetId)) {
            items.push({
              id: `asset-unregistered-${asset.assetId}`,
              category: "license",
              severity: "error",
              message: `Asset "${asset.assetId}" is not registered in assets/manifest.json`,
            });
          }
        }
      }
    }

    // Check Narration audio file
    const narrAudio = spec.narration.audioPath;
    if (narrAudio && !narrAudio.startsWith("data:") && !narrAudio.startsWith("http:") && !narrAudio.startsWith("https:")) {
      const fullAudioPath = resolve(projectDir, narrAudio);
      if (!existsSync(fullAudioPath)) {
        items.push({
          id: "narration-audio-missing",
          category: "asset",
          severity: "error",
          message: `Narration audio file missing on disk: ${narrAudio}`,
        });
      }
    }

    // Check Music tracks
    for (const track of spec.music) {
      const libId = track.libraryId;
      if (!libId.startsWith("data:") && !libId.startsWith("http:") && !libId.startsWith("https:")) {
        const directTrack = resolve(projectDir, libId);
        const libTrack = resolve(libraryDir, "music", libId);
        const inLibLedger = libraryAssetIds.has(libId);

        const existsOnDisk = existsSync(directTrack) || existsSync(libTrack);
        if (!existsOnDisk && !inLibLedger) {
          items.push({
            id: `music-missing-${track.id}`,
            category: "asset",
            severity: "error",
            message: `Music track "${libId}" not found in project or library`,
          });
        }
      }
    }

    // Check SFX tracks
    for (const ch of spec.chapters) {
      for (const beat of ch.beats) {
        for (const sfx of beat.sfx) {
          const sId = sfx.sfxId;
          if (!sId.startsWith("data:") && !sId.startsWith("http:") && !sId.startsWith("https:")) {
            const directSfx = resolve(projectDir, sId);
            const libSfx = resolve(libraryDir, "sfx", sId);
            const inLibLedger = libraryAssetIds.has(sId);

            const existsOnDisk = existsSync(directSfx) || existsSync(libSfx);
            if (!existsOnDisk && !inLibLedger) {
              items.push({
                id: `sfx-missing-${sfx.id}`,
                category: "asset",
                severity: "error",
                message: `SFX "${sId}" not found in project or library`,
              });
            }
          }
        }
      }
    }

    // 4. Audio Confidence Check
    const confThreshold = options.confidenceThreshold ?? 0.8;
    for (const word of spec.narration.words) {
      if (word.confidence < confThreshold) {
        items.push({
          id: `confidence-${word.id}`,
          category: "audio_confidence",
          severity: "warning",
          message: `Low audio alignment confidence for word "${word.text}" (${word.id}): ${word.confidence.toFixed(2)} < ${confThreshold.toFixed(2)}`,
          details: { wordId: word.id, text: word.text, confidence: word.confidence, startSec: word.startSec },
        });
      }
    }

    const errors = items.filter((i) => i.severity === "error").length;
    const warnings = items.filter((i) => i.severity === "warning").length;

    return {
      projectSlug: slug,
      gate: "pre",
      passed: errors === 0,
      timestamp: new Date().toISOString(),
      summary: {
        total: items.length,
        errors,
        warnings,
      },
      items,
    };
  }

  /**
   * Post-Render QA Gate:
   * 1. Integrity Check (file exists, size > 1KB, duration matches spec)
   * 2. Loudness Check (measures audio loudness, targets -14 LUFS)
   */
  async runPostRenderQA(
    projectSlugOrDir: string,
    mediaInspector: QAMediaInspector,
    options: PostRenderQAOptions = {}
  ): Promise<QAReport> {
    const projectDir = this.getProjectDir(projectSlugOrDir);
    const slug = projectDir.split(/[/\\]/).pop() || projectSlugOrDir;
    const items: QAItem[] = [];

    // Find video file
    let videoPath: string;
    if (options.videoPath) {
      videoPath = resolve(projectDir, options.videoPath);
    } else {
      // Auto-detect in out/ or dist/
      const projectSlug = resolve(projectDir).split(/[/\\]/).pop() || "";
      const candidates = [
        resolve(projectDir, "out/long-16x9", `${projectSlug}.mp4`),
        resolve(projectDir, "dist/long-16x9.mp4"),
        resolve(projectDir, "dist/shorts/spec-short-1.mp4"),
        resolve(projectDir, "dist/shorts/short-1.mp4"),
        resolve(projectDir, "dist/short-9x16.mp4"),
        resolve(projectDir, "dist/video.mp4"),
      ];
      const found = candidates.find((c) => existsSync(c));
      videoPath = found || candidates[0];
    }

    // 1. File existence
    if (!existsSync(videoPath)) {
      items.push({
        id: "video-missing",
        category: "file_integrity",
        severity: "error",
        message: `Rendered MP4 file not found at: ${videoPath}`,
      });

      return {
        projectSlug: slug,
        gate: "post",
        passed: false,
        timestamp: new Date().toISOString(),
        summary: { total: 1, errors: 1, warnings: 0 },
        items,
      };
    }

    // 2. File size check
    const stat = statSync(videoPath);
    if (stat.size < 1000) {
      items.push({
        id: "video-size-invalid",
        category: "file_integrity",
        severity: "error",
        message: `Video file size is abnormally small (${stat.size} bytes)`,
        details: { sizeBytes: stat.size },
      });
    }

    // 3. Duration check
    try {
      const actualDuration = await mediaInspector.probeDuration(videoPath);
      let expectedDuration = options.expectedDuration;

      if (expectedDuration === undefined) {
        // Read from spec if available
        const specFileName = options.specFileName || "spec.json";
        const specPath = resolve(projectDir, specFileName);
        if (existsSync(specPath)) {
          try {
            const raw = JSON.parse(readFileSync(specPath, "utf-8"));
            expectedDuration = raw.narration?.durationSec;
          } catch {}
        }
      }

      if (expectedDuration !== undefined && expectedDuration > 0) {
        const diff = Math.abs(actualDuration - expectedDuration);
        const tolerance = options.durationToleranceSec ?? 2.0;

        if (diff > tolerance) {
          items.push({
            id: "duration-mismatch",
            category: "duration",
            severity: diff > 5.0 ? "error" : "warning",
            message: `Video duration (${actualDuration.toFixed(1)}s) deviates from expected duration (${expectedDuration.toFixed(1)}s)`,
            details: { actualDuration, expectedDuration, diff },
          });
        }
      }
    } catch (err: any) {
      items.push({
        id: "duration-probe-failed",
        category: "duration",
        severity: "warning",
        message: `Failed to probe video duration: ${err.message}`,
      });
    }

    // 4. Loudness Check
    try {
      const loudness = await mediaInspector.measureLoudness(videoPath);
      const targetI = options.loudnessTargetLUFS ?? -14.0;
      const tolerance = options.loudnessToleranceLUFS ?? 2.0;

      const diff = Math.abs(loudness.input_i - targetI);
      if (diff > tolerance) {
        items.push({
          id: "loudness-deviation",
          category: "loudness",
          severity: diff > 4.0 ? "error" : "warning",
          message: `Integrated loudness (${loudness.input_i.toFixed(1)} LUFS) deviates from YouTube target (${targetI.toFixed(1)} LUFS)`,
          details: { measuredLUFS: loudness.input_i, targetLUFS: targetI, diff },
        });
      }

      if (loudness.input_tp > -0.5) {
        items.push({
          id: "true-peak-exceeded",
          category: "loudness",
          severity: "warning",
          message: `True Peak (${loudness.input_tp.toFixed(1)} dBTP) exceeds recommended -1.0 dBTP ceiling`,
          details: { measuredTP: loudness.input_tp, ceiling: -1.0 },
        });
      }
    } catch (err: any) {
      items.push({
        id: "loudness-measure-failed",
        category: "loudness",
        severity: "warning",
        message: `Failed to measure audio loudness (video may have no audio): ${err.message}`,
      });
    }

    const errors = items.filter((i) => i.severity === "error").length;
    const warnings = items.filter((i) => i.severity === "warning").length;

    return {
      projectSlug: slug,
      gate: "post",
      passed: errors === 0,
      timestamp: new Date().toISOString(),
      summary: {
        total: items.length,
        errors,
        warnings,
      },
      items,
    };
  }
}
