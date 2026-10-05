import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import {
  VideoSpecSchema,
  TemplateManager,
  type VideoSpec,
  type TemplateConfig,
  type RendererAdapter,
  type FormatId,
} from "@faceless/core";
import type { AudioSources } from "./remotion/AudioMixer.js";

export class RemotionRendererAdapter implements RendererAdapter {
  private entryPoint: string;
  private bundleLocation?: string;
  private templateManager: TemplateManager;

  constructor(customEntryPoint?: string, templatesDir?: string) {
    this.templateManager = new TemplateManager(templatesDir);

    if (customEntryPoint) {
      this.entryPoint = customEntryPoint;
    } else {
      const currentDir = dirname(fileURLToPath(import.meta.url));
      const tsEntry = resolve(currentDir, "remotion/entry.ts");
      const jsEntry = resolve(currentDir, "remotion/entry.js");
      if (existsSync(tsEntry)) {
        this.entryPoint = tsEntry;
      } else if (existsSync(jsEntry)) {
        this.entryPoint = jsEntry;
      } else {
        // Fallback relative to src when running from dist or tests
        const srcTsEntry = resolve(currentDir, "../src/remotion/entry.ts");
        this.entryPoint = existsSync(srcTsEntry) ? srcTsEntry : jsEntry;
      }
    }
  }

  private async getBundle(): Promise<string> {
    if (!this.bundleLocation) {
      this.bundleLocation = await bundle({
        entryPoint: this.entryPoint,
        webpackOverride: (currentConfig) => {
          return {
            ...currentConfig,
            resolve: {
              ...currentConfig.resolve,
              extensionAlias: {
                ".js": [".ts", ".tsx", ".js"],
              },
            },
          };
        },
      });
    }
    return this.bundleLocation;
  }

  private readSpec(specPath: string): VideoSpec {
    if (!existsSync(specPath)) {
      throw new Error(`VideoSpec file not found at: ${specPath}`);
    }
    const raw = JSON.parse(readFileSync(specPath, "utf-8"));
    return VideoSpecSchema.parse(raw);
  }

  private getFontsCss(templateConfig: TemplateConfig): string {
    const cssRules: string[] = [];
    const baseTemplatesDirs = [
      resolve(process.cwd(), "templates"),
      resolve(dirname(fileURLToPath(import.meta.url)), "../../../templates"),
    ];

    for (const font of templateConfig.fonts || []) {
      for (const tDir of baseTemplatesDirs) {
        const fontPath = resolve(tDir, templateConfig.id, font.file);
        if (existsSync(fontPath)) {
          try {
            const fontBuffer = readFileSync(fontPath);
            const b64 = fontBuffer.toString("base64");
            cssRules.push(`
@font-face {
  font-family: '${font.family}';
  src: url('data:font/truetype;charset=utf-8;base64,${b64}') format('truetype');
  font-weight: ${font.weight || "400"};
  font-style: ${font.style || "normal"};
}`);
            break;
          } catch {
            // ignore if read fails
          }
        }
      }
    }

    return cssRules.join("\n");
  }

  private fileToDataUri(filePath: string): string | undefined {
    if (!existsSync(filePath)) return undefined;
    try {
      const ext = filePath.split(".").pop()?.toLowerCase();
      let mime = "audio/mpeg";
      if (ext === "wav") mime = "audio/wav";
      else if (ext === "ogg") mime = "audio/ogg";
      else if (ext === "aac" || ext === "m4a") mime = "audio/aac";
      else if (ext === "flac") mime = "audio/flac";

      const buf = readFileSync(filePath);
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return undefined;
    }
  }

