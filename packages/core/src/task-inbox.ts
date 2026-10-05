import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { Schema, ZodError } from "zod";

import { ProjectManager } from "./project-manager.js";

export interface TaskInboxCreateTaskParams {
  slug: string;
  id: string;
  stage: string;
  skill: string;
  inputs: Record<string, unknown>;
  output: Record<string, unknown>;
  schema: Schema<any, any>;
  prompt: string;
}

export interface TaskItem {
  id: string;
  stage: string;
  skill: string;
  schema?: string;
  prompt?: string;
  inputs?: Record<string, unknown>;
  output?: Record<string, unknown>;
  filePath: string;
}

export interface TaskInboxValidateResultParams {
  slug: string;
  taskId: string;
  stage: string;
  schema: Schema<any, any>;
}

export class TaskInbox {
  private pm: ProjectManager;

  constructor(baseDir: string = "projects") {
    this.pm = new ProjectManager(baseDir);
  }

  listTasks(slug: string): TaskItem[] {
    const tasksDir = resolve(this.pm.baseDir, slug, "tasks");
    if (!existsSync(tasksDir)) {
      return [];
    }

    const files = readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
    const tasks: TaskItem[] = [];

    for (const file of files) {
      const filePath = resolve(tasksDir, file);
      try {
        const content = readFileSync(filePath, "utf-8");
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
          const frontmatter = yaml.load(match[1]) as Record<string, any>;
          if (frontmatter && frontmatter.id && frontmatter.stage) {
            tasks.push({
              id: String(frontmatter.id),
              stage: String(frontmatter.stage),
              skill: String(frontmatter.skill || ""),
              schema: frontmatter.schema ? String(frontmatter.schema) : undefined,
              prompt: frontmatter.prompt ? String(frontmatter.prompt) : undefined,
              inputs: frontmatter.inputs,
              output: frontmatter.output,
              filePath,
            });
          }
        }
      } catch {
        // ignore malformed task file
      }
    }

    return tasks;
  }

  createTask(params: TaskInboxCreateTaskParams): string {
    const { slug, id, stage, skill, inputs, output, schema, prompt } = params;

    if (!existsSync(resolve(this.pm.baseDir, slug))) {
      throw new Error(`Project ${slug} does not exist. Cannot create task.`);
    }

    const taskPath = resolve(this.pm.baseDir, slug, "tasks", `${id}-${stage}.md`);

    const frontmatter = {
      id,
      stage,
      skill,
      inputs,
      output,
      schema: schema.description || (schema._def as { typeName?: string })?.typeName || "unknown",
      prompt,
    };

    const content = `---\n${yaml.dump(frontmatter)}\n---\n`;

    mkdirSync(resolve(this.pm.baseDir, slug, "tasks"), { recursive: true });
    writeFileSync(taskPath, content, "utf-8");

    return taskPath;
  }

  validateResult(params: TaskInboxValidateResultParams): { success: boolean; error?: string } {
    const { slug, taskId, stage, schema } = params;

    // Read the results file - check <taskId>.json or <taskId>-<stage>.json in results/
    let resultPath = resolve(this.pm.baseDir, slug, "results", `${taskId}.json`);
    if (!existsSync(resultPath)) {
      const altPath = resolve(this.pm.baseDir, slug, "results", `${taskId}-${stage}.json`);
      if (existsSync(altPath)) {
        resultPath = altPath;
      }
    }

    if (!existsSync(resultPath)) {
      return { success: false, error: `Result file not found: ${resultPath}` };
    }

    const content = readFileSync(resultPath, "utf-8");
    let result: unknown;

    try {
      result = JSON.parse(content);
    } catch (e) {
      return { success: false, error: `Invalid JSON in ${resultPath}` };
    }

    try {
      schema.parse(result);
      // Success - update stage to done
      this.pm.updateStage(slug, stage, { status: "done" });
      return { success: true };
    } catch (e: unknown) {
      if (e instanceof ZodError) {
        const errorDetails = e.errors.map((err) => `${err.path.map(String).join(".")}: ${err.message}`).join("; ");
        const errorsPath = resolve(this.pm.baseDir, slug, "results", `${taskId}-errors.md`);

        const errorContent = `
# Validation Error for Task ${taskId}

## Schema Validation Failed

\`\`\`
${errorDetails}
\`\`\`

The task result does not conform to the expected schema. Please fix the result and run \`studio validate${slug}\` again.
`.trim();

        mkdirSync(resolve(this.pm.baseDir, slug, "results"), { recursive: true });
        writeFileSync(errorsPath, errorContent, "utf-8");

        // Do NOT update stage to done on validation failure
        return { success: false, error: errorDetails };
      }
      throw e;
    }
  }
}