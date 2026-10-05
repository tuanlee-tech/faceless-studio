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
