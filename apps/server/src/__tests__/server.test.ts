import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createApp } from "../app.js";

const TEST_BASE = resolve(tmpdir(), "faceless-server-test-" + Date.now());

describe("API Server (@faceless/server)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    if (existsSync(TEST_BASE)) {
      rmSync(TEST_BASE, { recursive: true, force: true });
    }
    mkdirSync(TEST_BASE, { recursive: true });
    app = createApp({ baseDir: TEST_BASE });
  });

  afterEach(() => {
    if (existsSync(TEST_BASE)) {
      rmSync(TEST_BASE, { recursive: true, force: true });
    }
  });

  describe("Base / System Endpoints", () => {
    it("GET /health returns 200 and ok status", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(typeof data.uptime).toBe("number");
    });

    it("GET /templates returns list of available templates", async () => {
      const res = await app.request("/templates");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.templates)).toBe(true);
      expect(data.templates.length).toBeGreaterThan(0);
      expect(data.templates.some((t: any) => t.id === "minimal")).toBe(true);
    });

    it("GET /topics returns list of available topics", async () => {
      const res = await app.request("/topics");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.topics)).toBe(true);
      expect(data.topics.some((t: any) => t.id === "sample")).toBe(true);
    });
  });

  describe("Project CRUD & State Endpoints", () => {
    it("GET /projects returns empty array when no projects exist", async () => {
      const res = await app.request("/projects");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.projects).toEqual([]);
    });

    it("POST /projects rejects missing slug with 400", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "psychology" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Missing required field: slug");
    });

    it("POST /projects creates project and returns 201", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "alpha-proj",
          topic: "psychology",
          template: "minimal",
          minutes: 2,
          formats: ["long-16x9"],
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.project.slug).toBe("alpha-proj");
      expect(data.project.config.topicId).toBe("psychology");
      expect(data.project.state.stages.length).toBeGreaterThan(0);

      // Verify on disk
      expect(existsSync(resolve(TEST_BASE, "alpha-proj", "project.json"))).toBe(true);
      expect(existsSync(resolve(TEST_BASE, "alpha-proj", "state.json"))).toBe(true);
      expect(existsSync(resolve(TEST_BASE, "alpha-proj", "events.jsonl"))).toBe(true);
    });

    it("POST /projects returns 409 when project slug already exists", async () => {
      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "duplicate-proj" }),
      });

      const res = await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "duplicate-proj" }),
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("already exists");
    });

    it("GET /projects lists created projects", async () => {
      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "listed-proj" }),
      });

      const res = await app.request("/projects");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.projects.length).toBe(1);
      expect(data.projects[0].slug).toBe("listed-proj");
    });

    it("GET /projects/:slug returns project details or 404", async () => {
      const res404 = await app.request("/projects/non-existent");
      expect(res404.status).toBe(404);

      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "detail-proj" }),
      });

      const res200 = await app.request("/projects/detail-proj");
      expect(res200.status).toBe(200);
      const data = await res200.json();
      expect(data.project.slug).toBe("detail-proj");
    });

    it("GET /projects/:slug/status returns project state", async () => {
      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "status-proj" }),
      });

      const res = await app.request("/projects/status-proj/status");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.state.projectSlug).toBe("status-proj");
      expect(data.state.stages.length).toBeGreaterThan(0);
    });
  });

  describe("Pipeline & Task Execution Endpoints", () => {
    beforeEach(async () => {
      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "pipeline-proj" }),
      });
    });

    it("POST /projects/:slug/run generates creative task and marks in_progress", async () => {
      const res = await app.request("/projects/pipeline-proj/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "outline" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.stage).toBe("outline");
      expect(data.status).toBe("running");
      expect(data.taskId).toBe("001");
      expect(existsSync(data.taskFile)).toBe(true);

      // GET /projects/:slug/tasks verifies the task in inbox
      const taskRes = await app.request("/projects/pipeline-proj/tasks");
      const taskData = await taskRes.json();
      expect(taskData.tasks.length).toBe(1);
      expect(taskData.tasks[0].id).toBe("001");
      expect(taskData.tasks[0].stage).toBe("outline");
    });

    it("POST /projects/:slug/run executes deterministic stages (tts, align)", async () => {
      // tts stage (redirects to UI Tab 1)
      const resTts = await app.request("/projects/pipeline-proj/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "tts" }),
      });
      expect(resTts.status).toBe(400);
      const dataTts = await resTts.json();
      expect(dataTts.success).toBe(false);

      // align stage
      const resAlign = await app.request("/projects/pipeline-proj/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "align" }),
      });
      expect(resAlign.status).toBe(200);
      const dataAlign = await resAlign.json();
      expect(dataAlign.status).toBe("done");
    });

    it("POST /projects/:slug/validate handles both failure and success", async () => {
      // 1. Generate task
      await app.request("/projects/pipeline-proj/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "outline" }),
      });

      // 2. Validate without result file -> fails
      const failRes = await app.request("/projects/pipeline-proj/validate", {
        method: "POST",
      });
      expect(failRes.status).toBe(200);
      const failData = await failRes.json();
      expect(failData.success).toBe(false);
      expect(failData.results[0].status).toBe("FAILED");

      // 3. Provide valid result file
      const validOutlineResult = {
        title: "Khám phá tâm lý học",
        points: ["Phần 1: Giới thiệu", "Phần 2: Phân tích"],
        sections: [
          {
            id: "s01",
            name: "Mở đầu",
            purpose: "Dẫn nhập",
            estimatedSeconds: 60,
          },
        ],
      };
      const resultPath = resolve(TEST_BASE, "pipeline-proj", "results", "001-outline.json");
      writeFileSync(resultPath, JSON.stringify(validOutlineResult, null, 2), "utf-8");

      // 4. Validate again -> passes and updates stage to done
      const passRes = await app.request("/projects/pipeline-proj/validate", {
        method: "POST",
      });
      expect(passRes.status).toBe(200);
      const passData = await passRes.json();
      expect(passData.success).toBe(true);
      expect(passData.results[0].status).toBe("PASSED");

      // Verify state was marked done
      const statusRes = await app.request("/projects/pipeline-proj/status");
      const statusData = await statusRes.json();
      const outlineStage = statusData.state.stages.find((s: any) => s.stage === "outline");
      expect(outlineStage.status).toBe("done");
    });
  });

  describe("Shorts, QA, Spec & SSE Endpoints", () => {
    const validSpec = {
      specVersion: "0.1.0",
      projectSlug: "media-proj",
      topicId: "sample",
      templateId: "minimal",
      fps: 30,
      narration: {
        audioPath: "audio/narration.wav",
        durationSec: 15,
        words: [
          { id: "w1", text: "Xin", startSec: 0, endSec: 5, confidence: 0.95 },
          { id: "w2", text: "chào", startSec: 5, endSec: 15, confidence: 0.92 },
        ],
      },
      chapters: [
        {
          id: "c1",
          title: "Chương 1",
          beats: [
            {
              id: "b1",
              range: { startWordId: "w1", endWordId: "w2" },
              layout: "title-card",
              assets: [],
              captions: [{ id: "cap1", wordIds: ["w1", "w2"] }],
              sfx: [],
            },
          ],
        },
      ],
      music: [],
      meta: { title: "Media Test" },
    };

    beforeEach(async () => {
      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "media-proj" }),
      });

      // Write valid spec.json
      const specPath = resolve(TEST_BASE, "media-proj", "spec.json");
      writeFileSync(specPath, JSON.stringify(validSpec, null, 2), "utf-8");
    });

    it("GET /projects/:slug/spec returns spec.json content", async () => {
      const res = await app.request("/projects/media-proj/spec");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.spec.projectSlug).toBe("media-proj");
    });

    it("POST /projects/:slug/shorts auto-detects candidates and writes short spec", async () => {
      const res = await app.request("/projects/media-proj/shorts", {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.shorts.length).toBeGreaterThan(0);
      expect(existsSync(resolve(TEST_BASE, "media-proj", data.shorts[0]))).toBe(true);
    });

    it("GET /projects/:slug/qa?gate=pre executes pre-render QA gate", async () => {
      const res = await app.request("/projects/media-proj/qa?gate=pre");
      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.gate).toBe("pre");
      expect(typeof report.passed).toBe("boolean");
      expect(Array.isArray(report.items)).toBe(true);
    });

    it("POST /projects/:slug/render returns 400 when spec file is missing", async () => {
      const res = await app.request("/projects/media-proj/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: "non-existent-spec.json" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Spec file not found");
    });

    it("GET /projects/:slug/events?once=true streams SSE log events", async () => {
      const res = await app.request("/projects/media-proj/events?once=true");
      expect(res.status).toBe(200);
      const contentType = res.headers.get("content-type");
      expect(contentType).toContain("text/event-stream");

      const bodyText = await res.text();
      expect(bodyText).toContain("event: log");
      expect(bodyText).toContain("project_created");
    });

    it("DELETE /projects/:slug deletes project and returns 200", async () => {
      // First create a dedicated project to delete
      const createRes = await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "proj-to-delete" }),
      });
      expect(createRes.status).toBe(201);
      expect(existsSync(resolve(TEST_BASE, "proj-to-delete"))).toBe(true);

      const delRes = await app.request("/projects/proj-to-delete", {
        method: "DELETE",
      });
      expect(delRes.status).toBe(200);
      const delData = await delRes.json();
      expect(delData.success).toBe(true);
      expect(delData.slug).toBe("proj-to-delete");
      expect(existsSync(resolve(TEST_BASE, "proj-to-delete"))).toBe(false);
    });

    it("DELETE /projects/:slug returns 404 for non-existent project", async () => {
      const res = await app.request("/projects/non-existent-proj", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });

    it("DELETE /projects/:slug returns 400 for invalid slug", async () => {
      const res = await app.request("/projects/invalid%20slug!", {
        method: "DELETE",
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe("AI Assistant & Asset Generation Endpoints", () => {
    it("POST /projects/:slug/ai/generate-stage-json produces valid schema JSON from prompt", async () => {
      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "ai-test-proj" }),
      });

      const res = await app.request("/projects/ai-test-proj/ai/generate-stage-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "outline",
          prompt: "Hiệu ứng Dunning-Kruger trong tâm lý học",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.stage).toBe("outline");
      expect(data.generatedJson).toBeDefined();
      expect(data.generatedJson.title).toBeDefined();
      expect(Array.isArray(data.generatedJson.sections)).toBe(true);
    });

    it("GET /projects/:slug/tasks/:taskId/result fetches saved result or returns hasResult: false", async () => {
      await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "res-test-proj" }),
      });

      // Initially no result exists
      const getRes1 = await app.request("/projects/res-test-proj/tasks/001/result?stage=outline");
      expect(getRes1.status).toBe(200);
      const data1 = await getRes1.json();
      expect(data1.hasResult).toBe(false);

      // Save a result
      const saveRes = await app.request("/projects/res-test-proj/tasks/001/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: { title: "Custom Title", sections: [] },
          stage: "outline",
        }),
      });
      expect(saveRes.status).toBe(200);

      // Now it exists
      const getRes2 = await app.request("/projects/res-test-proj/tasks/001/result?stage=outline");
      expect(getRes2.status).toBe(200);
      const data2 = await getRes2.json();
      expect(data2.hasResult).toBe(true);
      expect(data2.result.title).toBe("Custom Title");
    });

    it("POST /projects/:slug/assets/generate-ai creates asset image file and manifest entry", async () => {
      const prevKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "dummy-test-key";
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string, ...args: any[]) => {
        if (typeof url === "string" && url.includes("imagen-3.0-generate-002")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              predictions: [{ bytesBase64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }]
            })
          });
        }
        return originalFetch(url, ...args);
      });

      try {
        await app.request("/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "asset-test-proj" }),
        });

        const res = await app.request("/projects/asset-test-proj/assets/generate-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            beatId: "b1",
            prompt: "Dramatic monochrome landscape",
          }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.beatId).toBe("b1");
        expect(existsSync(resolve(TEST_BASE, "asset-test-proj", "assets/processed/b1.png"))).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
        process.env.GEMINI_API_KEY = prevKey;
      }
    });
  });
});

