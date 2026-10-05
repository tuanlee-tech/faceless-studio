/** Định dạng video đầu ra. */
export type FormatId = "long-16x9" | "short-9x16";

/**
 * Một từ trong lời đọc, gắn với thời điểm trong audio.
 * Mọi beat, caption, SFX neo vào wordId — KHÔNG hard-code timestamp.
 */
export interface Word {
  /** ID duy nhất trong toàn bộ spec, dạng "w001". */
  id: string;
  /** Văn bản gốc (tiếng Việt). */
  text: string;
  /** Thời điểm bắt đầu (giây) trong narration audio. */
  startSec: number;
  /** Thời điểm kết thúc (giây). */
  endSec: number;
  /** Độ tin cậy alignment (0–1). Dưới 0.5 → cảnh báo QA. */
  confidence: number;
}

/** Yêu cầu sinh asset. */
export interface AssetRequest {
  id: string;
  kind: "image" | "video";
  prompt: string;
  style?: string;
  referenceAssetId?: string;
  /** Kích thước mong muốn (px). */
  width: number;
  height: number;
}

/** Kết quả trả về từ AssetProvider. */
export interface AssetResult {
  status: "ok";
  assetId: string;
  filePath: string;
  license: string;
}

/** Một job TTS cho sidecar. */
export interface TtsJob {
  id: string;
  text: string;
  voice: string;
  speed?: number;
}

/** Kết quả TTS trả về. */
export interface TtsResult {
  jobId: string;
  audioPath: string;
  durationSec: number;
}