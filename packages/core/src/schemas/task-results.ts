import { z } from "zod";

export const OutlineResultSchema = z
  .object({
    title: z.string(),
    points: z.array(z.string()).optional(),
    sections: z.array(z.any()).optional(),
  })
  .passthrough()
  .describe("outline-schema");

export const ScriptResultSchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    dialogue: z.array(z.any()).optional(),
    sections: z.array(z.any()).optional(),
  })
  .passthrough()
  .describe("script-schema");

export const DirectResultSchema = z
  .object({
    beats: z.array(z.any()).optional(),
    visuals: z.array(z.any()).optional(),
  })
  .passthrough()
  .describe("direct-schema");

export type OutlineResult = z.infer<typeof OutlineResultSchema>;
export type ScriptResult = z.infer<typeof ScriptResultSchema>;
export type DirectResult = z.infer<typeof DirectResultSchema>;

export const ShortCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  startWordId: z.string(),
  endWordId: z.string(),
  hookReason: z.string().optional(),
  estimatedSeconds: z.number().optional(),
});

export const ShortCandidatesResultSchema = z
  .object({
    candidates: z.array(ShortCandidateSchema).min(1),
  })
  .passthrough()
  .describe("shorts-candidates-schema");

export type ShortCandidate = z.infer<typeof ShortCandidateSchema>;
export type ShortCandidatesResult = z.infer<typeof ShortCandidatesResultSchema>;

