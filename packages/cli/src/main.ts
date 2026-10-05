#!/usr/bin/env node
/**
 * Faceless Studio CLI entry point.
 * Commands: doctor, new, status, run, tasks, validate, assets, render, shorts, qa
 */

import { runDoctor } from "./commands/doctor.js";
import { runNew } from "./commands/new.js";
import { runStatus } from "./commands/status.js";
import { runRun } from "./commands/run.js";
import { runValidate } from "./commands/validate.js";
import { runRender } from "./commands/render.js";
import { runAssets } from "./commands/assets.js";
import { parseArgs } from "./utils/parse-args.js";

const { command, positionals, flags } = parseArgs(process.argv.slice(2));
const jsonFlag = Boolean(flags.json);

switch (command) {
  case "doctor":
    await runDoctor({ json: jsonFlag });
    break;

  case "new": {
    const slug = positionals[0];
    const formatsStr = typeof flags.formats === "string" ? flags.formats : undefined;
    const formats = formatsStr
      ? formatsStr.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    await runNew({
      slug,
      topic: typeof flags.topic === "string" ? flags.topic : undefined,
      template: typeof flags.template === "string" ? flags.template : undefined,
      minutes: flags.minutes ? Number(flags.minutes) : undefined,
      formats,
      assetBudget: flags["asset-budget"] ? Number(flags["asset-budget"]) : undefined,
      qaThreshold: flags["qa-threshold"] ? Number(flags["qa-threshold"]) : undefined,
      voice: typeof flags.voice === "string" ? flags.voice : undefined,
      speed: flags.speed ? Number(flags.speed) : undefined,
      baseDir: typeof flags["base-dir"] === "string" ? flags["base-dir"] : undefined,
      json: jsonFlag,
    });
    break;
  }

  case "status": {
    const slug = positionals[0];
    await runStatus({
      slug,
      baseDir: typeof flags["base-dir"] === "string" ? flags["base-dir"] : undefined,
      json: jsonFlag,
    });
    break;
  }

  case "run": {
    const slug = positionals[0];
    const stage = positionals[1] || (typeof flags.stage === "string" ? flags.stage : undefined);
    await runRun({
      slug,
      stage,
      baseDir: typeof flags["base-dir"] === "string" ? flags["base-dir"] : undefined,
      json: jsonFlag,
    });
    break;
  }

  case "validate": {
    const slug = positionals[0];
    const taskId = positionals[1] || (typeof flags["task-id"] === "string" ? flags["task-id"] : undefined);
    await runValidate({
      slug,
      taskId,
      baseDir: typeof flags["base-dir"] === "string" ? flags["base-dir"] : undefined,
      json: jsonFlag,
    });
    break;
  }

  case "assets": {
    const slug = positionals[0];
    const action = positionals[1] || (typeof flags.action === "string" ? flags.action : undefined);
    await runAssets({
      slug,
      action,
      baseDir: typeof flags["base-dir"] === "string" ? flags["base-dir"] : undefined,
      json: jsonFlag,
    });
    break;
  }

  case "render": {
    const slug = positionals[0];
    const format = (typeof flags.format === "string" ? flags.format : undefined) as
      | "long-16x9"
      | "short-9x16"
      | undefined;
    const chapter = typeof flags.chapter === "string" ? flags.chapter : undefined;
    await runRender({
      slug,
      format,
      chapter,
      baseDir: typeof flags["base-dir"] === "string" ? flags["base-dir"] : undefined,
      json: jsonFlag,
    });
    break;
  }

  default:
    if (command) {
      console.error(`Unknown command: ${command}`);
    }
    console.log("Usage: studio <command> [options]");
    console.log("Commands: doctor, new, status, run, validate, assets, render");
    process.exit(command ? 1 : 0);
}