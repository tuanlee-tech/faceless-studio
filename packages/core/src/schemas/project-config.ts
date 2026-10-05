import { z } from "zod";

export const FormatIdSchema = z.enum(["long-16x9", "short-9x16"]);

export const ProjectConfigSchema = z.object({
  /** Slug duy nhất, dùng làm tên thư mục. */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  topicId: z.string(),
  templateId: z.string(),
  /** Thời lượng mục tiêu (phút). */
  targetMinutes: z.number().positive(),
  /** Các định dạng cần render. */
  formats: z.array(FormatIdSchema).min(1),
  /** Ngân sách asset (max requests). */
  assetBudget: z.number().int().nonnegative().default(50),
  /** Ngưỡng QA (0–100). */
  qaThreshold: z.number().min(0).max(100).default(70),
  /** Voice ID cho TTS. */
  voice: z.string().default("default"),
  /** Tốc độ đọc. */
  speed: z.number().positive().default(1.0),
  /** Ngày tạo (ISO 8601). */
  createdAt: z.string().datetime(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;