import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from "node:fs";
import {
  ProjectManager,
  VideoSpecSchema,
  ShortCandidatesResultSchema,
  extractShort,
  autoDetectShortCandidates,
  type VideoSpec,
  type ShortCandidate,
} from "@faceless/core";

export interface ShortsCommandOptions {
  slug?: string;
  baseDir?: string;
  maxCandidates?: number;
  json?: boolean;
}

export async function runShorts(options: ShortsCommandOptions): Promise<void> {
  const { slug, json = false } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio shorts <slug> [--json]";
    if (json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const baseDir = options.baseDir || process.env.STUDIO_BASE_DIR || "projects";
  const pm = new ProjectManager(baseDir);
  const projectDir = resolve(baseDir, slug);

  if (!existsSync(projectDir)) {
    const errorMsg = `Project '${slug}' not found at: ${projectDir}`;
    if (json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const specPath = resolve(projectDir, "spec.json");
  if (!existsSync(specPath)) {
    const errorMsg = `Project spec not found at: ${specPath}. Please run previous stages first.`;
    if (json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  let spec: VideoSpec;
  try {
    spec = VideoSpecSchema.parse(JSON.parse(readFileSync(specPath, "utf-8")));
  } catch (err: unknown) {
    const message = `Failed to parse spec.json: ${err instanceof Error ? err.message : String(err)}`;
    if (json) {
      process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${message}`);
    }
    process.exit(1);
  }

  // Look for candidates in results/
  const resultsDir = resolve(projectDir, "results");
  let candidates: ShortCandidate[] = [];

  if (existsSync(resultsDir)) {
    const resultFiles = readdirSync(resultsDir).filter(
      (f) =>
        f.endsWith(".json") &&
        (f.includes("short-candidates") || f.includes("short")),
    );

    for (const rFile of resultFiles) {
      try {
        const raw = JSON.parse(readFileSync(resolve(resultsDir, rFile), "utf-8"));
        const parsed = ShortCandidatesResultSchema.parse(raw);
        if (parsed.candidates && parsed.candidates.length > 0) {
          candidates = parsed.candidates;
          break;
        }
      } catch {
        // ignore parse errors and continue
      }
    }
  }

  // If no candidates file found in results/, generate task file and auto-detect
  if (candidates.length === 0) {
    const tasksDir = resolve(projectDir, "tasks");
    if (existsSync(tasksDir)) {
      const taskFile = resolve(tasksDir, `${slug}-shorts.md`);
      if (!existsSync(taskFile)) {
        const taskContent = `---
task: select-short-candidates
slug: ${slug}
schema: shorts-candidates-schema
---

# Task: Chọn các đoạn Hook làm Video Short (9:16)
Hãy phân tích kịch bản của dự án **${slug}**, chọn ra 1-3 đoạn cao trào, hấp dẫn có thời lượng từ 15-50 giây.
Ghi kết quả vào file \`results/${slug}-short-candidates.json\` theo schema:
\`\`\`json
{
  "candidates": [
    {
      "id": "short-1",
      "title": "Tên đoạn Short",
      "startWordId": "w001",
      "endWordId": "w025",
      "hookReason": "Lý do chọn đoạn này"
    }
  ]
}
\`\`\`
`;
        writeFileSync(taskFile, taskContent, "utf-8");
      }
    }

    candidates = autoDetectShortCandidates(spec, 60, options.maxCandidates || 2);
  }

  if (candidates.length === 0) {
    const errorMsg = "No suitable short candidates could be extracted from spec.";
    if (json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  // Extract short specs
  const generatedFiles: string[] = [];

  candidates.forEach((cand, index) => {
    const shortSpec = extractShort(spec, {
      startWordId: cand.startWordId,
      endWordId: cand.endWordId,
      title: cand.title,
      shortIndex: index + 1,
    });

    const shortFileName = `spec-short-${index + 1}.json`;
    const targetPath = resolve(projectDir, shortFileName);
    writeFileSync(targetPath, JSON.stringify(shortSpec, null, 2), "utf-8");
    generatedFiles.push(shortFileName);
  });

  // Update state for short-9x16 if exists
  try {
    const state = pm.getState(slug);
    if (state.stages.some((s) => s.stage === "short-9x16")) {
      pm.updateStage(slug, "short-9x16", { status: "done" });
    }
  } catch {
    // ignore
  }

  // Append event
  const eventsPath = resolve(projectDir, "events.jsonl");
  const event = {
    type: "shorts_generated",
    slug,
    count: candidates.length,
    files: generatedFiles,
    timestamp: new Date().toISOString(),
  };
  appendFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          success: true,
          slug,
          count: candidates.length,
          files: generatedFiles,
          candidates,
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    console.log(`✨ [Shorts] Successfully generated ${candidates.length} Short specifications for '${slug}':`);
    generatedFiles.forEach((file, idx) => {
      const c = candidates[idx];
      console.log(`  - ${file}: "${c.title}" (${c.startWordId} -> ${c.endWordId})`);
    });
    console.log(`👉 Render with: studio render ${slug} --format short-9x16 --spec ${generatedFiles[0]}`);
  }
}
