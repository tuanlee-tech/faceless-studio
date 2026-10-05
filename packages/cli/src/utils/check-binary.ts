import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CheckResult {
  name: string;
  found: boolean;
  version?: string;
  path?: string;
  error?: string;
  fix?: { windows: string; ubuntu: string };
}

/**
 * Kiểm tra binary có trong PATH và lấy version.
 * Gọi bằng danh sách đối số, không qua shell (cross-platform).
 */
export async function checkBinary(
  name: string,
  versionArgs: string[],
  versionPattern: RegExp,
  fix: { windows: string; ubuntu: string },
): Promise<CheckResult> {
  try {
    const { stdout, stderr } = await execFileAsync(name, versionArgs);
    const output = stdout || stderr; // some tools print to stderr
    const match = output.match(versionPattern);
    return {
      name,
      found: true,
      version: match?.[1] ?? "unknown",
      fix,
    };
  } catch (err: any) {
    return {
      name,
      found: false,
      error: err.code === "ENOENT" ? "not found in PATH" : err.message,
      fix,
    };
  }
}