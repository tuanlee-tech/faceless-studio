import {
  ProjectManager,
  TaskInbox,
  OutlineResultSchema,
  ScriptResultSchema,
  DirectResultSchema,
  VideoSpecSchema,
  z,
} from "@faceless/core";

export interface ValidateCommandOptions {
  slug: string;
  taskId?: string;
  baseDir?: string;
  json?: boolean;
}

interface ValidationItem {
  taskId: string;
  stage: string;
  status: "PASSED" | "FAILED";
  error?: string;
}

const SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  outline: OutlineResultSchema,
  script: ScriptResultSchema,
  direct: DirectResultSchema,
  spec: VideoSpecSchema,
};

export async function runValidate(options: ValidateCommandOptions): Promise<void> {
  const { slug, taskId } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio validate <slug> [taskId] [--json]";
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

  try {
    pm.getState(slug);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${message}`);
    }
    process.exit(1);
  }

  const allTasks = ti.listTasks(slug);

  if (allTasks.length === 0) {
    const errorMsg = `No tasks found in project '${slug}' to validate.`;
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const tasksToValidate = taskId
    ? allTasks.filter((t) => t.id === taskId)
    : allTasks;

  if (tasksToValidate.length === 0) {
    const errorMsg = `Task '${taskId}' not found in project '${slug}'.`;
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const results: ValidationItem[] = [];
  let allPassed = true;

  if (!options.json) {
    console.log(`\nValidating tasks for project: ${slug}`);
    console.log("─".repeat(50));
  }

  for (const task of tasksToValidate) {
    const schema = SCHEMA_MAP[task.stage] || z.record(z.unknown()).describe(`${task.stage}-schema`);
    const valResult = ti.validateResult({
      slug,
      taskId: task.id,
      stage: task.stage,
      schema,
    });

    if (valResult.success) {
      results.push({
        taskId: task.id,
        stage: task.stage,
        status: "PASSED",
      });
      if (!options.json) {
        console.log(`  ✅ [PASSED] Task ${task.id} (stage: ${task.stage})`);
      }
    } else {
      allPassed = false;
      results.push({
        taskId: task.id,
        stage: task.stage,
        status: "FAILED",
        error: valResult.error,
      });
      if (!options.json) {
        console.log(`  ❌ [FAILED] Task ${task.id} (stage: ${task.stage}): ${valResult.error}`);
      }
    }
  }

  if (!options.json) {
    console.log("─".repeat(50));
    if (allPassed) {
      console.log(`🎉 All validated tasks PASSED. State updated.\n`);
    } else {
      console.log(`⚠️ Some tasks FAILED validation. Review results/*-errors.md\n`);
    }
  }

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          success: allPassed,
          slug,
          results,
        },
        null,
        2
      ) + "\n"
    );
  }

  process.exit(allPassed ? 0 : 1);
}
