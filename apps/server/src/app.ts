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
          } catch {}
        }
      }
    }

    return c.json({ success: true, projects });
  });

  // POST /projects - Create a new project (studio new)
  app.post("/projects", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { slug, topic, template, minutes, formats, assetBudget, qaThreshold, voice, speed } = body;

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
      const audioDir = resolve(projDir, "audio");
      mkdirSync(audioDir, { recursive: true });
      const narrPath = resolve(audioDir, "narration.wav");

      // Minimal valid 44-byte WAV header (silence)
      const SILENT_WAV_BASE64 =
        "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
      writeFileSync(narrPath, Buffer.from(SILENT_WAV_BASE64, "base64"));

      if (state.stages.some((s) => s.stage === "tts")) {
        pm.updateStage(slug, "tts", { status: "done" });
      }
      pm.recordEvent(slug, {
        type: "tts_completed",
        stage: "tts",
        audioPath: "audio/narration.wav",
      });

      return c.json({
        success: true,
        stage: "tts",
        status: "done",
        audioPath: "audio/narration.wav",
      });
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

  // GET /projects/:slug/files/* - Serve project files (video, audio, images)
  app.get("/projects/:slug/files/*", (c) => {
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
    const content = readFileSync(fullPath);
    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  });

  return app;
}
