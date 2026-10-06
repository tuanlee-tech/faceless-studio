import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  ProjectManager,
  TaskInbox,
  OutlineResultSchema,
  ScriptResultSchema,
  DirectResultSchema,
  VideoSpecSchema,
  z,
} from "@faceless/core";
import { MockTtsEngine, MockAligner } from "@faceless/media";

export interface RunCommandOptions {
  slug: string;
  stage?: string;
  baseDir?: string;
  json?: boolean;
}

interface StageDefinition {
  id: string;
  skill: string;
  prompt: string;
  schema: z.ZodTypeAny;
  inputs: Record<string, unknown>;
  output: Record<string, unknown>;
}

const CREATIVE_STAGES: Record<string, StageDefinition> = {
  outline: {
    id: "001",
    skill: "faceless-director",
    prompt: "Tạo dàn ý (outline) phân cảnh cho video dựa trên chủ đề và thời lượng mục tiêu.",
    schema: OutlineResultSchema,
    inputs: { project: "project.json" },
    output: { result: "results/001-outline.json" },
  },
  script: {
    id: "002",
    skill: "faceless-director",
    prompt: "Viết kịch bản chi tiết theo từng phân đoạn kèm lời thoại/lời dẫn.",
    schema: ScriptResultSchema,
    inputs: { outline: "results/001-outline.json" },
    output: { result: "results/002-script.json" },
  },
  direct: {
    id: "003",
    skill: "faceless-director",
    prompt: "Chỉ đạo nhịp điệu (beats), visual prompts, asset requests và chuyển cảnh.",
    schema: DirectResultSchema,
    inputs: { script: "results/002-script.json" },
    output: { result: "results/003-direct.json" },
  },
  spec: {
    id: "004",
    skill: "faceless-director",
    prompt: "Tổng hợp toàn bộ thông số thành VideoSpec hoàn chỉnh để render.",
    schema: VideoSpecSchema,
    inputs: { direct: "results/003-direct.json" },
    output: { result: "results/004-spec.json" },
  },
};

export async function runRun(options: RunCommandOptions): Promise<void> {
  const { slug } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio run <slug> [stage] [--json]";
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const baseDir = options.baseDir || process.env.STUDIO_BASE_DIR || "projects";
  const pm = new ProjectManager(baseDir);
  const ti = new TaskInbox(baseDir);

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

  let targetStage = options.stage;
  if (!targetStage) {
    const nextStageEntry = state.stages.find((s) => s.status !== "done");
    if (!nextStageEntry) {
      const msg = `All stages in project '${slug}' are already completed.`;
      if (options.json) {
        process.stdout.write(JSON.stringify({ success: true, message: msg, slug }, null, 2) + "\n");
      } else {
        console.log(`🎉 ${msg}`);
      }
      process.exit(0);
    }
    targetStage = nextStageEntry.stage;
  }

  // Handle deterministic stages: tts, align
  if (targetStage === "tts") {
    try {
      if (state.stages.some((s) => s.stage === "tts")) {
        pm.updateStage(slug, "tts", { status: "running" });
      }

      const audioDir = resolve(baseDir, slug, "audio");
      const chunksDir = resolve(audioDir, "chunks");
      mkdirSync(chunksDir, { recursive: true });

      const tts = new MockTtsEngine();
      const jobs = [{ id: "narration", text: "Xin chào, đây là giọng đọc thử nghiệm cho dự án.", voice: "default" }];
      for await (const _res of tts.synthesizeBatch(jobs)) {
        // synthesizes mock batch
      }

      const narrationPath = resolve(audioDir, "narration.wav");
      const SILENT_WAV_BASE64 =
        "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
      writeFileSync(narrationPath, Buffer.from(SILENT_WAV_BASE64, "base64"));

      if (state.stages.some((s) => s.stage === "tts")) {
        pm.updateStage(slug, "tts", { status: "done" });
      }

      if (options.json) {
        process.stdout.write(
          JSON.stringify(
            {
              success: true,
              slug,
              stage: "tts",
              status: "done",
              narrationPath,
              message: "TTS synthesis completed (mock audio generated)",
            },
            null,
            2
          ) + "\n"
        );
      } else {
        console.log(`✅ Stage 'tts' completed: Mock audio generated at audio/narration.wav`);
      }
      process.exit(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (options.json) {
        process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
      } else {
        console.error(`❌ Error in tts: ${message}`);
      }
      process.exit(1);
    }
  }

  if (targetStage === "align") {
    try {
      if (state.stages.some((s) => s.stage === "align")) {
        pm.updateStage(slug, "align", { status: "running" });
      }

      const audioDir = resolve(baseDir, slug, "audio");
      mkdirSync(audioDir, { recursive: true });

      const aligner = new MockAligner();
      const words = await aligner.align("audio/narration.wav", "Xin chào đây là giọng đọc thử nghiệm cho dự án", "vi");
      const wordsPath = resolve(audioDir, "words.json");
      writeFileSync(wordsPath, JSON.stringify(words, null, 2), "utf-8");

      if (state.stages.some((s) => s.stage === "align")) {
        pm.updateStage(slug, "align", { status: "done" });
      }

      if (options.json) {
        process.stdout.write(
          JSON.stringify(
            {
              success: true,
              slug,
              stage: "align",
              status: "done",
              wordsPath,
              message: "Word alignment completed (words.json generated)",
            },
            null,
            2
          ) + "\n"
        );
      } else {
        console.log(`✅ Stage 'align' completed: Words aligned at audio/words.json`);
      }
      process.exit(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (options.json) {
        process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
      } else {
        console.error(`❌ Error in align: ${message}`);
      }
      process.exit(1);
    }
  }

  // Handle creative stages: outline, script, direct, spec
  const stageConfig = CREATIVE_STAGES[targetStage] || {
    id: `task-${targetStage}`,
    skill: "faceless-director",
    prompt: `Thực hiện giai đoạn ${targetStage} cho dự án.`,
    schema: z.record(z.unknown()).describe(`${targetStage}-schema`),
    inputs: {},
    output: { result: `results/task-${targetStage}.json` },
  };

  try {
    // 1. Mark state as running
    pm.updateStage(slug, targetStage, { status: "running" });

    // 2. Generate task file in tasks/
    const taskPath = ti.createTask({
      slug,
      id: stageConfig.id,
      stage: targetStage,
      skill: stageConfig.skill,
      inputs: stageConfig.inputs,
      output: stageConfig.output,
      schema: stageConfig.schema,
      prompt: stageConfig.prompt,
    });

    const outputResultFile = `results/${stageConfig.id}-${targetStage}.json`;
    const message = "Task generated. Agent must fulfill results/... then run studio validate.";

    if (options.json) {
      process.stdout.write(
        JSON.stringify(
          {
            success: true,
            slug,
            stage: targetStage,
            status: "running",
            taskId: stageConfig.id,
            taskPath,
            outputFile: outputResultFile,
            message,
          },
          null,
          2
        ) + "\n"
      );
    } else {
      console.log(`Task generated: ${taskPath}`);
      console.log(`Stage '${targetStage}' is now running.`);
      console.log(message);
    }

    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
    } else {
      console.error(`❌ Error running stage '${targetStage}': ${message}`);
    }
    process.exit(1);
  }
}
