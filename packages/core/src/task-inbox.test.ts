import { describe, it, expect, beforeEach } from "vitest";
import { ProjectManager } from "./project-manager.js";
import { TaskInbox } from "./task-inbox.js";
import { mkdirSync } from "node:fs";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

const TEST_BASE = "/tmp/faceless-test-core-ti";

function cleanup() {
  const p = TEST_BASE;
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

beforeEach(() => {
  cleanup();
});

describe("TaskInbox", () => {
  let pm: ProjectManager;
  let ti: TaskInbox;

  beforeEach(() => {
    pm = new ProjectManager(TEST_BASE);
    ti = new TaskInbox(TEST_BASE);
  });

  it("createTask writes task markdown file with frontmatter", () => {
    const slug = "test-task-01";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    });

    const taskPath = ti.createTask({
      slug,
      id: "task-001",
      stage: "outline",
      skill: "faceless-director",
      inputs: { topic: "vietnamese-tutorial" },
      output: { videoPath: "" },
      schema: z.object({}).describe("outline-schema"),
      prompt: "Tạo outline cho video về tema Việt Nam",
    });

    expect(fs.existsSync(taskPath)).toBe(true);
    const content = fs.readFileSync(taskPath, "utf-8");
    expect(content).toContain("---");
    expect(content).toContain("id: task-001");
    expect(content).toContain("stage: outline");
    expect(content).toContain("skill: faceless-director");
    expect(content).toContain("prompt: Tạo outline cho video về tema Việt Nam");
  });

  it("createTask throws if project does not exist", () => {
    const slug = "nonexistent-project";
    
    expect(() => {
      ti.createTask({
        slug,
        id: "task-001",
        stage: "outline",
        skill: "faceless-director",
        inputs: {},
        output: {},
        schema: z.object({}),
        prompt: "Test prompt",
      });
    }).toThrow(`Project ${slug} does not exist. Cannot create task.`);
  });

  it("validateResult passes when result conforms to schema and updates specific stage", () => {
    const slug = "test-task-02";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    });

    // Write a valid result
    const validResult = { title: "Test Outline", points: ["Point 1", "Point 2"] };
    const resultDir = path.join(TEST_BASE, slug, "results");
    mkdirSync(resultDir, { recursive: true });
    const resultPath = path.join(resultDir, "task-001.json");
    fs.writeFileSync(resultPath, JSON.stringify(validResult));

    // Define a simple schema
    const outlineSchema = z.object({
      title: z.string(),
      points: z.array(z.string()),
    });

    const result = ti.validateResult({
      slug,
      taskId: "task-001",
      stage: "outline",
      schema: outlineSchema,
    });

    expect(result.success).toBe(true);
    
    // Stage should be updated to done
    const state = pm.getState(slug);
    const outlineStage = state.stages.find(s => s.stage === "outline");
    expect(outlineStage).toBeDefined();
    expect(outlineStage!.status).toBe("done");
  });

  it("validateResult fails and creates errors.md when result invalid", () => {
    const slug = "test-task-03";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    });

    // Write an invalid result
    const invalidResult = { title: 123, points: "not-an-array" };
    const resultDir = path.join(TEST_BASE, slug, "results");
    mkdirSync(resultDir, { recursive: true });
    const resultPath = path.join(resultDir, "task-001.json");
    fs.writeFileSync(resultPath, JSON.stringify(invalidResult));

    // Define a simple schema
    const outlineSchema = z.object({
      title: z.string(),
      points: z.array(z.string()),
    });

    const result = ti.validateResult({
      slug,
      taskId: "task-001",
      stage: "outline",
      schema: outlineSchema,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Check that errors.md was created
    const errorsPath = path.join(TEST_BASE, slug, "results", "task-001-errors.md");
    expect(fs.existsSync(errorsPath)).toBe(true);

    // Stage should NOT be updated to done
    const state = pm.getState(slug);
    const outlineStage = state.stages.find(s => s.stage === "outline");
    expect(outlineStage!.status).toBe("pending");
  });

  it("validateResult fails when result file not found", () => {
    const slug = "test-task-04";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    });

    const outlineSchema = z.object({ title: z.string() });

    const result = ti.validateResult({
      slug,
      taskId: "nonexistent-task",
      stage: "outline",
      schema: outlineSchema,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});
