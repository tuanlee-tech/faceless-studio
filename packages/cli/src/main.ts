#!/usr/bin/env node
/**
 * Faceless Studio CLI entry point.
 * Commands: doctor, new, status, run, tasks, validate, assets, render, shorts, qa
 */

import { runDoctor } from "./commands/doctor.js";

const [command, ...args] = process.argv.slice(2);
const jsonFlag = args.includes("--json");

switch (command) {
  case "doctor":
    await runDoctor({ json: jsonFlag });
    break;
  default:
    if (command) {
      console.error(`Unknown command: ${command}`);
    }
    console.log("Usage: studio <command> [options]");
    console.log("Commands: doctor");
    process.exit(command ? 1 : 0);
}