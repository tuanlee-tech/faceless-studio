import { resolve } from "node:path";
import {
  ProjectManager,
  QAManager,
  type QAMediaInspector,
  type QAReport,
} from "@faceless/core";
import { getDuration, measureLoudness } from "@faceless/media";

export interface QaCommandOptions {
  slug?: string;
  pre?: boolean;
  post?: boolean;
  spec?: string;
  format?: string;
  video?: string;
  baseDir?: string;
  json?: boolean;
}

export async function runQa(options: QaCommandOptions): Promise<void> {
  const { slug } = options;

  if (!slug) {
    const errorMsg = "Missing required argument: <slug>. Usage: studio qa <slug> [--pre|--post] [--json]";
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

  const projectDir = resolve(baseDir, slug);
  const qaManager = new QAManager(baseDir);

  // If --post is explicitly requested, run post-render gate. Otherwise default to pre-render.
  const isPost = Boolean(options.post);
  let report: QAReport;

  if (isPost) {
    const mediaInspector: QAMediaInspector = {
      probeDuration: async (filePath: string) => {
        return getDuration(filePath);
      },
      measureLoudness: async (filePath: string) => {
        const info = await measureLoudness(filePath);
        return { input_i: info.input_i, input_tp: info.input_tp };
      },
    };

    report = await qaManager.runPostRenderQA(projectDir, mediaInspector, {
      videoPath: options.video,
      specFileName: options.spec,
    });
  } else {
    report = await qaManager.runPreRenderQA(projectDir, {
      specFileName: options.spec,
    });
  }

  // Record event
  try {
    pm.recordEvent(slug, {
      type: "qa_checked",
      gate: report.gate,
      passed: report.passed,
      summary: report.summary,
    });
  } catch {}

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const gateLabel = report.gate === "pre" ? "PRE-RENDER" : "POST-RENDER";
    console.log(`\n============================================================`);
    console.log(`QA Gate: [${gateLabel}] for project: "${slug}"`);
    console.log(`Result:  ${report.passed ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`Summary: ${report.summary.total} checks | ${report.summary.errors} errors | ${report.summary.warnings} warnings`);
    console.log(`============================================================`);

    if (report.items.length === 0) {
      console.log(`✨ All quality checks passed with zero issues!\n`);
    } else {
      console.log(`Details:`);
      for (const item of report.items) {
        const icon = item.severity === "error" ? "❌ [ERROR]" : "⚠️  [WARN] ";
        console.log(`  ${icon} [${item.category.padEnd(16)}] ${item.message}`);
      }
      console.log();
    }
  }

  process.exit(report.passed ? 0 : 1);
}
