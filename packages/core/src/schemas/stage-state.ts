import { z } from "zod";

export const StageStatusSchema = z.enum([
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
]);

export const StageEntrySchema = z.object({
  stage: z.string(),
  status: StageStatusSchema,
  /** SHA-256 hash đầu vào (để cache). */
  inputHash: z.string().optional(),
  /** SHA-256 hash đầu ra. */
  outputHash: z.string().optional(),
  /** Thời điểm hoàn thành (ISO 8601). */
  completedAt: z.string().datetime().optional(),
  /** Lỗi nếu failed. */
  error: z.string().optional(),
});

export const ProjectStateSchema = z.object({
  projectSlug: z.string(),
  /** Các stage theo thứ tự pipeline. */
  stages: z.array(StageEntrySchema),
  /** Lần cập nhật cuối. */
  updatedAt: z.string().datetime(),
});

export type ProjectState = z.infer<typeof ProjectStateSchema>;
export type StageEntry = z.infer<typeof StageEntrySchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;