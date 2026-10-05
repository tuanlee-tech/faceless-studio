import { ProjectManager } from "@faceless/core";

export interface StatusCommandOptions {
  slug: string;
  baseDir?: string;
  json?: boolean;
}

export async function runStatus(options: StatusCommandOptions): Promise<void> {
  const { slug } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio status <slug> [--json]";
    if (options.json) {
      process.stdout.write(JSON.stringify({ error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const baseDir = options.baseDir || process.env.STUDIO_BASE_DIR || "projects";
  const pm = new ProjectManager(baseDir);

  try {
    const state = pm.getState(slug);

    if (options.json) {
      process.stdout.write(JSON.stringify(state, null, 2) + "\n");
    } else {
      console.log(`\nProject: ${state.projectSlug}`);
      console.log(`Updated: ${state.updatedAt}\n`);

      const statusLabels: Record<string, string> = {
        done: "\x1b[32m✔ done\x1b[0m",
        running: "\x1b[33m⏳ running\x1b[0m",
        failed: "\x1b[31m✖ failed\x1b[0m",
        pending: "\x1b[90m⏸ pending\x1b[0m",
      };

      console.log("  Stage".padEnd(16) + "Status".padEnd(18) + "Completed");
      console.log("  " + "─".repeat(45));

      for (const stage of state.stages) {
        const displayStatus = statusLabels[stage.status] || stage.status;
        const completed = stage.completedAt ?? "-";
        const rawStatus = stage.status;
        const padding = 16 - rawStatus.length;
        console.log(`  ${stage.stage.padEnd(14)} ${displayStatus}${" ".repeat(Math.max(1, padding))} ${completed}`);
      }
      console.log();
    }

    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stdout.write(JSON.stringify({ error: message }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${message}`);
    }
    process.exit(1);
  }
}
