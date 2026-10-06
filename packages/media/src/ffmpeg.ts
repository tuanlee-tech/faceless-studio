import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/** Kết quả probe ffprobe. */
export interface ProbeResult {
  format: {
    duration: number;
    bit_rate: number;
    format_name: string;
  };
  streams: Array<{
    index: number;
    codec_type: "video" | "audio" | "subtitle";
    codec_name: string;
    width?: number;
    height?: number;
    sample_rate?: number;
    channels?: number;
    duration?: number;
  }>;
}

/**
 * Chạy ffprobe lấy metadata JSON.
 */
export async function probe(inputPath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    inputPath,
  ]);
  return JSON.parse(stdout);
}

/**
 * Lấy thời lượng audio/video (giây).
 */
export async function getDuration(inputPath: string): Promise<number> {
  const result = await probe(inputPath);
  const duration = parseFloat(result.format.duration as any);
  if (!duration || Number.isNaN(duration)) {
    throw new Error(`Cannot determine duration for ${inputPath}`);
  }
  return duration;
}

/**
 * Kết quả loudness (EBU R128).
 */
export interface LoudnessInfo {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
  output_i: number;
  output_tp: number;
  output_lra: number;
  output_thresh: number;
  target_i: number;
  target_tp: number;
  target_lra: number;
  target_thresh: number;
  normalization_type: string;
  target_offset: number;
}

/**
 * Đo loudness bằng ffmpeg filter `loudnorm`.
 */
export async function measureLoudness(inputPath: string): Promise<LoudnessInfo> {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-14:TP=-1:LRA=7:print_format=json",
    "-f",
    "null",
    "-",
  ]);

  const start = stderr.indexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Failed to parse loudness measurement JSON for ${inputPath}`);
  }

  const raw = JSON.parse(stderr.slice(start, end + 1));
  return {
    input_i: parseFloat(raw.input_i),
    input_tp: parseFloat(raw.input_tp),
    input_lra: parseFloat(raw.input_lra),
    input_thresh: parseFloat(raw.input_thresh),
    output_i: parseFloat(raw.output_i ?? raw.input_i),
    output_tp: parseFloat(raw.output_tp ?? raw.input_tp),
    output_lra: parseFloat(raw.output_lra ?? raw.input_lra),
    output_thresh: parseFloat(raw.output_thresh ?? raw.input_thresh),
    target_i: -14,
    target_tp: -1,
    target_lra: 7,
    target_thresh: -30,
    normalization_type: raw.normalization_type ?? "dynamic",
    target_offset: parseFloat(raw.target_offset ?? "0"),
  };
}

/**
 * Chuẩn hóa loudness về -14 LUFS (YouTube target) bằng filter `loudnorm`.
 * Trả về đường dẫn file output.
 */
export async function normalizeLoudness(
  inputPath: string,
  outputPath: string,
  targetI = -14,
  targetTP = -1,
  targetLRA = 7,
): Promise<void> {
  // Two-pass: đo trước, sau đó áp dụng measured_thresh
  const measured = await measureLoudness(inputPath);
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-af",
    `loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=summary`,
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

/**
 * Mix nhiều track audio với ducking (giảm nhạc khi có narration).
 * narrationPath: giọng đọc chính (luôn full volume)
 * musicPath: nhạc nền
 * outputPath: file kết quả
 * duckAmount: giảm bao nhiêu dB khi narration đang nói (mặc định -18dB)
 * duckFade: fade in/out ducking (ms)
 */
export async function mixWithDucking(
  narrationPath: string,
  musicPath: string,
  outputPath: string,
  duckAmountDb = -18,
  duckFadeMs = 100,
): Promise<void> {
  // Sử dụng filter sidechaincompress cho ducking
  const filter = `[1:a]volume=0.3[music];[0:a][music]sidechaincompress=threshold=0.003:ratio=20:attack=${duckFadeMs}:release=${duckFadeMs}:makeup=1[out]`;
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    narrationPath,
    "-i",
    musicPath,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

/**
 * Ghép nhiều file video/audio theo thứ tự (concat demuxer).
 * inputs: danh sách đường dẫn file (cùng codec, cùng format).
 */
export async function concatFiles(inputs: string[], outputPath: string): Promise<void> {
  if (inputs.length === 0) throw new Error("No inputs to concat");
  if (inputs.length === 1) {
    // Chỉ copy
    await execFileAsync("ffmpeg", ["-y", "-i", inputs[0], "-c", "copy", outputPath]);
    return;
  }
  // Tạo file list tạm
  const listContent = inputs.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  const listPath = join(inputs[0], "..", `.concat-list-${Date.now()}.txt`);
  await writeFile(listPath, listContent, "utf-8");
  try {
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);
  } finally {
    // cleanup
    try {
      await unlink(listPath);
    } catch {}
  }
}

/**
 * Render video từ composition Remotion (gọi CLI Remotion).
 * Trả về khi hoàn tất.
 */
export async function renderRemotion(
  entryPoint: string,
  composition: string,
  outputPath: string,
  props: Record<string, unknown>,
  frames?: [number, number],
  scale = 1,
): Promise<void> {
  const args = [
    "render",
    entryPoint,
    composition,
    outputPath,
    `--props=${JSON.stringify(props)}`,
    `--scale=${scale}`,
  ];
  if (frames) {
    args.push(`--frames=${frames[0]}:${frames[1]}`);
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["remotion", ...args], { stdio: "inherit" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Remotion exited with code ${code}`))));
    child.on("error", reject);
  });
}

/**
 * Xuất một frame tĩnh (still) từ composition Remotion.
 */
export async function stillRemotion(
  entryPoint: string,
  composition: string,
  outputPath: string,
  props: Record<string, unknown>,
  frame: number,
  scale = 1,
): Promise<void> {
  await execFileAsync("npx", [
    "remotion",
    "still",
    entryPoint,
    composition,
    outputPath,
    `--props=${JSON.stringify(props)}`,
    `--frame=${frame}`,
    `--scale=${scale}`,
  ]);
}