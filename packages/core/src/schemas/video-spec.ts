import { z } from "zod";

/** specVersion — nâng khi phá vỡ tương thích (Luật vàng #1). */
export const SPEC_VERSION = "0.1.0";

// ── Atomic schemas ──

export const WordRefSchema = z.object({
  /** ID từ, tham chiếu tới words[].id */
  wordId: z.string(),
});

export const TimeRangeSchema = z.object({
  /** ID từ đầu tiên trong khoảng. */
  startWordId: z.string(),
  /** ID từ cuối cùng trong khoảng. */
  endWordId: z.string(),
});

export const CaptionSchema = z.object({
  id: z.string(),
  /** Danh sách word IDs tạo thành caption line này. */
  wordIds: z.array(z.string()).min(1),
  /** Style override (nếu khác template default). */
  style: z.record(z.string(), z.unknown()).optional(),
});

export const SfxSchema = z.object({
  id: z.string(),
  /** Neo vào từ nào. */
  anchorWordId: z.string(),
  /** Offset (giây) so với startSec của anchor word. */
  offsetSec: z.number().default(0),
  /** Tên SFX trong library. */
  sfxId: z.string(),
  /** Âm lượng (0–1). */
  volume: z.number().min(0).max(1).default(0.8),
});

export const AssetRefSchema = z.object({
  assetId: z.string(),
  /** Đường dẫn tương đối từ project root. */
  filePath: z.string(),
  kind: z.enum(["image", "video", "code"]),
  /** License identifier. */
  license: z.string(),
});

export const BeatSchema = z.object({
  id: z.string(),
  /** Khoảng thời gian (neo theo từ). */
  range: TimeRangeSchema,
  /** Layout preset name từ template. */
  layout: z.string(),
  /** Motion preset name từ template. */
  motion: z.string().optional(),
  /** Asset hiển thị trong beat này. */
  assets: z.array(AssetRefSchema).default([]),
  /** Caption lines trong beat. */
  captions: z.array(CaptionSchema).default([]),
  /** SFX triggers trong beat. */
  sfx: z.array(SfxSchema).default([]),
  /** Ghi chú đạo diễn (cho agent/người dùng). */
  directorNote: z.string().optional(),
  visualPrompt: z.string().optional(),
});

export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  beats: z.array(BeatSchema).min(1),
});

export const WordSchema = z.object({
  id: z.string(),
  text: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export const NarrationSchema = z.object({
  /** Đường dẫn tương đối tới narration audio. */
  audioPath: z.string(),
  /** Tổng thời lượng (giây). */
  durationSec: z.number().positive(),
  /** Tất cả từ, theo thứ tự. */
  words: z.array(WordSchema),
});

export const MusicTrackSchema = z.object({
  id: z.string(),
  /** Tên trong library. */
  libraryId: z.string(),
  /** Bắt đầu ở giây nào của video. */
  startSec: z.number().nonnegative(),
  /** Kết thúc (giây). Nếu không set → tới hết video hoặc tới track sau. */
  endSec: z.number().nonnegative().optional(),
  /** Âm lượng cơ bản (0–1). Ducking sẽ giảm thêm. */
  volume: z.number().min(0).max(1).default(0.3),
});

export const VideoSpecSchema = z.object({
  specVersion: z.string(),
  projectSlug: z.string(),
  topicId: z.string(),
  templateId: z.string(),
  /** Khung hình đích. */
  fps: z.number().int().positive().default(30),
  narration: NarrationSchema,
  chapters: z.array(ChapterSchema).min(1),
  music: z.array(MusicTrackSchema).default([]),
  /** Metadata bổ sung (title, description cho YouTube, v.v.). */
  meta: z.record(z.string(), z.unknown()).default({}),
});

export type VideoSpec = z.infer<typeof VideoSpecSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type Sfx = z.infer<typeof SfxSchema>;
export type WordEntry = z.infer<typeof WordSchema>;
export type Narration = z.infer<typeof NarrationSchema>;
export type MusicTrack = z.infer<typeof MusicTrackSchema>;
export type AssetRef = z.infer<typeof AssetRefSchema>;