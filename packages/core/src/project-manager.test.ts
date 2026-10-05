import { describe, it, expect, beforeEach } from "vitest";
import { ProjectManager } from "./project-manager.js";
import { mkdirSync } from "node:fs";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

const TEST_BASE = "/tmp/faceless-test-core-pm";

function cleanup() {
  const p = TEST_BASE;
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

beforeEach(() => {
  cleanup();
});

describe("ProjectManager", () => {
  let pm: ProjectManager;

  beforeEach(() => {
    pm = new ProjectManager(TEST_BASE);
  });

  it("createProject creates directory structure and files", () => {
    const slug = "test-project-01";
    const config = {
      slug,
      topicId: "vi-tutorial",
      templateId: "minimal",
      targetMinutes: 10,
      formats: ["long-16x9"],
    };

    pm.createProject(slug, config);

    // Check directory structure
    const projectDir = path.join(TEST_BASE, slug);
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "tasks"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "results"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "script"))).toBe(true);

    // Check project.json
    const projectJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "project.json"), "utf-8")
    );
    expect(projectJson.slug).toBe(slug);
    expect(projectJson.topicId).toBe("vi-tutorial");
    expect(projectJson.formats).toEqual(["long-16x9"]);

    // Check state.json
    const stateJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "state.json"), "utf-8")
    );
    expect(stateJson.projectSlug).toBe(slug);
    // stages: outline, script, direct, spec, long-16x9 (5 stages)
    expect(stateJson.stages).toHaveLength(5);
    expect(stateJson.stages[0].stage).toBe("outline");
    expect(stateJson.updatedAt).toBeDefined();

    // Check events.jsonl
    const eventsPath = path.join(projectDir, "events.jsonl");
    expect(fs.existsSync(eventsPath)).toBe(true);
    const eventsContent = fs.readFileSync(eventsPath, "utf-8").trim().split("\n");
    expect(eventsContent.length).toBeGreaterThanOrEqual(1);
    const event = JSON.parse(eventsContent[0]);
    expect(event.type).toBe("project_created");
    expect(event.slug).toBe(slug);
  });

  it("getState reads state.json correctly", () => {
    const slug = "test-project-02";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    });

    const state = pm.getState(slug);
    expect(state.projectSlug).toBe(slug);
    expect(state.stages).toHaveLength(5);
    expect(state.stages[4].stage).toBe("long-16x9");
    expect(state.stages[4].status).toBe("pending");
  });

  it("updateStage updates stage status", () => {
    const slug = "test-project-03";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9", "short-9x16"],
    });

    // Initially pending
    let state = pm.getState(slug);
    expect(state.stages[0].status).toBe("pending"); // outline
    expect(state.stages[4].status).toBe("pending"); // long-16x9

    // Update first stage to running
    pm.updateStage(slug, "outline", { status: "running" });
    state = pm.getState(slug);
    expect(state.stages[0].status).toBe("running");
    expect(state.stages[4].status).toBe("pending");

    // Update another stage to done
    pm.updateStage(slug, "long-16x9", { status: "done" });
    state = pm.getState(slug);
    expect(state.stages[0].status).toBe("running");
    expect(state.stages[4].status).toBe("done");
  });

  it("updateStage throws for unknown stage", () => {
    const slug = "test-project-04";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    });

    expect(() => pm.updateStage(slug, "nonexistent", { status: "done" })).toThrow(
      "Stage nonexistent not found in project test-project-04"
    );
  });

  it("createProject throws if project already exists", () => {
    const slug = "test-project-05";
    pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    });

    expect(() => pm.createProject(slug, {
      slug,
      topicId: "test",
      templateId: "minimal",
      targetMinutes: 5,
      formats: ["long-16x9"],
    })).toThrow(`Project ${slug} already exists`);
  });
});