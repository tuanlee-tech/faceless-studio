import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { resolve } from "node:path";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  createReadStream,
  statSync,
} from "node:fs";
import {
  ProjectManager,
  TaskInbox,
  AssetManager,
  QAManager,
  BUILTIN_TEMPLATES,
  autoDetectShortCandidates,
  extractShort,
  OutlineResultSchema,
  ScriptResultSchema,
  DirectResultSchema,
  VideoSpecSchema,
  ProjectConfigSchema,
  type QAMediaInspector,
  type FormatId,
  z,
} from "@faceless/core";
import { getDuration, measureLoudness } from "@faceless/media";
import { RemotionRendererAdapter } from "@faceless/renderer-remotion";
import { generateStageJsonFromPrompt, generateAiAssetImage } from "./ai-helper.js";

export interface CreateAppOptions {
  baseDir?: string;
}

const CREATIVE_STAGES: Record<
  string,
  {
    id: string;
    skill: string;
    prompt: string;
    schema: z.ZodTypeAny;
    inputs: Record<string, unknown>;
    output: Record<string, unknown>;
  }
> = {
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

export function createApp(options: CreateAppOptions = {}) {
  const baseDir = options.baseDir || process.env.STUDIO_BASE_DIR || "projects";
  const app = new Hono();

  // Middleware
  app.use("*", cors());

  // Error handling
  app.onError((err, c) => {
    console.error("API Server Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", uptime: process.uptime() });
  });

  // Templates
  app.get("/templates", (c) => {
    const templatesDir = resolve(process.cwd(), "templates");
    const templates: any[] = [];
    if (existsSync(templatesDir)) {
      const dirs = readdirSync(templatesDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const configPath = resolve(templatesDir, d.name, "template.json");
          if (existsSync(configPath)) {
            try {
              templates.push(JSON.parse(readFileSync(configPath, "utf-8")));
            } catch {}
          }
        }
      }
    }
    const result = templates.length > 0 ? templates : Object.values(BUILTIN_TEMPLATES);
    return c.json({
      success: true,
      templates: result,
    });
  });

  // Topics
  app.get("/topics", (c) => {
    const topicsDir = resolve(process.cwd(), "topics");
    const topics: Array<{ id: string; name: string }> = [];

    if (existsSync(topicsDir)) {
      const dirs = readdirSync(topicsDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          topics.push({ id: d.name, name: d.name });
        }
      }
    }

    if (topics.length === 0) {
      topics.push(
        { id: "sample", name: "Sample Topic" },
        { id: "psychology", name: "Tâm lý học" },
        { id: "history", name: "Lịch sử" }
      );
    }

    return c.json({ success: true, topics });
  });

  // ── Project Routes ──

  // GET /projects - List all projects
  app.get("/projects", (c) => {
    const pm = new ProjectManager(baseDir);
    if (!existsSync(baseDir)) {
      return c.json({ success: true, projects: [] });
    }

    const entries = readdirSync(baseDir, { withFileTypes: true });
    const projects: Array<{
      slug: string;
      config: any;
      state: any;
      specExists: boolean;
      updatedAt?: string;
    }> = [];

    for (const ent of entries) {
      if (ent.isDirectory()) {
        const projDir = resolve(baseDir, ent.name);
        const configPath = resolve(projDir, "project.json");
        if (existsSync(configPath)) {
          try {
            const config = JSON.parse(readFileSync(configPath, "utf-8"));
            const state = pm.getState(ent.name);
            const specExists = existsSync(resolve(projDir, "spec.json"));
            projects.push({
              slug: ent.name,
              config,
              state,
              specExists,
              updatedAt: state?.updatedAt || config?.createdAt,
            });
          } catch (e: any) {
            console.error("Error parsing project", ent.name, e);
          }
        }
      }
    }

    return c.json({ success: true, projects });
  });

  // POST /projects - Create a new project (studio new)
  app.post("/projects", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { slug, title, topic, template, minutes, formats, assetBudget, qaThreshold, voice, speed } = body;

    if (!slug || typeof slug !== "string") {
      return c.json({ success: false, error: "Missing required field: slug" }, 400);
    }

    const pm = new ProjectManager(baseDir);
    const projectDir = resolve(baseDir, slug);

    if (existsSync(projectDir)) {
      return c.json({ success: false, error: `Project "${slug}" already exists` }, 409);
    }

    let config;
    try {
      config = ProjectConfigSchema.parse({
        slug,
        title,
        topicId: topic || "sample",
        templateId: template || "minimal",
        targetMinutes: minutes ? Number(minutes) : 1,
        formats: Array.isArray(formats) && formats.length > 0 ? formats : ["long-16x9"],
        assetBudget: assetBudget ?? 50,
        qaThreshold: qaThreshold ?? 70,
        voice: voice ?? "default",
        speed: speed ?? 1.0,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      return c.json({ success: false, error: e.message }, 400);
    }

    pm.createProject(slug, config);
    const state = pm.getState(slug);

    return c.json(
      {
        success: true,
        project: {
          slug,
          config,
          state,
          specExists: false,
        },
      },
      201
    );
  });

  // GET /projects/:slug - Get project details
  app.get("/projects/:slug", (c) => {
    const slug = c.req.param("slug");
    const pm = new ProjectManager(baseDir);
    const projDir = resolve(baseDir, slug);

    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    try {
      const configPath = resolve(projDir, "project.json");
      const config = existsSync(configPath)
        ? JSON.parse(readFileSync(configPath, "utf-8"))
        : undefined;
      const state = pm.getState(slug);
      const specExists = existsSync(resolve(projDir, "spec.json"));

      return c.json({
        success: true,
        project: {
          slug,
          config,
          state,
          specExists,
        },
      });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // DELETE /projects/:slug - Delete a project
  app.delete("/projects/:slug", (c) => {
    const slug = c.req.param("slug");
    if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return c.json({ success: false, error: `Invalid project slug: ${slug}` }, 400);
    }

    const pm = new ProjectManager(baseDir);
    const projDir = resolve(baseDir, slug);

    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    try {
      pm.deleteProject(slug);
      return c.json({
        success: true,
        message: `Project "${slug}" deleted successfully`,
        slug,
      });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // GET /projects/:slug/status - Get state.json
  app.get("/projects/:slug/status", (c) => {
    const slug = c.req.param("slug");
    const pm = new ProjectManager(baseDir);

    try {
      const state = pm.getState(slug);
      return c.json({ success: true, state });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 404);
    }
  });

  // POST /projects/:slug/run - Run a pipeline stage
  app.post("/projects/:slug/run", async (c) => {
    const slug = c.req.param("slug");
    const body = (await c.req.json().catch(() => ({}))) as { stage?: string };
    const pm = new ProjectManager(baseDir);
    const ti = new TaskInbox(baseDir);
    const projDir = resolve(baseDir, slug);

    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    const state = pm.getState(slug);
    let targetStage = body.stage;

    if (!targetStage) {
      const nextPending = state.stages.find(
        (s) => s.status === "pending" || s.status === "running"
      );
      if (!nextPending) {
        return c.json({
          success: true,
          message: "All stages are already completed",
          state,
        });
      }
      targetStage = nextPending.stage;
    }

    const stageDef = CREATIVE_STAGES[targetStage];
    if (stageDef) {
      const taskPath = ti.createTask({
        slug,
        id: stageDef.id,
        stage: targetStage,
        skill: stageDef.skill,
        inputs: stageDef.inputs,
        output: stageDef.output,
        schema: stageDef.schema,
        prompt: stageDef.prompt,
      });
      pm.updateStage(slug, targetStage, { status: "running" });
      pm.recordEvent(slug, {
        type: "stage_started",
        stage: targetStage,
        taskId: stageDef.id,
      });

      return c.json({
        success: true,
        stage: targetStage,
        status: "running",
        taskId: stageDef.id,
        taskFile: taskPath,
        message: `Task for stage ${targetStage} created at ${taskPath}`,
      });
    }

    // Deterministic Stage: TTS
    if (targetStage === "tts") {
      return c.json({
        success: false,
        error: "Vui lòng sử dụng giao diện Sinh Audio (TTS) ở Tab 1 [Pipeline Inbox] để cấu hình và sinh giọng đọc.",
      }, 400);
    }

    // Deterministic Stage: Align
    if (targetStage === "align") {
      if (state.stages.some((s) => s.stage === "align")) {
        pm.updateStage(slug, "align", { status: "done" });
      }
      pm.recordEvent(slug, {
        type: "align_completed",
        stage: "align",
      });

      return c.json({
        success: true,
        stage: "align",
        status: "done",
      });
    }

    // Fallback for custom or unmapped stage
    const fallbackDef = {
      id: `task-${targetStage}`,
      skill: "faceless-director",
      prompt: `Thực hiện giai đoạn ${targetStage} cho dự án.`,
      schema: z.record(z.unknown()).describe(`${targetStage}-schema`),
      inputs: {},
      output: { result: `results/task-${targetStage}.json` },
    };
    const taskPath = ti.createTask({
      slug,
      id: fallbackDef.id,
      stage: targetStage,
      skill: fallbackDef.skill,
      inputs: fallbackDef.inputs,
      output: fallbackDef.output,
      schema: fallbackDef.schema,
      prompt: fallbackDef.prompt,
    });
    if (state.stages.some((s) => s.stage === targetStage)) {
      pm.updateStage(slug, targetStage, { status: "running" });
    }
    pm.recordEvent(slug, {
      type: "stage_started",
      stage: targetStage,
      taskId: fallbackDef.id,
    });

    return c.json({
      success: true,
      stage: targetStage,
      status: "running",
      taskId: fallbackDef.id,
      taskFile: taskPath,
      message: `Task for stage ${targetStage} created at ${taskPath}`,
    });
  });

  // POST /projects/:slug/validate - Validate task results
  app.post("/projects/:slug/validate", async (c) => {
    const slug = c.req.param("slug");
    const body = (await c.req.json().catch(() => ({}))) as { taskId?: string };
    const pm = new ProjectManager(baseDir);
    const ti = new TaskInbox(baseDir);
    const projDir = resolve(baseDir, slug);

    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    const tasks = ti.listTasks(slug);
    const tasksToValidate = body.taskId
      ? tasks.filter((t) => t.id === body.taskId)
      : tasks;

    if (tasksToValidate.length === 0) {
      return c.json({
        success: true,
        message: "No pending tasks to validate",
        results: [],
      });
    }

    const results: any[] = [];
    let allPassed = true;

    for (const task of tasksToValidate) {
      const schemaMap: Record<string, z.ZodTypeAny> = {
        outline: OutlineResultSchema,
        script: ScriptResultSchema,
        direct: DirectResultSchema,
        spec: VideoSpecSchema,
      };

      const schema = schemaMap[task.stage] || z.record(z.unknown()).describe(`${task.stage}-schema`);
      const res = ti.validateResult({
        slug,
        taskId: task.id,
        stage: task.stage,
        schema,
      });

      if (res.success) {
        // Auto-sync results/004.json or 004-spec.json to root spec.json
        if (task.stage === "spec" || task.id === "004") {
          const specCand1 = resolve(projDir, "results", `${task.id}.json`);
          const specCand2 = resolve(projDir, "results", `${task.id}-spec.json`);
          const srcSpec = existsSync(specCand1) ? specCand1 : existsSync(specCand2) ? specCand2 : null;
          if (srcSpec) {
            try {
              writeFileSync(resolve(projDir, "spec.json"), readFileSync(srcSpec, "utf-8"), "utf-8");
            } catch {}
          }
        }

        pm.updateStage(slug, task.stage, { status: "done" });
        pm.recordEvent(slug, {
          type: "task_validated",
          stage: task.stage,
          taskId: task.id,
          valid: true,
        });
        results.push({ taskId: task.id, stage: task.stage, status: "PASSED" });
      } else {
        allPassed = false;
        pm.updateStage(slug, task.stage, { status: "failed", error: res.error });
        pm.recordEvent(slug, {
          type: "task_validated",
          stage: task.stage,
          taskId: task.id,
          valid: false,
          error: res.error,
        });
        results.push({
          taskId: task.id,
          stage: task.stage,
          status: "FAILED",
          error: res.error,
        });
      }
    }

    return c.json({
      success: allPassed,
      slug,
      results,
    });
  });

  // POST /projects/:slug/shorts - Auto-extract shorts candidates
  app.post("/projects/:slug/shorts", async (c) => {
    const slug = c.req.param("slug");
    const pm = new ProjectManager(baseDir);
    const projDir = resolve(baseDir, slug);
    const specPath = resolve(projDir, "spec.json");

    if (!existsSync(specPath)) {
      return c.json({ success: false, error: "spec.json not found" }, 400);
    }

    const raw = JSON.parse(readFileSync(specPath, "utf-8"));
    const spec = VideoSpecSchema.parse(raw);

    const candidates = autoDetectShortCandidates(spec, 60, 3);
    const generatedShorts: string[] = [];

    candidates.forEach((cand, idx) => {
      const shortSpec = extractShort(spec, {
        startWordId: cand.startWordId,
        endWordId: cand.endWordId,
        title: cand.title,
        shortIndex: idx + 1,
      });

      const outName = `spec-short-${idx + 1}.json`;
      writeFileSync(resolve(projDir, outName), JSON.stringify(shortSpec, null, 2), "utf-8");
      generatedShorts.push(outName);
    });

    if (pm.getState(slug).stages.some((s) => s.stage === "short-9x16")) {
      pm.updateStage(slug, "short-9x16", { status: "done" });
    }
    pm.recordEvent(slug, {
      type: "shorts_generated",
      count: generatedShorts.length,
      files: generatedShorts,
    });

    return c.json({
      success: true,
      shorts: generatedShorts,
      candidates,
    });
  });

  // POST /projects/:slug/render - Render video
  app.post("/projects/:slug/render", async (c) => {
    const slug = c.req.param("slug");
    const body = (await c.req.json().catch(() => ({}))) as {
      format?: FormatId;
      spec?: string;
      frames?: [number, number];
    };

    const pm = new ProjectManager(baseDir);
    const projDir = resolve(baseDir, slug);
    const specFileName = body.spec || "spec.json";
    const specPath = resolve(projDir, specFileName);

    if (!existsSync(specPath)) {
      return c.json({ success: false, error: `Spec file not found: ${specFileName}` }, 400);
    }

    // Auto-reconcile spec with TTS and assets before rendering
    try {
      const specData = JSON.parse(readFileSync(specPath, "utf-8"));
      let specModified = false;

      // Reconcile with results/tts.json
      const ttsJsonPath = resolve(projDir, "results/tts.json");
      if (existsSync(ttsJsonPath)) {
        try {
          const ttsData = JSON.parse(readFileSync(ttsJsonPath, "utf-8"));
          if (
            ttsData.durationSec &&
            (specData.narration?.durationSec !== ttsData.durationSec ||
              !specData.narration?.words ||
              specData.narration.words.length === 0 ||
              specData.narration.words.length !== ttsData.words?.length)
          ) {
            specData.narration = {
              audioPath: ttsData.audioPath || specData.narration?.audioPath || "audio/narration.mp3",
              durationSec: ttsData.durationSec,
              words: ttsData.words || specData.narration?.words || [],
            };

            if (specData.chapters && specData.chapters.length > 0 && ttsData.words?.length > 0) {
              const allBeats = specData.chapters.flatMap((ch: any) => ch.beats || []);
              const numBeats = Math.max(1, allBeats.length);
              const wordsPerBeat = Math.ceil(ttsData.words.length / numBeats);

              allBeats.forEach((b: any, idx: number) => {
                const startIdx = idx * wordsPerBeat;
                const endIdx = Math.min((idx + 1) * wordsPerBeat - 1, ttsData.words.length - 1);
                if (ttsData.words[startIdx] && ttsData.words[endIdx]) {
                  b.range = {
                    startWordId: ttsData.words[startIdx].id,
                    endWordId: ttsData.words[endIdx].id,
                  };
                  b.captions = [
                    {
                      id: `cap${idx + 1}`,
                      wordIds: ttsData.words.slice(startIdx, endIdx + 1).map((w: any) => w.id),
                    },
                  ];
                }
              });
            }
            specModified = true;
          }
        } catch {}
      }

      // Reconcile with assets/manifest.json
      const manifestPath = resolve(projDir, "assets/manifest.json");
      if (existsSync(manifestPath)) {
        try {
          const manifestData = JSON.parse(readFileSync(manifestPath, "utf-8"));
          const manifestMap = new Map((manifestData.assets || []).map((a: any) => [a.beatId || a.id, a]));

          (specData.chapters || []).forEach((ch: any) => {
            (ch.beats || []).forEach((b: any) => {
              const foundAsset: any = manifestMap.get(b.id);
              if (foundAsset && (!b.assets || b.assets.length === 0)) {
                b.assets = [
                  {
                    assetId: foundAsset.id,
                    filePath: foundAsset.filePath,
                    kind: foundAsset.kind || "image",
                    license: foundAsset.license || "CC0",
                  },
                ];
                specModified = true;
              }
            });
          });
        } catch {}
      }

      if (specModified) {
        writeFileSync(specPath, JSON.stringify(specData, null, 2), "utf-8");
      }
    } catch (e) {
      console.warn("Spec pre-render reconciliation warning:", e);
    }

    const format: FormatId =
      body.format ||
      (specFileName.includes("short") ? "short-9x16" : "long-16x9");

    const outDir =
      format === "short-9x16"
        ? resolve(projDir, "dist/shorts")
        : resolve(projDir, "dist");
    mkdirSync(outDir, { recursive: true });

    const outFileName = format === "short-9x16" ? "short-1.mp4" : "long-16x9.mp4";
    const outPath = resolve(outDir, outFileName);

    pm.recordEvent(slug, {
      type: "render_started",
      format,
      spec: specFileName,
    });

    try {
      const adapter = new RemotionRendererAdapter();
      await adapter.render({
        specPath,
        format,
        frames: body.frames,
        outPath,
        onProgress: (p) => {
          pm.recordEvent(slug, {
            type: "render_progress",
            format,
            progress: Math.round(p * 100),
          });
        },
      });

      pm.recordEvent(slug, {
        type: "render_completed",
        format,
        outPath,
      });

      if (pm.getState(slug).stages.some((s) => s.stage === format)) {
        pm.updateStage(slug, format, { status: "done" });
      }

      return c.json({
        success: true,
        message: `Render completed successfully to ${outPath}`,
        outPath,
        format,
      });
    } catch (err: any) {
      pm.recordEvent(slug, {
        type: "render_failed",
        format,
        error: err.message,
      });
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // GET /projects/:slug/qa - Run QA Gate
  app.get("/projects/:slug/qa", async (c) => {
    const slug = c.req.param("slug");
    const gate = c.req.query("gate") || "pre";
    const specFileName = c.req.query("spec") || "spec.json";
    const video = c.req.query("video");

    const pm = new ProjectManager(baseDir);
    const projDir = resolve(baseDir, slug);

    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    const qaManager = new QAManager(baseDir);

    if (gate === "post") {
      const mediaInspector: QAMediaInspector = {
        probeDuration: async (p) => getDuration(p),
        measureLoudness: async (p) => {
          const info = await measureLoudness(p);
          return { input_i: info.input_i, input_tp: info.input_tp };
        },
      };

      const report = await qaManager.runPostRenderQA(projDir, mediaInspector, {
        specFileName,
        videoPath: video,
      });

      pm.recordEvent(slug, {
        type: "qa_checked",
        gate: "post",
        passed: report.passed,
        summary: report.summary,
      });

      return c.json(report);
    }

    // Default: Pre-render
    const report = await qaManager.runPreRenderQA(projDir, {
      specFileName,
    });

    pm.recordEvent(slug, {
      type: "qa_checked",
      gate: "pre",
      passed: report.passed,
      summary: report.summary,
    });

    return c.json(report);
  });

  // GET /projects/:slug/spec - Read spec
  app.get("/projects/:slug/spec", (c) => {
    const slug = c.req.param("slug");
    const file = c.req.query("file") || "spec.json";
    const specPath = resolve(baseDir, slug, file);

    if (!existsSync(specPath)) {
      return c.json({ success: false, error: `Spec file not found: ${file}` }, 404);
    }

    try {
      const raw = JSON.parse(readFileSync(specPath, "utf-8"));
      return c.json({ success: true, spec: raw });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // GET /projects/:slug/tasks - List tasks
  app.get("/projects/:slug/tasks", (c) => {
    const slug = c.req.param("slug");
    const ti = new TaskInbox(baseDir);
    const tasks = ti.listTasks(slug);
    return c.json({ success: true, tasks });
  });

  // GET /projects/:slug/events - SSE Streaming
  app.get("/projects/:slug/events", async (c) => {
    const slug = c.req.param("slug");
    const once = c.req.query("once") === "true";
    const projDir = resolve(baseDir, slug);
    const eventsPath = resolve(projDir, "events.jsonl");

    return streamSSE(c, async (stream) => {
      let lastPosition = 0;

      // 1. Send all existing events
      if (existsSync(eventsPath)) {
        const content = readFileSync(eventsPath, "utf-8");
        lastPosition = content.length;
        const lines = content.split("\n").filter((l) => l.trim().length > 0);
        for (const line of lines) {
          await stream.writeSSE({
            event: "log",
            data: line,
          });
        }
      }

      if (once) {
        // Close stream immediately for testing
        return;
      }

      // 2. Poll for new lines
      const interval = setInterval(async () => {
        try {
          if (!existsSync(eventsPath)) return;
          const currentContent = readFileSync(eventsPath, "utf-8");
          if (currentContent.length > lastPosition) {
            const newChunk = currentContent.slice(lastPosition);
            lastPosition = currentContent.length;
            const newLines = newChunk.split("\n").filter((l) => l.trim().length > 0);
            for (const line of newLines) {
              await stream.writeSSE({
                event: "log",
                data: line,
              });
            }
          }
        } catch {}
      }, 500);

      stream.onAbort(() => {
        clearInterval(interval);
      });

      // Keep open up to 60s
      await stream.sleep(60000);
      clearInterval(interval);
    });
  });

  // POST /projects/:slug/tasks/:taskId/result - Save task result JSON
  app.post("/projects/:slug/tasks/:taskId/result", async (c) => {
    const slug = c.req.param("slug");
    const taskId = c.req.param("taskId");
    const body = (await c.req.json().catch(() => ({}))) as { result?: any; stage?: string };
    const { result, stage } = body;

    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    if (!result) {
      return c.json({ success: false, error: "Missing result payload" }, 400);
    }

    const resultsDir = resolve(projDir, "results");
    mkdirSync(resultsDir, { recursive: true });

    const resultPath1 = resolve(resultsDir, `${taskId}.json`);
    writeFileSync(resultPath1, JSON.stringify(result, null, 2), "utf-8");

    if (stage) {
      const resultPath2 = resolve(resultsDir, `${taskId}-${stage}.json`);
      writeFileSync(resultPath2, JSON.stringify(result, null, 2), "utf-8");
    }

    return c.json({ success: true, message: "Result saved successfully" });
  });

  // GET /projects/:slug/tasks/:taskId/errors - Read errors file if present
  app.get("/projects/:slug/tasks/:taskId/errors", (c) => {
    const slug = c.req.param("slug");
    const taskId = c.req.param("taskId");
    const projDir = resolve(baseDir, slug);

    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    const errorsPath = resolve(projDir, "results", `${taskId}-errors.md`);
    if (existsSync(errorsPath)) {
      const content = readFileSync(errorsPath, "utf-8");
      return c.json({ success: true, hasErrors: true, content });
    }

    return c.json({ success: true, hasErrors: false, content: null });
  });

  // GET /projects/:slug/tasks/:taskId/result - Read existing result JSON if present
  app.get("/projects/:slug/tasks/:taskId/result", (c) => {
    const slug = c.req.param("slug");
    const taskId = c.req.param("taskId");
    const stage = c.req.query("stage");
    const projDir = resolve(baseDir, slug);

    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    const resultsDir = resolve(projDir, "results");
    const candidates = [
      stage ? resolve(resultsDir, `${taskId}-${stage}.json`) : null,
      resolve(resultsDir, `${taskId}.json`),
      stage ? resolve(resultsDir, `00${taskId}-${stage}.json`) : null,
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      if (existsSync(p)) {
        try {
          const content = JSON.parse(readFileSync(p, "utf-8"));
          return c.json({ success: true, hasResult: true, result: content });
        } catch {}
      }
    }

    return c.json({ success: true, hasResult: false, result: null });
  });

  // POST /projects/:slug/ai/generate-stage-json - Auto-generate stage JSON from user prompt
  app.post("/projects/:slug/ai/generate-stage-json", async (c) => {
    const slug = c.req.param("slug");
    const body = (await c.req.json().catch(() => ({}))) as {
      stage?: string;
      prompt?: string;
    };
    const { stage, prompt } = body;

    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    if (!stage || !prompt) {
      return c.json({ success: false, error: "Missing required fields: stage, prompt" }, 400);
    }

    // Read previous results for context
    const resultsDir = resolve(projDir, "results");
    const previousResults: Record<string, any> = { slug };

    const stages = ["outline", "script", "direct", "tts", "spec"];
    for (const st of stages) {
      const p1 = resolve(resultsDir, `00${stages.indexOf(st) + 1}-${st}.json`);
      const p2 = resolve(resultsDir, `${st}.json`);
      if (existsSync(p1)) {
        try { previousResults[st] = JSON.parse(readFileSync(p1, "utf-8")); } catch {}
      } else if (existsSync(p2)) {
        try { previousResults[st] = JSON.parse(readFileSync(p2, "utf-8")); } catch {}
      }
    }

    // Get project config
    const configPath = resolve(projDir, "project.json");
    let topicId = "psychology";
    let templateId = "baroque-mono";
    if (existsSync(configPath)) {
      try {
        const conf = JSON.parse(readFileSync(configPath, "utf-8"));
        topicId = conf.topicId || topicId;
        templateId = conf.templateId || templateId;
      } catch {}
    }

    try {
      const generated = await generateStageJsonFromPrompt({
        stage,
        prompt,
        topic: topicId,
        template: templateId,
        previousResults,
      });

      return c.json({
        success: true,
        stage,
        generatedJson: generated,
      });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // POST /projects/:slug/assets/generate-ai - Generate AI asset image
  app.post("/projects/:slug/assets/generate-ai", async (c) => {
    const slug = c.req.param("slug");
    const body = (await c.req.json().catch(() => ({}))) as {
      beatId?: string;
      prompt?: string;
    };
    const { beatId, prompt } = body;

    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    // Read template from project.json
    let templateId = "baroque-mono";
    const configPath = resolve(projDir, "project.json");
    if (existsSync(configPath)) {
      try {
        const conf = JSON.parse(readFileSync(configPath, "utf-8"));
        templateId = conf.templateId || templateId;
      } catch {}
    }

    const targetBeatId = beatId || "b1";
    const promptText = prompt || `Visual illustration for beat ${targetBeatId} of ${slug}`;

    try {
      const res = await generateAiAssetImage({
        slug,
        beatId: targetBeatId,
        promptText,
        templateId,
        baseDir,
      });

      return c.json({
        ...res,
      });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // POST /projects/:slug/assets/generate-ai-all - Generate AI asset images for all beats in spec
  app.post("/projects/:slug/assets/generate-ai-all", async (c) => {
    const slug = c.req.param("slug");
    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: `Project "${slug}" not found` }, 404);
    }

    const specPath = resolve(projDir, "spec.json");
    if (!existsSync(specPath)) {
      return c.json({ success: false, error: "spec.json not found" }, 400);
    }

    let spec: any;
    try {
      spec = JSON.parse(readFileSync(specPath, "utf-8"));
    } catch (e: any) {
      return c.json({ success: false, error: `Invalid spec.json: ${e.message}` }, 400);
    }

    const templateId = spec.templateId || "baroque-mono";
    const beats: Array<{ id: string; prompt: string }> = [];

    (spec.chapters || []).forEach((ch: any) => {
      (ch.beats || []).forEach((b: any) => {
        beats.push({
          id: b.id,
          prompt: b.visualPrompt || b.directorNote || `Scene illustration for beat ${b.id}`,
        });
      });
    });

    const generated: any[] = [];
    for (const b of beats) {
      try {
        const res = await generateAiAssetImage({
          slug,
          beatId: b.id,
          promptText: b.prompt,
          templateId,
          baseDir,
        });
        generated.push(res);
      } catch (e: any) {
        console.error(`Failed to generate asset for beat ${b.id}:`, e);
      }
    }

    const am = new AssetManager(baseDir);
    const manifest = am.loadManifest(slug);

    // Auto-attach assets to spec.json beats
    if (existsSync(specPath)) {
      try {
        const specData = JSON.parse(readFileSync(specPath, "utf-8"));
        const manifestMap = new Map((manifest.assets || []).map((a: any) => [a.beatId || a.id, a]));

        let specChanged = false;
        (specData.chapters || []).forEach((ch: any) => {
          (ch.beats || []).forEach((b: any) => {
            const foundAsset: any = manifestMap.get(b.id);
            if (foundAsset && (!b.assets || b.assets.length === 0)) {
              b.assets = [
                {
                  assetId: foundAsset.id,
                  filePath: foundAsset.filePath,
                  kind: foundAsset.kind || "image",
                  license: foundAsset.license || "CC0",
                },
              ];
              specChanged = true;
            }
          });
        });

        if (specChanged) {
          writeFileSync(specPath, JSON.stringify(specData, null, 2), "utf-8");
        }
      } catch (e) {
        console.error("Failed to auto-sync spec.json with assets:", e);
      }
    }

    return c.json({
      success: true,
      generatedCount: generated.length,
      totalBeats: beats.length,
      manifest,
      results: generated,
    });
  });

  // GET /projects/:slug/assets/export - Export Prompt Pack
  app.get("/projects/:slug/assets/export", (c) => {
    const slug = c.req.param("slug");
    const am = new AssetManager(baseDir);
    try {
      const { path, count } = am.exportPromptPack(slug);
      const content = readFileSync(path, "utf-8");
      return c.json({ success: true, promptPack: content, count, path });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // POST /projects/:slug/assets/upload - Upload and auto-import asset
  app.post("/projects/:slug/assets/upload", async (c) => {
    const slug = c.req.param("slug");
    const body = (await c.req.json().catch(() => ({}))) as {
      filename?: string;
      contentBase64?: string;
    };
    const { filename, contentBase64 } = body;

    if (!filename || !contentBase64) {
      return c.json({ success: false, error: "Missing filename or contentBase64" }, 400);
    }

    const am = new AssetManager(baseDir);
    const { incomingDir } = am.initAssetDirs(slug);
    const filePath = resolve(incomingDir, filename);

    writeFileSync(filePath, Buffer.from(contentBase64, "base64"));
    const { imported, count } = am.importAssets(slug);

    return c.json({ success: true, count, imported });
  });

  // POST /projects/:slug/audio/upload - Upload narration audio
  app.post("/projects/:slug/audio/upload", async (c) => {
    const slug = c.req.param("slug");
    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: "Project not found" }, 404);
    }

    try {
      const body = await c.req.parseBody();
      const file = body["audio"] as File;
      if (!file) {
        return c.json({ success: false, error: "No audio file uploaded" }, 400);
      }

      const audioDir = resolve(projDir, "audio");
      mkdirSync(audioDir, { recursive: true });
      
      const buffer = await file.arrayBuffer();
      const narrPath = resolve(audioDir, "narration.wav");
      writeFileSync(narrPath, Buffer.from(buffer));

      const pm = new ProjectManager(baseDir);
      pm.updateStage(slug, "tts", { status: "done" });
      pm.recordEvent(slug, {
        type: "audio_uploaded",
        stage: "tts",
        audioPath: "audio/narration.wav",
      });

      return c.json({ success: true, message: "Audio uploaded successfully" });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // POST /projects/:slug/audio/bgm - Upload background music
  app.post("/projects/:slug/audio/bgm", async (c) => {
    const slug = c.req.param("slug");
    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: "Project not found" }, 404);
    }

    try {
      const body = await c.req.parseBody();
      const file = body["audio"] as File;
      if (!file) {
        return c.json({ success: false, error: "No audio file uploaded" }, 400);
      }

      const audioDir = resolve(projDir, "audio");
      mkdirSync(audioDir, { recursive: true });
      
      const buffer = await file.arrayBuffer();
      const bgmPath = resolve(audioDir, `bgm.mp3`);
      writeFileSync(bgmPath, Buffer.from(buffer));

      const pm = new ProjectManager(baseDir);
      pm.recordEvent(slug, {
        type: "bgm_uploaded",
        stage: "assets",
        audioPath: `audio/bgm.mp3`,
      });

      return c.json({ success: true, message: "BGM uploaded successfully", path: `audio/bgm.mp3` });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // POST /projects/:slug/tts/draft - Generate TTS script from previous stages using AI
  app.post("/projects/:slug/tts/draft", async (c) => {
    const slug = c.req.param("slug");
    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: "Project not found" }, 404);
    }

    try {
      const resultsDir = resolve(projDir, "results");
      const scriptPath1 = resolve(resultsDir, "002-script.json");
      const scriptPath2 = resolve(resultsDir, "script.json");
      const directPath1 = resolve(resultsDir, "003-direct.json");
      const directPath2 = resolve(resultsDir, "direct.json");
      
      const scriptPath = existsSync(scriptPath1) ? scriptPath1 : scriptPath2;
      const directPath = existsSync(directPath1) ? directPath1 : directPath2;
      
      let scriptContent = "";
      if (existsSync(scriptPath)) {
        const scriptData = JSON.parse(readFileSync(scriptPath, "utf-8"));
        scriptContent = scriptData.content || JSON.stringify(scriptData);
      }
      
      let directContent = "";
      if (existsSync(directPath)) {
        const directData = JSON.parse(readFileSync(directPath, "utf-8"));
        directContent = JSON.stringify(directData);
      }

      const body = (await c.req.json().catch(() => ({}))) as { model?: string; voiceId?: string; currentText?: string };
      const GEMINI_VOICES = new Set(["Kore", "Puck", "Charon", "Aoede", "Fenrir"]);
      const isGeminiTTS = body.model === "gemini" || (body.voiceId && GEMINI_VOICES.has(body.voiceId));
      const sourceText = body.currentText?.trim() || scriptContent;

      const emotionRules = isGeminiTTS 
        ? `2. Bạn CẦN chèn thẻ cảm xúc vào văn bản theo chuẩn Gemini Flash TTS để tăng tính chân thực:
   CÁC THẺ CHO PHÉP (TUYỆT ĐỐI không dùng thẻ ngoài danh sách này):
   - Cảm xúc bao trùm: [enthusiasm] (hào hứng), [sadness] (buồn bã), [anger] (tức giận), [neutral] (bình thường).
   - Sự kiện âm thanh: <laugh> (cười), <sigh> (thở dài), <breath> (lấy hơi), <short pause> (ngắt nhịp).
   Quy tắc:
   - Thẻ cảm xúc ([...]) đặt ở đầu câu để định hình tâm trạng.
   - Thẻ sự kiện (<...>) đặt giữa hoặc cuối câu để tạo điểm nhấn âm thanh vật lý.
   - Ví dụ: [enthusiasm] Chào mọi người! <laugh> Hôm nay trời đẹp quá <breath>.`
        : `2. Bạn CẦN chèn thẻ cảm xúc vào văn bản theo chuẩn VieNeu-TTS (Local) để tăng tính chân thực.
   TUYỆT ĐỐI BẠN CHỈ ĐƯỢC PHÉP SỬ DỤNG ĐÚNG 3 THẺ SAU (không dùng thẻ tiếng Anh hay thẻ ngoài danh sách):
   - [cười] : Để ở cuối hoặc giữa câu để tạo sự vui vẻ, tươi tắn.
   - [thở dài] : Để ở đầu hoặc giữa câu biểu thị mệt mỏi, chán nản, luyến tiếc.
   - [hắng giọng] : Để ở đầu hoặc giữa câu để tạo ngắt quãng tự nhiên (e hèm).
   Hãy chèn các thẻ này một cách tiết chế, tự nhiên, đúng ngữ cảnh tiếng Việt.`;

      const prompt = `
Bạn là AI Agent Sáng Tạo chuyên về kịch bản âm thanh và diễn xuất (Voiceover Director).
Dưới đây là nội dung lời thoại cùng chỉ đạo nghệ thuật của video:

${sourceText ? `--- NỘI DUNG LỜI THOẠI ---\n${sourceText}\n` : ""}
${directContent ? `--- CHỈ ĐẠO NGHỆ THUẬT (DIRECT) ---\n${directContent}\n` : ""}

Nhiệm vụ của bạn:
1. Lọc bỏ các tiêu đề phần (Heading/Cảnh nếu có), giữ lại trọn vẹn lời thoại mà người đọc sẽ phát âm.
${emotionRules}
3. Không làm thay đổi nội dung chính của lời thoại.
4. CHỈ TRẢ VỀ nội dung text thuần tuý sau khi chèn thẻ cảm xúc, KHÔNG CÓ markdown code block, KHÔNG JSON, KHÔNG BÌNH LUẬN GIẢI THÍCH GÌ THÊM.
`;
      
      const apiKey = process.env.GEMINI_API_KEY;
      let generatedText = "";

      if (apiKey) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey });
          const CANDIDATE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"];
          for (const model of CANDIDATE_MODELS) {
            try {
              const res = await ai.models.generateContent({
                model,
                contents: prompt,
                config: { temperature: 0.7 }
              });
              if (res.text) {
                generatedText = res.text.replace(/^```.*?$/gm, "").trim();
                break;
              }
            } catch (err: any) {
              console.warn(`[TTS Draft] Gemini ${model} failed:`, err.message);
            }
          }
        } catch (e: any) {
          console.warn("[TTS Draft] AI call failed, falling back to smart rule-based enhancer:", e.message);
        }
      }

      if (!generatedText) {
        // Smart rule-based emotion tag inserter fallback
        const lines = sourceText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith("#") && !l.toLowerCase().startsWith("cảnh ") && !l.toLowerCase().startsWith("scene "));
        
        const content = lines.join(" ") || sourceText;
        const sentences = content.split(/(?<=[.?!…])\s+/);
        const result: string[] = [];

        for (let i = 0; i < sentences.length; i++) {
          let s = sentences[i].trim();
          if (!s) continue;

          if (isGeminiTTS) {
            if (i === 0 && !s.includes("[")) {
              s = `[enthusiasm] ${s}`;
            } else if (i % 3 === 0 && !s.includes("<") && !s.includes("[")) {
              s = s.replace(/([,;])/, " <breath>$1");
            } else if (i % 4 === 2 && !s.includes("<") && !s.includes("[")) {
              s = `${s} <laugh>`;
            }
          } else {
            // VieNeu local: only [cười], [thở dài], [hắng giọng]
            if (i % 4 === 1 && !s.includes("[")) {
              s = `${s} [cười]`;
            } else if (i % 4 === 3 && !s.includes("[")) {
              s = `[hắng giọng] ${s}`;
            } else if (i % 5 === 2 && !s.includes("[")) {
              s = `${s} [thở dài]`;
            }
          }
          result.push(s);
        }
        generatedText = result.join(" ") || sourceText;
      }

      return c.json({ success: true, text: generatedText });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });
  // GET /projects/:slug/audio/:filename - Serve audio files
  app.get("/projects/:slug/audio/:filename", async (c) => {
    const slug = c.req.param("slug");
    const filename = c.req.param("filename");
    const projDir = resolve(baseDir, slug);
    const audioPath = resolve(projDir, "audio", filename);

    if (!existsSync(audioPath)) {
      return c.json({ error: "File not found" }, 404);
    }
    
    // Simple streaming
    const stream = createReadStream(audioPath);
    const contentType = filename.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
    return c.body(stream as any, 200, {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes"
    });
  });

  // GET /tts/voices - List available voices from VieNeu-TTS and Gemini
  app.get("/tts/voices", async (c) => {
    try {
      const vieneuUrl = process.env.VIENEU_TTS_URL || "http://127.0.0.1:8000/v1/audio/speech";
      const vieneuVoicesUrl = vieneuUrl.replace("/audio/speech", "/voices");
      const res = await fetch(vieneuVoicesUrl).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        return c.json({ success: true, voices: data.data || [] });
      }
    } catch {}
    return c.json({ success: true, voices: [] });
  });

  // POST /projects/:slug/tts/preview - Generate a short TTS preview
  app.post("/projects/:slug/tts/preview", async (c) => {
    const slug = c.req.param("slug");
    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: "Project not found" }, 404);
    }

    try {
      const body = (await c.req.json().catch(() => ({}))) as { text?: string; voiceId?: string; model?: string };
      if (!body.text || body.text.length > 100) {
        return c.json({ success: false, error: "Missing text or exceeds 100 characters" }, 400);
      }

      const audioDir = resolve(projDir, "audio");
      if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });
      
      const { generateTTS } = await import("./tts-helper.js");
      const previewBase = resolve(audioDir, "preview.wav");
      
      const { ext, warning, isFallback, fallbackVoice, fallbackModel, cleanedText } = await generateTTS(body.text, previewBase, body.voiceId || "Hải Đăng", body.model || "auto");
      const previewFileName = `preview.${ext}`;
      
      return c.json({ 
        success: true, 
        audioUrl: `http://localhost:3005/projects/${slug}/audio/${previewFileName}?t=${Date.now()}`,
        warning,
        isFallback,
        fallbackVoice,
        fallbackModel,
        cleanedText
      });
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message || "Lỗi nghe thử TTS";
      const isQuota = errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429") || errorMsg.includes("quota");
      if (isQuota) {
        errorMsg = "Google Gemini TTS đã hết hạn mức sử dụng miễn phí trong ngày (429 Quota Exceeded: tối đa 10 lượt/ngày). Vui lòng thử các giọng đọc VieNeu-TTS Local.";
      }
      return c.json({ success: false, error: errorMsg, isQuotaExceeded: isQuota }, isQuota ? 429 : 500);
    }
  });

  // POST /projects/:slug/tts/generate - Generate TTS and SRT from text
  app.post("/projects/:slug/tts/generate", async (c) => {
    const slug = c.req.param("slug");
    const projDir = resolve(baseDir, slug);
    if (!existsSync(projDir)) {
      return c.json({ success: false, error: "Project not found" }, 404);
    }

    try {
      const body = (await c.req.json().catch(() => ({}))) as { text?: string; voiceId?: string; model?: string };
      if (!body.text) {
        return c.json({ success: false, error: "Missing text payload" }, 400);
      }

      const audioDir = resolve(projDir, "audio");
      mkdirSync(audioDir, { recursive: true });
      
      const { generateTTS, generateSrtAndWords } = await import("./tts-helper.js");
      const baseNarrPath = resolve(audioDir, "narration.wav"); 
      const srtPath = resolve(audioDir, "narration.srt");
      
      // 1. Generate Audio
      const { durationSec, ext, chunksCount, warning, isFallback, fallbackVoice, fallbackModel, cleanedText } = await generateTTS(body.text, baseNarrPath, body.voiceId || "Hải Đăng", body.model || "auto");
      const audioFileName = `narration.${ext}`;
      
      // 2. Generate SRT and Word Timings (using cleanedText if fallback stripped emotion tags)
      const textForSrt = cleanedText || body.text;
      const { srt, words } = generateSrtAndWords(textForSrt, durationSec);
      writeFileSync(srtPath, srt, "utf-8");

      // 3. Save to results/tts.json
      const resultsDir = resolve(projDir, "results");
      mkdirSync(resultsDir, { recursive: true });
      writeFileSync(resolve(resultsDir, "tts.json"), JSON.stringify({
        audioPath: `audio/${audioFileName}`,
        durationSec,
        words
      }, null, 2));

      // 4. Auto-sync spec.json if exists
      const specPath = resolve(projDir, "spec.json");
      if (existsSync(specPath)) {
        try {
          const specData = JSON.parse(readFileSync(specPath, "utf-8"));
          specData.narration = {
            audioPath: `audio/${audioFileName}`,
            durationSec,
            words
          };

          if (specData.chapters && specData.chapters.length > 0 && words.length > 0) {
            const allBeats = specData.chapters.flatMap((c: any) => c.beats || []);
            const numBeats = Math.max(1, allBeats.length);
            const wordsPerBeat = Math.ceil(words.length / numBeats);

            allBeats.forEach((b: any, idx: number) => {
              const startIdx = idx * wordsPerBeat;
              const endIdx = Math.min((idx + 1) * wordsPerBeat - 1, words.length - 1);
              if (words[startIdx] && words[endIdx]) {
                b.range = {
                  startWordId: words[startIdx].id,
                  endWordId: words[endIdx].id,
                };
                b.captions = [
                  {
                    id: `cap${idx + 1}`,
                    wordIds: words.slice(startIdx, endIdx + 1).map((w: any) => w.id),
                  },
                ];
              }
            });
          }

          writeFileSync(specPath, JSON.stringify(specData, null, 2), "utf-8");
        } catch (e) {
          console.error("Failed to auto-sync spec.json with TTS:", e);
        }
      }

      const pm = new ProjectManager(baseDir);
      pm.updateStage(slug, "tts", { status: "done" });
      pm.recordEvent(slug, {
        type: "tts_completed",
        stage: "tts",
        audioPath: `audio/${audioFileName}`,
      });

      return c.json({ 
        success: true, 
        durationSec,
        format: ext,
        audioFileName,
        audioUrl: `http://localhost:3005/projects/${slug}/audio/${audioFileName}?t=${Date.now()}`,
        chunksCount,
        warning,
        isFallback,
        fallbackVoice,
        fallbackModel,
        cleanedText
      });
    } catch (err: any) {
      let errorMsg = err.message || "Lỗi tạo TTS";
      const isQuota = errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429") || errorMsg.includes("quota");
      if (isQuota) {
        errorMsg = "Google Gemini TTS đã hết hạn mức sử dụng miễn phí trong ngày (429 Quota Exceeded: tối đa 10 lượt/ngày). Bạn hãy chuyển sang dùng Giọng đọc của VieNeu-TTS Local (hoàn toàn miễn phí và không giới hạn).";
      }
      return c.json({ success: false, error: errorMsg, isQuotaExceeded: isQuota }, isQuota ? 429 : 500);
    }
  });

  // GET /projects/:slug/assets/manifest - Read manifest.json
  app.get("/projects/:slug/assets/manifest", (c) => {
    const slug = c.req.param("slug");
    const am = new AssetManager(baseDir);
    try {
      const manifest = am.loadManifest(slug);
      return c.json({ success: true, manifest });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // GET & HEAD /projects/:slug/files/* - Serve project files (video, audio, images) with HTTP Range streaming
  app.on(["GET", "HEAD"], "/projects/:slug/files/*", (c) => {
    const slug = c.req.param("slug");
    const filePathRel = c.req.path.replace(`/projects/${slug}/files/`, "");
    const fullPath = resolve(baseDir, slug, filePathRel);

    if (!existsSync(fullPath)) {
      return c.json({ success: false, error: "File not found" }, 404);
    }

    const ext = fullPath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      wav: "audio/wav",
      mp3: "audio/mpeg",
      json: "application/json",
      md: "text/markdown",
    };

    const contentType = mimeTypes[ext || ""] || "application/octet-stream";
    const stat = statSync(fullPath);
    const fileSize = stat.size;

    // Support HTTP Range requests for video/audio seeking in HTML5 players
    const rangeHeader = c.req.header("range");
    if (rangeHeader && (contentType.startsWith("video/") || contentType.startsWith("audio/"))) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const stream = createReadStream(fullPath, { start, end });

      return c.body(stream as any, 206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": contentType,
      });
    }

    if (c.req.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        },
      });
    }

    const stream = createReadStream(fullPath);
    return c.body(stream as any, 200, {
      "Content-Type": contentType,
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
  });

  return app;
}
