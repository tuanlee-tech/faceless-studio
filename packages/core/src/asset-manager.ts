import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  renameSync,
  copyFileSync,
  unlinkSync,
} from "node:fs";
import { resolve, join, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import {
  AssetManifestSchema,
  type AssetManifest,
  type AssetManifestItem,
} from "./schemas/asset-manifest.js";
import { VideoSpecSchema, type VideoSpec } from "./schemas/video-spec.js";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export class AssetManager {
  constructor(public readonly baseDir: string = resolve(process.cwd(), "projects")) {}

  getProjectAssetDir(slug: string): string {
    return resolve(this.baseDir, slug, "assets");
  }

  initAssetDirs(slug: string): {
    assetDir: string;
    manifestPath: string;
    requestsDir: string;
    incomingDir: string;
    processedDir: string;
  } {
    const assetDir = this.getProjectAssetDir(slug);
    const requestsDir = resolve(assetDir, "requests");
    const incomingDir = resolve(assetDir, "incoming");
    const processedDir = resolve(assetDir, "processed");
    const manifestPath = resolve(assetDir, "manifest.json");

    mkdirSync(requestsDir, { recursive: true });
    mkdirSync(incomingDir, { recursive: true });
    mkdirSync(processedDir, { recursive: true });

    if (!existsSync(manifestPath)) {
      const initialManifest: AssetManifest = {
        projectSlug: slug,
        updatedAt: new Date().toISOString(),
        assets: [],
      };
      writeFileSync(manifestPath, JSON.stringify(initialManifest, null, 2), "utf-8");
    }

    return {
      assetDir,
      manifestPath,
      requestsDir,
      incomingDir,
      processedDir,
    };
  }

  loadManifest(slug: string): AssetManifest {
    const manifestPath = resolve(this.getProjectAssetDir(slug), "manifest.json");
    if (!existsSync(manifestPath)) {
      this.initAssetDirs(slug);
    }
    const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
    return AssetManifestSchema.parse(raw);
  }

  saveManifest(slug: string, manifest: AssetManifest): void {
    const manifestPath = resolve(this.getProjectAssetDir(slug), "manifest.json");
    manifest.updatedAt = new Date().toISOString();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  exportPromptPack(
    slug: string,
    options?: { customPromptPackPath?: string },
  ): { path: string; count: number } {
    const { requestsDir } = this.initAssetDirs(slug);
    const specPath = resolve(this.baseDir, slug, "spec.json");

    let beatsToPrompt: Array<{
      id: string;
      directorNote?: string;
      visualPrompt?: string;
      title?: string;
      chapterTitle?: string;
    }> = [];

    let styleLock = "";

    if (existsSync(specPath)) {
      try {
        const specJson = JSON.parse(readFileSync(specPath, "utf-8"));
        const spec: VideoSpec = VideoSpecSchema.parse(specJson);
        styleLock = specJson.styleLock || (spec.templateId.includes("mono") 
          ? "Baroque monochrome chiaroscuro, dramatic Caravaggio lighting, high-contrast black-and-white, rich deep blacks, crisp ivory highlights, atmospheric volumetric fog, subtle film grain"
          : "Contemporary cinematic realism, minimalist composition, clean negative space, soft ambient studio lighting, premium editorial color grading");

        for (const chap of spec.chapters || []) {
          for (const beat of chap.beats || []) {
            beatsToPrompt.push({
              id: beat.id,
              directorNote: beat.directorNote,
              visualPrompt: beat.visualPrompt,
              chapterTitle: chap.title,
            });
          }
        }
      } catch {
        // fallback if spec parse fails
      }
    }

    if (beatsToPrompt.length === 0) {
      beatsToPrompt = [
        { id: "b1", directorNote: "Hình ảnh mở đầu chủ đề", visualPrompt: "Mở đầu", chapterTitle: "Mở đầu" },
        { id: "b2", directorNote: "Hình ảnh minh họa nội dung chính", visualPrompt: "Nội dung", chapterTitle: "Nội dung" },
        { id: "b3", directorNote: "Hình ảnh tổng kết và đúc kết", visualPrompt: "Kết thúc", chapterTitle: "Kết thúc" },
      ];
    }

    const targetPath =
      options?.customPromptPackPath || resolve(requestsDir, "prompt-pack.md");

    const lines: string[] = [
      `# Prompt Pack — Dự án: ${slug}`,
      `> Ngày tạo: ${new Date().toISOString()}`,
      `> Tổng số visual cần sinh: ${beatsToPrompt.length}`,
      "",
      "## Hướng dẫn sử dụng",
      "1. Sao chép các prompt bên dưới dán vào công cụ AI Image (Midjourney, DALL-E 3, Stable Diffusion, Recraft).",
      "2. Tải ảnh về, đổi tên theo đúng `Target File Name` tương ứng.",
      `3. Bỏ tất cả ảnh vào thư mục: \`projects/${slug}/assets/incoming/\`.`,
      `4. Chạy lệnh: \`studio assets ${slug} import\` để hệ thống nạp và ghi nhận license vào manifest.`,
      "",
      "---",
      "",
    ];

    beatsToPrompt.forEach((beat, idx) => {
      const beatVisual = beat.visualPrompt || beat.directorNote || `Visual scene for beat ${beat.id}`;
      const alreadyHasStyle = beatVisual.toLowerCase().includes("chiaroscuro") || beatVisual.toLowerCase().includes("cinematic realism") || beatVisual.length > 200;
      
      const fullPrompt = alreadyHasStyle
        ? `${beatVisual}. Masterpiece, award-winning cinematography --ar 16:9 --v 6.0 --no text, watermark, logo, blurry, cartoon, 3d render, distorted faces, oversaturated, low quality, deformed anatomy`
        : `${beatVisual}. Style: ${styleLock}. Camera: cinematic wide shot, shot on 35mm anamorphic lens, f/1.8, shallow depth of field, sharp subject focus, hyper-detailed texture. Masterpiece, award-winning cinematography --ar 16:9 --v 6.0 --no text, watermark, logo, blurry, cartoon, 3d render, distorted faces, oversaturated, low quality, deformed anatomy`;

      lines.push(`### Visual #${idx + 1} — Beat [${beat.id}] (${beat.chapterTitle || "General"})`);
      lines.push(`- **Target File Name:** \`${beat.id}.png\``);
      lines.push(`- **Aspect Ratio:** \`--ar 16:9\` (hoặc \`--ar 9:16\` cho Short)`);
      lines.push(`- **Ghi chú đạo diễn:** ${beat.directorNote || "N/A"}`);
      lines.push(`- **Prompt (Copy dán):**\n\`\`\`\n${fullPrompt}\n\`\`\``);
      lines.push("");
    });

    writeFileSync(targetPath, lines.join("\n"), "utf-8");
    return { path: targetPath, count: beatsToPrompt.length };
  }

  importAssets(
    slug: string,
    options?: { incomingDir?: string },
  ): { imported: AssetManifestItem[]; count: number } {
    const { incomingDir, processedDir } = this.initAssetDirs(slug);
    const sourceDir = options?.incomingDir || incomingDir;

    if (!existsSync(sourceDir)) {
      return { imported: [], count: 0 };
    }

    const files = readdirSync(sourceDir);
    const manifest = this.loadManifest(slug);
    const imported: AssetManifestItem[] = [];

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
        continue;
      }

      const srcPath = resolve(sourceDir, file);
      const stat = statSync(srcPath);
      if (!stat.isFile() || stat.size === 0) {
        continue;
      }

      const fileBuffer = readFileSync(srcPath);
      const sha256 = createHash("sha256").update(fileBuffer).digest("hex");

      const baseNameWithoutExt = basename(file, ext);
      const assetId = baseNameWithoutExt;
      const targetFileName = `${assetId}${ext}`;
      const destPath = resolve(processedDir, targetFileName);

      // Copy or move to processed
      writeFileSync(destPath, fileBuffer);
      try {
        unlinkSync(srcPath);
      } catch {
        // if file can't be unlinked, continue
      }

      const relativeFilePath = `assets/processed/${targetFileName}`;
      const item: AssetManifestItem = {
        id: assetId,
        beatId: assetId.startsWith("b") ? assetId : undefined,
        kind: "image",
        fileName: targetFileName,
        filePath: relativeFilePath,
        license: "CC0",
        source: "ai-generated-user-import",
        sizeBytes: stat.size,
        sha256,
        importedAt: new Date().toISOString(),
      };

      // Update or append in manifest
      const existingIdx = manifest.assets.findIndex((a) => a.id === assetId);
      if (existingIdx >= 0) {
        manifest.assets[existingIdx] = item;
      } else {
        manifest.assets.push(item);
      }
      imported.push(item);
    }

    if (imported.length > 0) {
      this.saveManifest(slug, manifest);
    }

    return {
      imported,
      count: imported.length,
    };
  }
}
