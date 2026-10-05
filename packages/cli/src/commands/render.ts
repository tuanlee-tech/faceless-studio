import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  ProjectManager,
  VideoSpecSchema,
  type VideoSpec,
  type FormatId,
} from "@faceless/core";
import { RemotionRendererAdapter } from "@faceless/renderer-remotion";

export interface RenderCommandOptions {
  slug: string;
  format?: FormatId;
  chapter?: string;
  frames?: [number, number];
  baseDir?: string;
  json?: boolean;
}

export async function runRender(options: RenderCommandOptions): Promise<void> {
  const { slug } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio render <slug> --format long-16x9|short-9x16 [--json]";
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const baseDir = options.baseDir || process.env.STUDIO_BASE_DIR || "projects";
  const pm = new ProjectManager(baseDir);

  let state;
  try {
    state = pm.getState(slug);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${message}`);
    }
    process.exit(1);
  }

  const format: FormatId = options.format === "short-9x16" ? "short-9x16" : "long-16x9";
  const specPath = resolve(baseDir, slug, "spec.json");

  // Ensure spec.json exists; bootstrap a valid minimal spec if missing
  if (!existsSync(specPath)) {
    const projectJsonPath = resolve(baseDir, slug, "project.json");
    let topicId = "sample";
    let templateId = "minimal";
    if (existsSync(projectJsonPath)) {
      try {
        const pcfg = JSON.parse(readFileSync(projectJsonPath, "utf-8"));
        topicId = pcfg.topicId || topicId;
        templateId = pcfg.templateId || templateId;
      } catch {
        // ignore
      }
    }

    const defaultSpec: VideoSpec = {
      specVersion: "0.1.0",
      projectSlug: slug,
      topicId,
      templateId,
      fps: 30,
      narration: {
        audioPath: "audio/narration.wav",
        durationSec: 5,
        words: [
          {
            id: "w001",
            text: "Xin chào",
            startSec: 0,
            endSec: 1.0,
            confidence: 1.0,
          },
        ],
      },
      chapters: [
        {
          id: "c1",
          title: "Chapter 1",
          beats: [
            {
              id: "b1",
              range: { startWordId: "w001", endWordId: "w001" },
              layout: "title-card",
              assets: [],
              captions: [],
              sfx: [],
            },
          ],
        },
      ],
      music: [],
      meta: {
        title: `Faceless Video: ${slug}`,
      },
    };

    writeFileSync(specPath, JSON.stringify(defaultSpec, null, 2), "utf-8");
  }

  const outDir = resolve(baseDir, slug, "out", format);
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${slug}.mp4`);

  try {
    if (state.stages.some((s) => s.stage === format)) {
      pm.updateStage(slug, format, { status: "running" });
    }

    if (!options.json) {
      console.log(`🎬 Rendering video for '${slug}' (format: ${format})...`);
    }

    const adapter = new RemotionRendererAdapter();
    await adapter.render({
      specPath,
      format,
      frames: options.frames,
      outPath,
      onProgress: (progress) => {
        if (!options.json) {
          const pct = Math.round(progress * 100);
          process.stdout.write(`\r  Rendering: ${pct}%`);
        }
      },
    });

    if (state.stages.some((s) => s.stage === format)) {
      pm.updateStage(slug, format, { status: "done" });
    }

    pm.recordEvent(slug, {
      type: "render_completed",
      format,
      outPath,
    });

    if (options.json) {
      process.stdout.write(
        JSON.stringify(
          {
            success: true,
            slug,
            format,
            outPath,
            message: `Video rendered successfully at ${outPath}`,
          },
          null,
          2
        ) + "\n"
      );
    } else {
      console.log(`\n✅ Render completed successfully!`);
      console.log(`   Output: ${outPath}`);
    }

    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (state.stages.some((s) => s.stage === format)) {
      pm.updateStage(slug, format, { status: "failed", error: message });
    }

    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
    } else {
      console.error(`\n❌ Render failed: ${message}`);
    }
    process.exit(1);
  }
}
