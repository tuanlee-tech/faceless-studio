import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { unlink, copyFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { probe, type LoudnessInfo } from "./ffmpeg.js";

const execFileAsync = promisify(execFile);

export interface LoudnessOptions {
  /** Target Integrated Loudness in LUFS (YouTube target is -14). Default: -14 */
  targetI?: number;
  /** Target True Peak in dBTP (YouTube target is -1.0). Default: -1.0 */
  targetTP?: number;
  /** Target Loudness Range in LU. Default: 7.0 */
  targetLRA?: number;
}

/**
 * LoudnessProcessor handles standard broadcast and YouTube loudness normalization (-14 LUFS).
 * Implements two-pass EBU R128 / loudnorm processing and video muxing with stream copy.
 */
export class LoudnessProcessor {
  /**
   * Measures integrated loudness, true peak, and LRA using ffmpeg loudnorm JSON output.
   */
  async measure(inputPath: string, options: LoudnessOptions = {}): Promise<LoudnessInfo> {
    const targetI = options.targetI ?? -14;
    const targetTP = options.targetTP ?? -1;
    const targetLRA = options.targetLRA ?? 7;

    const { stderr } = await execFileAsync("ffmpeg", [
      "-i",
      inputPath,
      "-af",
      `loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json`,
      "-f",
      "null",
      "-",
    ]);

    const start = stderr.indexOf("{");
    const end = stderr.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error(`Failed to parse loudnorm JSON from ffmpeg output for ${inputPath}`);
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
      target_i: targetI,
      target_tp: targetTP,
      target_lra: targetLRA,
      target_thresh: -30,
      normalization_type: raw.normalization_type ?? "dynamic",
      target_offset: parseFloat(raw.target_offset ?? "0"),
    };
  }

  /**
   * Extracts audio stream from a video file to PCM WAV.
   */
  async extractAudio(videoPath: string, outputAudioPath: string): Promise<void> {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-c:a",
      "pcm_s16le",
      outputAudioPath,
    ]);
  }

  /**
   * Normalizes audio file to target LUFS using two-pass loudnorm.
   */
  async normalizeAudio(
    inputAudioPath: string,
    outputAudioPath: string,
    options: LoudnessOptions = {}
  ): Promise<void> {
    const targetI = options.targetI ?? -14;
    const targetTP = options.targetTP ?? -1;
    const targetLRA = options.targetLRA ?? 7;

    const measured = await this.measure(inputAudioPath, options);

    const filter = `loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputAudioPath,
      "-af",
      filter,
      "-c:a",
      "pcm_s16le",
      outputAudioPath,
    ]);
  }

  /**
   * Muxes normalized audio back into video container, copying original video stream (-c:v copy).
   */
  async muxAudio(videoPath: string, audioPath: string, outputVideoPath: string): Promise<void> {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      outputVideoPath,
    ]);
  }

  /**
   * Complete Post-Processing:
   * 1. Probes video for audio stream.
   * 2. Extracts audio -> normalizes to -14 LUFS -> muxes back into video container.
   * If video has no audio or is silent, preserves original video.
   */
  async processVideo(
    videoPath: string,
    outputPath?: string,
    options: LoudnessOptions = {}
  ): Promise<string> {
    if (!existsSync(videoPath)) {
      throw new Error(`Video file not found at: ${videoPath}`);
    }

    const finalOut = outputPath || videoPath;
    const probeResult = await probe(videoPath);
    const audioStream = probeResult.streams.find((s) => s.codec_type === "audio");

    if (!audioStream) {
      if (finalOut !== videoPath) {
        await copyFile(videoPath, finalOut);
      }
      return finalOut;
    }

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempAudioRaw = join(tmpdir(), `faceless-audio-raw-${nonce}.wav`);
    const tempAudioNorm = join(tmpdir(), `faceless-audio-norm-${nonce}.wav`);
    const tempMuxVideo = join(tmpdir(), `faceless-video-mux-${nonce}.mp4`);

    try {
      // 1. Extract audio
      await this.extractAudio(videoPath, tempAudioRaw);

      // 2. Measure audio loudness
      const measured = await this.measure(tempAudioRaw, options);

      // If audio is practically silent (-70 LUFS or lower), skip normalization
      if (measured.input_i <= -70) {
        if (finalOut !== videoPath) {
          await copyFile(videoPath, finalOut);
        }
        return finalOut;
      }

      // 3. Normalize audio (Two-pass)
      await this.normalizeAudio(tempAudioRaw, tempAudioNorm, options);

      // 4. Mux audio back with video stream
      await this.muxAudio(videoPath, tempAudioNorm, tempMuxVideo);

      // 5. Replace destination
      if (finalOut === videoPath) {
        await unlink(videoPath);
        await rename(tempMuxVideo, finalOut);
      } else {
        await rename(tempMuxVideo, finalOut);
      }

      return finalOut;
    } finally {
      // Cleanup temp files
      for (const p of [tempAudioRaw, tempAudioNorm, tempMuxVideo]) {
        try {
          if (existsSync(p)) await unlink(p);
        } catch {}
      }
    }
  }
}