  private resolveAudioFile(identifier: string, projectDir: string, type: "music" | "sfx" | "narration"): string | undefined {
    if (!identifier) return undefined;
    if (identifier.startsWith("data:") || identifier.startsWith("http:") || identifier.startsWith("https:")) {
      return identifier;
    }

    // 1. Direct path relative to projectDir
    const directPath = resolve(projectDir, identifier);
    if (existsSync(directPath)) {
      return this.fileToDataUri(directPath);
    }

    // 2. Candidate subdirectories in projectDir
    const projectSubDirs = ["assets/audio", "audio", "assets", "music", "sfx"];
    for (const sub of projectSubDirs) {
      const p = resolve(projectDir, sub, identifier);
      if (existsSync(p)) return this.fileToDataUri(p);
      for (const ext of [".mp3", ".wav", ".ogg", ".m4a"]) {
        const pWithExt = resolve(projectDir, sub, identifier + ext);
        if (existsSync(pWithExt)) return this.fileToDataUri(pWithExt);
      }
    }

    // 3. Library directories
    const baseLibraryDirs = [
      resolve(process.cwd(), "library"),
      resolve(dirname(fileURLToPath(import.meta.url)), "../../../library"),
    ];

    for (const libDir of baseLibraryDirs) {
      if (type === "music" || type === "sfx") {
        const p = resolve(libDir, type, identifier);
        if (existsSync(p)) return this.fileToDataUri(p);
        for (const ext of [".mp3", ".wav", ".ogg", ".m4a"]) {
          const pWithExt = resolve(libDir, type, identifier + ext);
          if (existsSync(pWithExt)) return this.fileToDataUri(pWithExt);
        }
      }

      // Check library.json if present
      const libJsonPath = resolve(libDir, "library.json");
      if (existsSync(libJsonPath)) {
        try {
          const libContent = JSON.parse(readFileSync(libJsonPath, "utf-8"));
          const assets = libContent[type] || [];
          const found = assets.find((a: any) => a.id === identifier);
          if (found && found.path) {
            const assetPath = resolve(process.cwd(), found.path);
            if (existsSync(assetPath)) return this.fileToDataUri(assetPath);
          }
        } catch {}
      }
    }

    return undefined;
  }

  public resolveAudioSources(spec: VideoSpec, projectDir: string): AudioSources {
    const audioSources: AudioSources = {
      music: {},
      sfx: {},
    };

    // Narration
    if (spec.narration?.audioPath) {
      audioSources.narration = this.resolveAudioFile(spec.narration.audioPath, projectDir, "narration");
    }

    // Music
    for (const track of spec.music || []) {
      const resolved = this.resolveAudioFile(track.libraryId, projectDir, "music");
      if (resolved) {
        if (!audioSources.music) audioSources.music = {};
        audioSources.music[track.id] = resolved;
        audioSources.music[track.libraryId] = resolved;
      }
    }

    // SFX
    for (const ch of spec.chapters || []) {
      for (const b of ch.beats || []) {
        for (const s of b.sfx || []) {
          const resolved = this.resolveAudioFile(s.sfxId, projectDir, "sfx");
          if (resolved) {
            if (!audioSources.sfx) audioSources.sfx = {};
            audioSources.sfx[s.id] = resolved;
            audioSources.sfx[s.sfxId] = resolved;
          }
        }
      }
    }

    return audioSources;
  }

  async render(options: {
    specPath: string;
    format: FormatId;
    frames?: [number, number];
    outPath: string;
    onProgress: (progress: number) => void;
  }): Promise<void> {
    const spec = this.readSpec(options.specPath);
    const templateConfig = this.templateManager.resolveTemplate(spec.templateId);
    const fontsCss = this.getFontsCss(templateConfig);
    const audioSources = this.resolveAudioSources(spec, dirname(options.specPath));
    const inputProps = { spec, fontsCss, templateConfig, audioSources };

    const compositionId = options.format === "short-9x16" ? "Short9x16" : "Long16x9";
    const bundleLocation = await this.getBundle();

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
      logLevel: "warn",
    });

    mkdirSync(dirname(options.outPath), { recursive: true });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: options.outPath,
      inputProps,
      frameRange: options.frames,
      logLevel: "warn",
      onProgress: ({ progress }) => {
        options.onProgress(progress);
      },
    });
  }

  async still(options: {
    specPath: string;
    format: FormatId;
    frame: number;
    outPath: string;
  }): Promise<void> {
    const spec = this.readSpec(options.specPath);
    const templateConfig = this.templateManager.resolveTemplate(spec.templateId);
    const fontsCss = this.getFontsCss(templateConfig);
    const audioSources = this.resolveAudioSources(spec, dirname(options.specPath));
    const inputProps = { spec, fontsCss, templateConfig, audioSources };

    const compositionId = options.format === "short-9x16" ? "Short9x16" : "Long16x9";
    const bundleLocation = await this.getBundle();

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
      logLevel: "warn",
    });

    mkdirSync(dirname(options.outPath), { recursive: true });

    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: options.outPath,
      inputProps,
      frame: options.frame,
      logLevel: "warn",
    });
  }
}
