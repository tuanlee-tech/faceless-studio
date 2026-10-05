import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import {
  VideoSpecSchema,
  type VideoSpec,
  type RendererAdapter,
  type FormatId,
} from "@faceless/core";

export class RemotionRendererAdapter implements RendererAdapter {
  private entryPoint: string;
  private bundleLocation?: string;

  constructor(customEntryPoint?: string) {
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

  async render(options: {
    specPath: string;
    format: FormatId;
    frames?: [number, number];
    outPath: string;
    onProgress: (progress: number) => void;
  }): Promise<void> {
    const spec = this.readSpec(options.specPath);
    const compositionId = options.format === "short-9x16" ? "Short9x16" : "Long16x9";
    const bundleLocation = await this.getBundle();

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: { spec },
      logLevel: "warn",
    });

    mkdirSync(dirname(options.outPath), { recursive: true });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: options.outPath,
      inputProps: { spec },
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
    const compositionId = options.format === "short-9x16" ? "Short9x16" : "Long16x9";
    const bundleLocation = await this.getBundle();

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: { spec },
      logLevel: "warn",
    });

    mkdirSync(dirname(options.outPath), { recursive: true });

    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: options.outPath,
      inputProps: { spec },
      frame: options.frame,
      logLevel: "warn",
    });
  }
}
