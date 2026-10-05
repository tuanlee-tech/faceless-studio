import { z } from "zod";

export const AssetManifestItemSchema = z.object({
  id: z.string(),
  beatId: z.string().optional(),
  kind: z.enum(["image", "video", "code"]).default("image"),
  fileName: z.string(),
  filePath: z.string(),
  license: z.string().default("CC0"),
  source: z.string().optional().default("user-import"),
  prompt: z.string().optional(),
  sizeBytes: z.number().nonnegative().optional(),
  sha256: z.string().optional(),
  importedAt: z.string(),
});

export const AssetManifestSchema = z.object({
  projectSlug: z.string(),
  updatedAt: z.string(),
  assets: z.array(AssetManifestItemSchema).default([]),
});

export type AssetManifestItem = z.infer<typeof AssetManifestItemSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
