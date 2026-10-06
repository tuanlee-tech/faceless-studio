import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { createApp } from "@faceless/server/app";
import { api } from "../api/client.js";

const TEST_BASE = resolve(tmpdir(), "faceless-web-test-" + Date.now());

describe("Web UI Foundation & API Client (@faceless/web)", () => {
  let app: ReturnType<typeof createApp>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    if (existsSync(TEST_BASE)) {
      rmSync(TEST_BASE, { recursive: true, force: true });
    }
    mkdirSync(TEST_BASE, { recursive: true });

    // Initialize real server instance pointing to isolated test directory
    app = createApp({ baseDir: TEST_BASE });

    // Route fetch calls directly to in-memory Hono app
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = input.toString();
      const pathAndQuery = urlStr.replace(/^https?:\/\/[^/]+/, "");
      return app.request(pathAndQuery, init);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (existsSync(TEST_BASE)) {
      rmSync(TEST_BASE, { recursive: true, force: true });
    }
  });

  describe("API Client <-> Server Integration", () => {
    it("checkHealth returns server uptime and ok status", async () => {
      const res = await api.checkHealth();
      expect(res.status).toBe("ok");
      expect(typeof res.uptime).toBe("number");
    });

    it("getTemplates returns available templates list", async () => {
      const templates = await api.getTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.id === "minimal")).toBe(true);
    });

    it("getTopics returns available topics list", async () => {
      const topics = await api.getTopics();
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.some((t) => t.id === "sample")).toBe(true);
    });

    it("getProjects returns empty array when no projects exist", async () => {
      const projects = await api.getProjects();
      expect(projects).toEqual([]);
    });

    it("createProject creates a new project and physically produces files on disk", async () => {
      const slug = "web-demo-project";
      const result = await api.createProject({
        slug,
        topic: "psychology",
        template: "minimal",
        minutes: 2,
        formats: ["long-16x9"],
      });

      expect(result.success).toBe(true);
      expect(result.project.slug).toBe(slug);
      expect(result.project.config.topicId).toBe("psychology");
      expect(result.project.config.targetMinutes).toBe(2);

      // Verify physical directory and files created on disk (Acceptance criteria)
      const projectDir = resolve(TEST_BASE, slug);
      expect(existsSync(projectDir)).toBe(true);
      expect(existsSync(resolve(projectDir, "project.json"))).toBe(true);
      expect(existsSync(resolve(projectDir, "state.json"))).toBe(true);
      expect(existsSync(resolve(projectDir, "events.jsonl"))).toBe(true);
      expect(existsSync(resolve(projectDir, "tasks"))).toBe(true);
      expect(existsSync(resolve(projectDir, "results"))).toBe(true);
    });

    it("createProject throws error if slug is already taken", async () => {
      await api.createProject({ slug: "duplicate-web-proj" });

      await expect(api.createProject({ slug: "duplicate-web-proj" })).rejects.toThrow(
        /already exists/
      );
    });

    it("getProjects and getProject return newly created project details", async () => {
      await api.createProject({
        slug: "project-in-list",
        topic: "history",
        minutes: 3,
      });

      const list = await api.getProjects();
      expect(list.length).toBe(1);
      expect(list[0].slug).toBe("project-in-list");
      expect(list[0].config?.topicId).toBe("history");

      const detail = await api.getProject("project-in-list");
      expect(detail.project.slug).toBe("project-in-list");
      expect(detail.project.config?.targetMinutes).toBe(3);
    });

    it("getStatus returns pipeline stages state", async () => {
      await api.createProject({ slug: "status-test-proj" });
      const state = await api.getStatus("status-test-proj");
      expect(state.projectSlug).toBe("status-test-proj");
      expect(state.stages.length).toBeGreaterThan(0);
      expect(state.stages[0].stage).toBe("outline");
    });

    it("runStage creates task file in tasks/ directory", async () => {
      await api.createProject({ slug: "run-stage-proj" });
      const runRes = await api.runStage("run-stage-proj", "outline");
      expect(runRes.success).toBe(true);
      expect(runRes.status).toBe("running");
      expect(runRes.taskId).toBe("001");

      const tasks = await api.getTasks("run-stage-proj");
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe("001");
      expect(tasks[0].stage).toBe("outline");
    });

    it("getEventsUrl generates proper SSE endpoint URL", () => {
      const url = api.getEventsUrl("my-slug");
      expect(url).toContain("/projects/my-slug/events");
    });

    it("Task 4.3: saveTaskResult and validateTasks completes the pipeline stage", async () => {
      const slug = "inbox-test-proj";
      await api.createProject({ slug });
      await api.runStage(slug, "outline");

      // Save result JSON
      const saveRes = await api.saveTaskResult(slug, "001", {
        title: "Dàn ý hoàn chỉnh",
        points: ["Phần 1: Giới thiệu"],
        sections: [{ id: "s1", name: "Mở đầu" }],
      }, "outline");
      expect(saveRes.success).toBe(true);

      // Validate
      const valRes = await api.validateTasks(slug, "001");
      expect(valRes.success).toBe(true);
      expect(valRes.results[0].status).toBe("PASSED");

      // Verify stage becomes done
      const state = await api.getStatus(slug);
      const outlineStage = state.stages.find((s) => s.stage === "outline");
      expect(outlineStage?.status).toBe("done");
    });

    it("Task 4.3: getTaskErrors reads errors.md when validation fails", async () => {
      const slug = "error-test-proj";
      await api.createProject({ slug });
      await api.runStage(slug, "outline");

      // Save invalid result (missing required title)
      await api.saveTaskResult(slug, "001", { invalidField: 123 }, "outline");
      const valRes = await api.validateTasks(slug, "001");
      expect(valRes.success).toBe(false);

      const errRes = await api.getTaskErrors(slug, "001");
      expect(errRes.hasErrors).toBe(true);
      expect(errRes.content).toContain("Validation Error");
    });

    it("Task 4.4: exportPromptPack, uploadAsset, and getAssetManifest manage visual assets", async () => {
      const slug = "asset-test-proj";
      await api.createProject({ slug });

      // Export Prompt pack
      const exportRes = await api.exportPromptPack(slug);
      expect(exportRes.success).toBe(true);
      expect(typeof exportRes.promptPack).toBe("string");

      // Upload image asset (1x1 transparent png in base64)
      const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const uploadRes = await api.uploadAsset(slug, "b1.png", pngBase64);
      expect(uploadRes.success).toBe(true);
      expect(uploadRes.count).toBe(1);
      expect(uploadRes.imported[0].id).toBe("b1");

      // Check manifest
      const manifestRes = await api.getAssetManifest(slug);
      expect(manifestRes.success).toBe(true);
      expect(manifestRes.manifest.assets.length).toBe(1);
      expect(manifestRes.manifest.assets[0].fileName).toBe("b1.png");

      // Verify file serving URL
      const fileUrl = api.getFileUrl(slug, "assets/processed/b1.png");
      expect(fileUrl).toContain(`/projects/${slug}/files/assets/processed/b1.png`);
    });

    it("Task 4.5: getQA and render endpoints function properly", async () => {
      const slug = "qa-render-test-proj";
      await api.createProject({ slug });

      // Pre-Render QA
      const qaRes = await api.getQA(slug, "pre");
      expect(typeof qaRes.passed).toBe("boolean");
      expect(Array.isArray(qaRes.items)).toBe(true);

      // Render returns error if spec is missing
      await expect(api.render(slug, { spec: "non-existent.json" })).rejects.toThrow();
    });

    it("deleteProject successfully deletes project and verifies removal", async () => {
      const slug = "web-delete-test-proj";
      await api.createProject({ slug });

      // Verify project is in list
      let projects = await api.getProjects();
      expect(projects.some((p) => p.slug === slug)).toBe(true);

      // Delete project
      const delRes = await api.deleteProject(slug);
      expect(delRes.success).toBe(true);
      expect(delRes.slug).toBe(slug);

      // Verify project is no longer in list
      projects = await api.getProjects();
      expect(projects.some((p) => p.slug === slug)).toBe(false);
    });
  });
});
