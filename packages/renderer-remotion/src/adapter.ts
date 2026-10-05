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
    const inputProps = { spec, fontsCss, templateConfig };

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
    const inputProps = { spec, fontsCss, templateConfig };

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
