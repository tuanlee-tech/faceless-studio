import type { FormatId, Word, TtsJob, TtsResult, AssetRequest, AssetResult } from "./types.js";

export interface RendererAdapter {
  render(options: {
    specPath: string;
    format: FormatId;
    frames?: [number, number];
    outPath: string;
    onProgress: (progress: number) => void;
  }): Promise<void>;

  still(options: {
    specPath: string;
    format: FormatId;
    frame: number;
    outPath: string;
  }): Promise<void>;
}

export interface AssetProvider {
  name: string;
  kinds: Array<"image" | "video">;
  request(
    req: AssetRequest,
  ): Promise<AssetResult | { status: "needs-manual"; packPath: string }>;
}

export interface TtsEngine {
  synthesizeBatch(jobs: TtsJob[]): AsyncIterable<TtsResult>;
}

export interface Aligner {
  align(
    audioPath: string,
    text: string,
    lang: "vi",
  ): Promise<Word[]>;
}