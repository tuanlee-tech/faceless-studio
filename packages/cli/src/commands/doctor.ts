import { checkBinary, type CheckResult } from "../utils/check-binary.js";
import { platform } from "node:os";

const checks = [
  {
    name: "node",
    versionArgs: ["--version"],
    pattern: /v(\d+\.\d+\.\d+)/,
    minMajor: 22,
    fix: { windows: "winget install OpenJS.NodeJS.LTS", ubuntu: "sudo apt install -y nodejs" },
  },
  {
    name: "pnpm",
    versionArgs: ["--version"],
    pattern: /(\d+\.\d+\.\d+)/,
    fix: { windows: "npm i -g pnpm", ubuntu: "npm i -g pnpm" },
  },
  {
    name: platform() === "win32" ? "python" : "python3",
    versionArgs: ["--version"],
    pattern: /Python (\d+\.\d+\.\d+)/,
    minMajor: 3,
    minMinor: 10,
    fix: { windows: "winget install Python.Python.3.12", ubuntu: "sudo apt install -y python3" },
  },
  {
    name: "uv",
    versionArgs: ["--version"],
    pattern: /uv (\d+\.\d+\.\d+)/,
    fix: { windows: 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"', ubuntu: "curl -LsSf https://astral.sh/uv/install.sh | sh" },
  },
  {
    name: "ffmpeg",
    versionArgs: ["-version"],
    pattern: /ffmpeg version (\S+)/,
    fix: { windows: "winget install Gyan.FFmpeg", ubuntu: "sudo apt install -y ffmpeg" },
  },
  {
    name: "ffprobe",
    versionArgs: ["-version"],
    pattern: /ffprobe version (\S+)/,
    fix: { windows: "(included with ffmpeg)", ubuntu: "(included with ffmpeg)" },
  },
];

export async function runDoctor(options: { json: boolean }): Promise<void> {
  const results: CheckResult[] = [];

  for (const check of checks) {
    const result = await checkBinary(check.name, check.versionArgs, check.pattern, check.fix);
    results.push(result);
  }

  const allPassed = results.every((r) => r.found);

  if (options.json) {
    process.stdout.write(JSON.stringify({ checks: results, allPassed }, null, 2));
  } else {
    for (const r of results) {
      const icon = r.found ? "✅" : "❌";
      const ver = r.version ? ` (${r.version})` : "";
      const fixMsg = !r.found && r.fix
        ? ` → fix: ${platform() === "win32" ? r.fix.windows : r.fix.ubuntu}`
        : "";
      console.log(`${icon} ${r.name}${ver}${fixMsg}`);
    }
    console.log(allPassed ? "\n🎉 All checks passed!" : "\n⚠️  Some checks failed. See fix suggestions above.");
  }

  process.exit(allPassed ? 0 : 1);
}