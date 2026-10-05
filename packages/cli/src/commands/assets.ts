import { resolve } from "node:path";
import { existsSync, appendFileSync } from "node:fs";
import { AssetManager } from "@faceless/core";

export interface AssetsOptions {
  slug?: string;
  action?: string;
  baseDir?: string;
  json?: boolean;
}

export async function runAssets(options: AssetsOptions): Promise<void> {
  const { slug, action, baseDir, json = false } = options;

  if (!slug) {
    if (json) {
      console.log(JSON.stringify({ success: false, error: "Project slug is required" }));
    } else {
      console.error("Error: Project slug is required. Usage: studio assets <slug> export|import");
    }
    process.exit(1);
  }

  const projectsDir = baseDir ? resolve(baseDir) : resolve(process.cwd(), "projects");
  const projectDir = resolve(projectsDir, slug);

  if (!existsSync(projectDir)) {
    if (json) {
      console.log(
        JSON.stringify({
          success: false,
          error: `Project not found at: ${projectDir}`,
        }),
      );
    } else {
      console.error(`Error: Project '${slug}' not found at: ${projectDir}`);
    }
    process.exit(1);
  }

  if (!action || (action !== "export" && action !== "import")) {
    if (json) {
      console.log(
        JSON.stringify({
          success: false,
          error: "Action must be either 'export' or 'import'. Usage: studio assets <slug> export|import",
        }),
      );
    } else {
      console.error(
        "Error: Invalid or missing action. Action must be either 'export' or 'import'. Usage: studio assets <slug> export|import",
      );
    }
    process.exit(1);
  }

  const assetManager = new AssetManager(projectsDir);

  if (action === "export") {
    const result = assetManager.exportPromptPack(slug);

    // Log to events.jsonl
    const eventsPath = resolve(projectDir, "events.jsonl");
    const event = {
      type: "assets_exported",
      slug,
      promptPackPath: result.path,
      visualCount: result.count,
      timestamp: new Date().toISOString(),
    };
    appendFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");

    if (json) {
      console.log(
        JSON.stringify({
          success: true,
          action: "export",
          slug,
          path: result.path,
          count: result.count,
        }),
      );
    } else {
      console.log(`[Assets] Exported prompt pack for '${slug}' (${result.count} visuals)`);
      console.log(`[Assets] Prompt pack saved to: ${result.path}`);
    }
    return;
  }

  if (action === "import") {
    const result = assetManager.importAssets(slug);

    // Log to events.jsonl
    const eventsPath = resolve(projectDir, "events.jsonl");
    const event = {
      type: "assets_imported",
      slug,
      count: result.count,
      importedAssets: result.imported.map((a) => a.id),
      timestamp: new Date().toISOString(),
    };
    appendFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");

    if (json) {
      console.log(
        JSON.stringify({
          success: true,
          action: "import",
          slug,
          count: result.count,
          imported: result.imported,
        }),
      );
    } else {
      console.log(
        `[Assets] Successfully imported ${result.count} assets into 'projects/${slug}/assets/processed/'`,
      );
      if (result.count > 0) {
        for (const item of result.imported) {
          console.log(`  - [${item.id}] ${item.fileName} (${item.license})`);
        }
      } else {
        console.log(`[Assets] No valid images found in 'projects/${slug}/assets/incoming/'.`);
      }
    }
  }
}
