import { writeFileSync, appendFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { Schema, z } from "zod";
import yaml from "js-yaml";

import { ProjectConfigSchema } from "./schemas/project-config.js";
import { ProjectStateSchema, StageEntrySchema, StageStatusSchema } from "./schemas/stage-state.js";

export interface ProjectConfig {
  slug: string;
  topicId: string;
  templateId: string;
  targetMinutes: number;
  formats: string[];
  assetBudget?: number;
  qaThreshold?: number;
  voice?: string;
  speed?: number;
  createdAt?: string;
}

export interface ProjectState {
  projectSlug: string;
  stages: Array<{ stage: string; status: string; inputHash?: string; outputHash?: string; completedAt?: string; error?: string }>;
  updatedAt: string;
}

export class ProjectManager {
  public readonly baseDir: string;

  constructor(baseDir: string = "projects") {
    this.baseDir = baseDir;
  }

  createProject(slug: string, config: ProjectConfig): void {
    const projectDir = resolve(this.baseDir, slug);

    if (existsSync(projectDir)) {
      throw new Error(`Project ${slug} already exists`);
    }

    // Create directory structure
    mkdirSync(resolve(projectDir, "tasks"), { recursive: true });
    mkdirSync(resolve(projectDir, "results"), { recursive: true });
    mkdirSync(resolve(projectDir, "script"), { recursive: true });

    // Write project.json
    const projectConfig = {
      ...config,
      createdAt: new Date().toISOString(),
    };
    const projectConfigSanitized = ProjectConfigSchema.parse(projectConfig);
    writeFileSync(resolve(projectDir, "project.json"), JSON.stringify(projectConfigSanitized, null, 2));

    // Initialize state.json with pending stages
    const pipelineStages = ["outline", "script", "direct", "tts", "spec"];
    const formatStages = projectConfigSanitized.formats;
    const allStages = [...pipelineStages, ...formatStages];

    const initialStages = allStages.map((st: string) => ({
      stage: st,
      status: "pending" as const,
      inputHash: undefined,
      outputHash: undefined,
      completedAt: undefined,
      error: undefined,
    }));

    const initialState: ProjectState = {
      projectSlug: slug,
      stages: initialStages,
      updatedAt: new Date().toISOString(),
    };

    const stateSanitized = ProjectStateSchema.parse(initialState);
    writeFileSync(resolve(projectDir, "state.json"), JSON.stringify(stateSanitized, null, 2));

    // Initialize events.jsonl
    const eventsPath = resolve(projectDir, "events.jsonl");
    const initialEvent = JSON.stringify({
      type: "project_created",
      slug,
      timestamp: new Date().toISOString(),
    });
    writeFileSync(eventsPath, initialEvent + "\n", "utf-8");
  }

  recordEvent(slug: string, event: Record<string, unknown>): void {
    const eventsPath = resolve(this.baseDir, slug, "events.jsonl");
    const entry = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });
    appendFileSync(eventsPath, entry + "\n", "utf-8");
  }

  getState(slug: string): ProjectState {
    const statePath = resolve(this.baseDir, slug, "state.json");
    const content = readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(content);
    return ProjectStateSchema.parse(parsed);
  }

  updateStage(slug: string, stage: string, patch: Partial<ProjectState["stages"][number]>): void {
    const state = this.getState(slug);
    const stageIndex = state.stages.findIndex((s) => s.stage === stage);

    if (stageIndex === -1) {
      throw new Error(`Stage ${stage} not found in project ${slug}`);
    }

    const updatedStage = {
      ...state.stages[stageIndex],
      ...patch,
      status: patch.status ?? state.stages[stageIndex].status,
    };

    state.stages[stageIndex] = updatedStage;
    state.updatedAt = new Date().toISOString();

    const projectDir = resolve(this.baseDir, slug);
    const statePath = resolve(projectDir, "state.json");
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    this.recordEvent(slug, {
      type: "stage_updated",
      stage,
      status: updatedStage.status,
    });
  }

  deleteProject(slug: string): void {
    if (!slug || typeof slug !== "string" || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
      throw new Error(`Invalid project slug: ${slug}`);
    }

    const projectDir = resolve(this.baseDir, slug);
    const baseResolved = resolve(this.baseDir);

    // Prevent directory traversal
    if (!projectDir.startsWith(baseResolved)) {
      throw new Error(`Forbidden project path traversal: ${slug}`);
    }

    if (!existsSync(projectDir)) {
      throw new Error(`Project ${slug} not found`);
    }

    rmSync(projectDir, { recursive: true, force: true });
  }
}