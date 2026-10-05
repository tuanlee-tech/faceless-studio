import { resolve } from "node:path";
import { ProjectManager } from "@faceless/core";

export interface NewCommandOptions {
  slug: string;
  topic?: string;
  template?: string;
  minutes?: number;
  formats?: string[];
  assetBudget?: number;
  qaThreshold?: number;
  voice?: string;
  speed?: number;
  baseDir?: string;
  json?: boolean;
}

export async function runNew(options: NewCommandOptions): Promise<void> {
  const { slug } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio new <slug> --topic <t> --template <tp> --minutes <m> --formats <f>";
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: errorMsg }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${errorMsg}`);
    }
    process.exit(1);
  }

  const baseDir = options.baseDir || process.env.STUDIO_BASE_DIR || "projects";
  const pm = new ProjectManager(baseDir);

  const topicId = options.topic || "sample";
  const templateId = options.template || "minimal";
  const targetMinutes = options.minutes ? Number(options.minutes) : 1;
  const formats = options.formats && options.formats.length > 0 ? options.formats : ["long-16x9"];

  try {
    pm.createProject(slug, {
      slug,
      topicId,
      templateId,
      targetMinutes,
      formats,
      assetBudget: options.assetBudget,
      qaThreshold: options.qaThreshold,
      voice: options.voice,
      speed: options.speed,
    });

    const projectDir = resolve(baseDir, slug);

    if (options.json) {
      process.stdout.write(
        JSON.stringify(
          {
            success: true,
            slug,
            projectDir,
            topicId,
            templateId,
            targetMinutes,
            formats,
            message: `Project ${slug} created successfully`,
          },
          null,
          2
        ) + "\n"
      );
    } else {
      console.log(`✅ Project created: ${slug}`);
      console.log(`   Path:     ${projectDir}`);
      console.log(`   Topic:    ${topicId}`);
      console.log(`   Template: ${templateId}`);
      console.log(`   Minutes:  ${targetMinutes}`);
      console.log(`   Formats:  ${formats.join(", ")}`);
    }

    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stdout.write(JSON.stringify({ success: false, error: message }, null, 2) + "\n");
    } else {
      console.error(`❌ Error: ${message}`);
    }
    process.exit(1);
  }
}
