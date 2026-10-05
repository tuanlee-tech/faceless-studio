import { z } from "zod";

export const LibraryAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["music", "sfx", "font"]),
  path: z.string(),
  license: z.string().min(1, "License must not be empty"),
  author: z.string().optional(),
  sourceUrl: z.string().optional(),
  description: z.string().optional(),
});

export const LibrarySchema = z.object({
  music: z.array(LibraryAssetSchema).default([]),
  sfx: z.array(LibraryAssetSchema).default([]),
  fonts: z.array(LibraryAssetSchema).default([]),
});

export type LibraryAsset = z.infer<typeof LibraryAssetSchema>;
export type Library = z.infer<typeof LibrarySchema>;
