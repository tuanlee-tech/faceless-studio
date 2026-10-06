import { ProjectManager } from "@faceless/core";

export interface DeleteCommandOptions {
  slug?: string;
  baseDir?: string;
  json?: boolean;
}

export async function runDelete(options: DeleteCommandOptions): Promise<void> {
  const { slug } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio delete <slug> [--json]";
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const baseDir = options.baseDir || process.env.STUDIO_BASE_DIR || "projects";
  const pm = new ProjectManager(baseDir);

  try {
    pm.deleteProject(slug);

    if (options.json) {
      process.stdout.write(
        JSON.stringify(
          {
            success: true,
            slug,
            message: `Project "${slug}" deleted successfully`,
          },
          null,
          2
        ) + "\n"
      );
    } else {
      console.log(`\x1b[32m✔\x1b[0m Project "${slug}" deleted successfully.`);
    }

    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stdout.write(
        JSON.stringify({ success: false, slug, error: message }, null, 2) + "\n"
      );
    } else {
      console.error(`❌ Error: ${message}`);
    }
    process.exit(1);
  }
}
