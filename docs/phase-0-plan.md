# Phase 0 — Foundation: Execution Plan

> **Dự án:** Faceless Studio
> **Phase:** 0 — Foundation (Nền tảng)
> **Mục tiêu:** Dựng monorepo, schema zod, `studio doctor`, tài liệu gốc. Kết thúc phase: mọi package build được, test xanh, `studio doctor` chạy được trên Ubuntu.
> **Người tạo plan:** Orchestrator (Claude Opus 4.6)
> **Ngày:** 2026-10-05

---

## Quy ước cho sub-agent

- **Đọc `AGENTS.md` trước khi làm bất kỳ task nào.** Đây là luật bắt buộc.
- **Ngôn ngữ code/định danh:** tiếng Anh. Nội dung (comment giải thích cho người dùng, nội dung video mẫu): tiếng Việt.
- **TypeScript strict, ESM (`"type": "module"`), Node 22.** Import phải có đuôi `.js` (ESM convention).
- **Tên file:** chữ thường, `kebab-case`, không dấu cách.
- **Path:** dùng `node:path` và `node:url`, KHÔNG ghép chuỗi `/` hoặc `\`.
- **Test:** Vitest. Mỗi task yêu cầu test thì phải có file test chạy xanh.
- **Khi tạo file:** luôn bắt đầu bằng comment/header nói file này thuộc package nào, mục đích gì.
- **Không thêm dependency** khi chưa được liệt kê trong task. Nếu cần → ghi vào báo cáo nghiệm thu, chờ phê duyệt.
- **.gitattributes** phải có `* text=auto eol=lf` (Task 0.1 tạo).

---

## Sơ đồ phụ thuộc

```
Task 0.1 (Repo scaffold + .gitattributes)
  ├── Task 0.2 (docs/ROADMAP.md + doc stubs)  [song song với 0.3]
  ├── Task 0.3 (packages/core scaffold + zod schemas)
  │     └── Task 0.4 (docs/VIDEO-SPEC.md — sinh từ zod)
  │     └── Task 0.5 (packages/media scaffold + interfaces)
  │     └── Task 0.6 (packages/cli scaffold + `studio doctor`)
  └── Task 0.7 (sidecar/ scaffold — Python/uv)
```

**Có thể chạy song song:**
- Task 0.1 → trước hết
- Task 0.2 + Task 0.3 → song song sau 0.1
- Task 0.4, 0.5, 0.6 → sau 0.3
- Task 0.7 → sau 0.1, song song với 0.3

---

## Task 0.1 — Repo Scaffold & Cấu hình gốc

### Bối cảnh
Đọc: `AGENTS.md` (mục Cross-platform, Quy ước mã), `docs/ARCHITECTURE.md` (mục 4: Cấu trúc repo).

### Deliverables

| # | File | Mô tả |
|---|------|--------|
| 1 | `.gitattributes` | `* text=auto eol=lf` |
| 2 | `.gitignore` | node_modules, dist, out, projects/*/audio, projects/*/out, .env, *.wav, *.mp4 (xem chi tiết bên dưới) |
| 3 | `package.json` (root) | Workspace monorepo (npm workspaces hoặc pnpm — chọn pnpm) |
| 4 | `pnpm-workspace.yaml` | Liệt kê `packages/*` |
| 5 | `tsconfig.base.json` | Shared base config: strict, ESM, target ES2022, moduleResolution bundler |
| 6 | `.npmrc` | `shamefully-hoist=false`, `strict-peer-dependencies=true` |
| 7 | Thư mục trống (có `.gitkeep`) | `templates/`, `topics/`, `library/music/`, `library/sfx/`, `projects/`, `scripts/`, `skills/`, `apps/` |
| 8 | `library/library.json` | File JSON trống hợp lệ: `{ "music": [], "sfx": [], "fonts": [] }` |

### Hướng dẫn chi tiết

**`.gitignore`:**
```gitignore
node_modules/
dist/
*.tsbuildinfo

# Project outputs (large, regeneratable)
projects/*/audio/chunks/
projects/*/audio/narration.wav
projects/*/audio/mix/
projects/*/out/
projects/*/assets/incoming/
projects/*/assets/processed/

# Sidecar venv
sidecar/.venv/

# OS
.DS_Store
Thumbs.db

# Env
.env
.env.local
```

**`package.json` (root):**
```json
{
  "name": "faceless-studio",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "studio": "node packages/cli/dist/main.js"
  }
}
```

**`tsconfig.base.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "packages/*"
```

### Tiêu chí tự nghiệm thu

- [ ] `pnpm install` chạy thành công (chưa có package con → chỉ cần không lỗi).
- [ ] `.gitattributes` có dòng `* text=auto eol=lf`.
- [ ] Tất cả thư mục trong bảng Deliverables tồn tại (có `.gitkeep`).
- [ ] `library/library.json` parse được bằng `JSON.parse()`.
- [ ] `cat tsconfig.base.json | npx tsc --showConfig` (dùng `npx typescript --showConfig -p tsconfig.base.json`) không lỗi cú pháp.
- [ ] Không có file `.sh` hay `.bat` nào.
- [ ] Chạy `git add -A && git status` → tất cả file mới đều tracked, không có file ngoài danh sách.

### Báo cáo nghiệm thu (ghi vào cuối task)
```
## Nghiệm thu Task 0.1
- Trạng thái: PASS / FAIL
- Lý do FAIL (nếu có):
- Dependency ngoài danh sách đã thêm:
- Việc còn mở:
```

---

## Task 0.2 — Tài liệu gốc: ROADMAP.md + Doc Stubs

### Bối cảnh
Đọc: `README.md` (bảng "Bản đồ tài liệu"), `docs/ARCHITECTURE.md` toàn bộ, `AGENTS.md`.

### Deliverables

| # | File | Mô tả |
|---|------|--------|
| 1 | `docs/ROADMAP.md` | Roadmap 5 phase, tiêu chí nghiệm thu mỗi phase |
| 2 | `docs/PIPELINE.md` | Stub — header + TODO |
| 3 | `docs/TEMPLATES-AND-TOPICS.md` | Stub |
| 4 | `docs/CINEMATIC-GRAMMAR.md` | Stub |
| 5 | `docs/ASSETS-AND-AUDIO.md` | Stub |
| 6 | `docs/QA-GATES.md` | Stub |
| 7 | `docs/SKILLS.md` | Stub |

### Hướng dẫn chi tiết

**`docs/ROADMAP.md` — nội dung BẮT BUỘC (viết đầy đủ, không stub):**

```markdown
# ROADMAP

## Phase 0 — Foundation (Nền tảng)
**Mục tiêu:** Monorepo chạy được, schema zod, `studio doctor`, tài liệu gốc.
**Tiêu chí nghiệm thu:**
- Monorepo: `pnpm build` và `pnpm test` xanh trên Ubuntu 24.04.
- Schema: `VideoSpec`, `ProjectConfig`, `StageState` export được từ `@faceless/core`; có test roundtrip (parse → serialize → parse).
- `studio doctor` kiểm được: Node ≥ 22, pnpm, Python ≥ 3.10, uv, ffmpeg, ffprobe; in kết quả JSON khi `--json`.
- `docs/VIDEO-SPEC.md` khớp với schema zod (cùng commit).
- Spike TTS/Align: **hoãn** — tạo interface + mock; chạy spike thật khi có VieNeu-TTS.

## Phase 1 — Pipeline cốt lõi (Script → Spec → Render khung)
**Mục tiêu:** Từ `idea.md` → spec.json → render 1 video 16:9 đơn giản (text trên nền đen + TTS mock).
**Tiêu chí nghiệm thu:**
- `studio new test-01 --topic sample --template minimal --minutes 1 --formats long-16x9` tạo project hợp lệ.
- Task Inbox: outline → script → direct → spec, mỗi bước có task file, schema validate đạt.
- `studio render test-01 --format long-16x9` xuất mp4 ≥ 30 giây, có subtitle, có giọng TTS (mock sine wave nếu chưa có VieNeu).
- `studio status test-01 --json` trả JSON đúng schema.

## Phase 2 — Template & Asset hệ thống
**Mục tiêu:** 2 template (baroque-mono, clean-split), asset router (prompt pack → import), library management.
**Tiêu chí nghiệm thu:**
- Đổi template trong `project.json` → render lại cho kết quả khác biệt rõ ràng về layout/style.
- `studio assets test-01 export` xuất prompt pack; `studio assets test-01 import` nhận asset vào đúng vị trí.
- Subtitle tiếng Việt hiển thị đúng (font bundled, không dùng font hệ thống).

## Phase 3 — Short 9:16, QA, Audio mix
**Mục tiêu:** Sinh Short từ spec, QA gates, audio mixing (nhạc + SFX + ducking).
**Tiêu chí nghiệm thu:**
- `studio shorts test-01` xuất ≥ 1 Short 9:16 hợp lệ.
- `studio qa test-01 --pre` và `--post` chạy được, trả danh sách lỗi/cảnh báo.
- Audio mix: loudness đạt -14 LUFS ± 1 (YouTube target), ducking khi có giọng đọc.

## Phase 4 — UI (server + web)
**Mục tiêu:** Web UI gọi CLI qua REST, hiển thị tiến độ qua SSE.
**Tiêu chí nghiệm thu:**
- Xem `docs/ARCHITECTURE.md` mục 11.

## Spike & Rủi ro
- **Spike: TTS alignment** — WhisperX vs stable-ts trên giọng VieNeu thật. Tiêu chí: lệch từ TB < 80ms, không mất từ. → Chạy khi có model.
- **Spike: Render perf** — 1 chương 2 phút ở 30fps, đo thời gian trên CPU i5 đời 12. → Phase 1.
- **Rủi ro: Remotion license** — miễn phí ≤ 3 người. Kiểm lại trước Phase 4.
- **Rủi ro: VieNeu-TTS v3 Turbo** — chưa xác nhận GPU Pascal. CPU-first.
- **Rủi ro: Cross-platform** — Windows chưa kiểm. Ghi lại mỗi phát hiện.
```

**Các file stub** (PIPELINE, TEMPLATES-AND-TOPICS, v.v.) — mỗi file có cấu trúc:
```markdown
# [TÊN TÀI LIỆU]

> **Trạng thái:** stub — sẽ viết đầy đủ ở Phase [N].

## TODO
- [ ] (mô tả ngắn nội dung cần viết, lấy từ README.md bảng "Bản đồ tài liệu")
```

### Tiêu chí tự nghiệm thu

- [ ] `docs/ROADMAP.md` có đầy đủ 5 phase (0–4), mỗi phase có "Mục tiêu" và "Tiêu chí nghiệm thu".
- [ ] Mỗi file trong bảng README "Bản đồ tài liệu" (trừ ARCHITECTURE.md, VIDEO-SPEC.md) tồn tại trong `docs/`.
- [ ] Không file nào trống (phải có ít nhất header + TODO).
- [ ] Tất cả link cross-reference trong ROADMAP.md trỏ đúng file tồn tại.
- [ ] Nội dung viết bằng tiếng Việt (trừ tên lệnh, tên file).

### Báo cáo nghiệm thu
```
## Nghiệm thu Task 0.2
- Trạng thái: PASS / FAIL
- Lý do FAIL (nếu có):
- Việc còn mở:
```

---

## Task 0.3 — packages/core: Scaffold + Zod Schemas

### Bối cảnh
Đọc: `AGENTS.md` (Quy ước mã, Luật vàng #1 #3), `docs/ARCHITECTURE.md` (mục 5: Thư mục project, mục 8: Ranh giới mở rộng, mục 3: ADR-003).

**Quan trọng:** `packages/core` KHÔNG được import React, Remotion, hay bất kỳ API trình duyệt nào.

### Deliverables

| # | File | Mô tả |
|---|------|--------|
| 1 | `packages/core/package.json` | Package `@faceless/core` |
| 2 | `packages/core/tsconfig.json` | Extends `../../tsconfig.base.json` |
| 3 | `packages/core/vitest.config.ts` | Vitest config |
| 4 | `packages/core/src/index.ts` | Re-export tất cả |
| 5 | `packages/core/src/schemas/video-spec.ts` | Zod schema cho `spec.json` |
| 6 | `packages/core/src/schemas/project-config.ts` | Zod schema cho `project.json` |
| 7 | `packages/core/src/schemas/stage-state.ts` | Zod schema cho `state.json` |
| 8 | `packages/core/src/schemas/index.ts` | Re-export schemas |
| 9 | `packages/core/src/schemas/__tests__/schemas.test.ts` | Test roundtrip |
| 10 | `packages/core/src/interfaces.ts` | RendererAdapter, AssetProvider, TtsEngine, Aligner |
| 11 | `packages/core/src/types.ts` | Shared types (FormatId, Word, TtsJob, TtsResult, AssetRequest, AssetResult) |

### Hướng dẫn chi tiết

#### `packages/core/package.json`
```json
{
  "name": "@faceless/core",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

#### `packages/core/src/types.ts` — Shared types

```ts
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
```

#### `packages/core/src/schemas/video-spec.ts` — Schema quan trọng nhất

Thiết kế dựa trên ARCHITECTURE.md mục 5 và nguyên tắc "neo theo từ":

```ts
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
```

#### `packages/core/src/schemas/project-config.ts`

```ts
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
```

#### `packages/core/src/schemas/stage-state.ts`

```ts
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
```

#### `packages/core/src/interfaces.ts`

Sao chép chính xác từ ARCHITECTURE.md mục 8, thêm type annotation đầy đủ:
```ts
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
```

#### `packages/core/src/schemas/__tests__/schemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { VideoSpecSchema, SPEC_VERSION } from "../video-spec.js";
import { ProjectConfigSchema } from "../project-config.js";
import { ProjectStateSchema } from "../stage-state.js";

describe("VideoSpecSchema", () => {
  const validSpec = {
    specVersion: SPEC_VERSION,
    projectSlug: "test-01",
    topicId: "sample",
    templateId: "minimal",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 60,
      words: [
        { id: "w001", text: "Xin", startSec: 0, endSec: 0.3, confidence: 0.95 },
        { id: "w002", text: "chào", startSec: 0.3, endSec: 0.6, confidence: 0.92 },
      ],
    },
    chapters: [
      {
        id: "c1",
        title: "Mở đầu",
        beats: [
          {
            id: "b1",
            range: { startWordId: "w001", endWordId: "w002" },
            layout: "center-text",
            captions: [{ id: "cap1", wordIds: ["w001", "w002"] }],
          },
        ],
      },
    ],
  };

  it("parses a valid spec", () => {
    const result = VideoSpecSchema.parse(validSpec);
    expect(result.specVersion).toBe(SPEC_VERSION);
    expect(result.chapters).toHaveLength(1);
  });

  it("roundtrip: parse → serialize → parse", () => {
    const first = VideoSpecSchema.parse(validSpec);
    const json = JSON.stringify(first);
    const second = VideoSpecSchema.parse(JSON.parse(json));
    expect(second).toEqual(first);
  });

  it("rejects missing chapters", () => {
    const bad = { ...validSpec, chapters: [] };
    expect(() => VideoSpecSchema.parse(bad)).toThrow();
  });

  it("rejects missing narration.words", () => {
    const bad = { ...validSpec, narration: { ...validSpec.narration, words: undefined } };
    expect(() => VideoSpecSchema.parse(bad)).toThrow();
  });
});

describe("ProjectConfigSchema", () => {
  const validConfig = {
    slug: "test-01",
    topicId: "sample",
    templateId: "minimal",
    targetMinutes: 5,
    formats: ["long-16x9"],
    createdAt: "2026-10-05T00:00:00Z",
  };

  it("parses valid config with defaults", () => {
    const result = ProjectConfigSchema.parse(validConfig);
    expect(result.assetBudget).toBe(50);
    expect(result.qaThreshold).toBe(70);
    expect(result.voice).toBe("default");
  });

  it("rejects invalid slug", () => {
    expect(() =>
      ProjectConfigSchema.parse({ ...validConfig, slug: "Test 01" }),
    ).toThrow();
  });
});

describe("ProjectStateSchema", () => {
  it("parses valid state", () => {
    const state = {
      projectSlug: "test-01",
      stages: [
        { stage: "outline", status: "done", inputHash: "abc123", completedAt: "2026-10-05T00:00:00Z" },
        { stage: "script", status: "pending" },
      ],
      updatedAt: "2026-10-05T00:00:00Z",
    };
    const result = ProjectStateSchema.parse(state);
    expect(result.stages).toHaveLength(2);
  });
});
```

#### `packages/core/src/index.ts` và `packages/core/src/schemas/index.ts`

`schemas/index.ts`: Re-export tất cả từ `video-spec.js`, `project-config.js`, `stage-state.js`.

`src/index.ts`: Re-export từ `./schemas/index.js`, `./types.js`, `./interfaces.js`.

### Tiêu chí tự nghiệm thu

- [ ] `cd packages/core && pnpm install && pnpm build` thành công, không lỗi TypeScript.
- [ ] `cd packages/core && pnpm test` — tất cả test xanh.
- [ ] `packages/core/src` KHÔNG import `react`, `remotion`, hay bất kỳ browser API nào. Kiểm tra bằng: `grep -rn "from 'react\|from 'remotion\|from '@remotion\|window\.\|document\." packages/core/src/` → phải trống.
- [ ] Mỗi schema export cả zod schema (dùng runtime) lẫn TypeScript type (dùng compile-time).
- [ ] `specVersion` có giá trị `"0.1.0"`.
- [ ] `VideoSpecSchema` enforce: chapters.min(1), words là mảng bắt buộc, beat.range neo theo wordId (không có trường giây nào trong beat).

### Báo cáo nghiệm thu
```
## Nghiệm thu Task 0.3
- Trạng thái: PASS / FAIL
- `pnpm build` exit code:
- `pnpm test` exit code:
- Số test: X passed, Y failed
- grep React/Remotion: (kết quả)
- Việc còn mở:
```

---

## Task 0.4 — docs/VIDEO-SPEC.md (sinh từ zod schema)

### Bối cảnh
Đọc: `AGENTS.md` luật vàng #1 ("Spec là hợp đồng"), `packages/core/src/schemas/video-spec.ts` (output của Task 0.3).

### Deliverables

| # | File | Mô tả |
|---|------|--------|
| 1 | `docs/VIDEO-SPEC.md` | Tài liệu mô tả spec.json, khớp 1:1 với zod schema |

### Hướng dẫn chi tiết

Viết tài liệu dạng markdown mô tả `spec.json`:

1. **Header:** specVersion, mục đích, quy tắc phiên bản hóa.
2. **Bảng tổng quan:** mỗi trường top-level, type, required/optional, mô tả.
3. **Mục chi tiết** cho từng object lồng: Narration, Chapter, Beat, Caption, Sfx, AssetRef, MusicTrack, Word.
4. **Ví dụ JSON tối thiểu** (copy từ test fixture trong Task 0.3, format đẹp).
5. **Quy tắc:**
   - "Neo theo từ": beat.range, caption, sfx đều tham chiếu wordId. Không có trường giây trực tiếp trong beat.
   - specVersion phải nâng khi thêm/bỏ trường bắt buộc.
   - Mọi asset phải có license.
6. **Changelog** ở cuối file: `## Changelog` → `### 0.1.0 — Khởi tạo`.

**QUAN TRỌNG:** nội dung phải khớp chính xác với zod schema. Nếu schema có trường `X`, doc phải có trường `X` và ngược lại. Agent phải so sánh từng trường.

### Tiêu chí tự nghiệm thu

- [ ] Mỗi trường trong `VideoSpecSchema` (kể cả nested) xuất hiện trong doc.
- [ ] Mỗi trường trong doc tồn tại trong schema (không bịa trường).
- [ ] Ví dụ JSON trong doc parse thành công bằng `VideoSpecSchema.parse()`.
- [ ] Có mục Changelog.
- [ ] File viết bằng tiếng Việt (trừ tên trường, tên type).

### Báo cáo nghiệm thu
```
## Nghiệm thu Task 0.4
- Trạng thái: PASS / FAIL
- Số trường trong schema:
- Số trường trong doc:
- Ví dụ JSON parse: PASS / FAIL
- Việc còn mở:
```

---

## Task 0.5 — packages/media: Scaffold + FFmpeg Interfaces

### Bối cảnh
Đọc: `AGENTS.md`, `docs/ARCHITECTURE.md` (mục 4 — media package, mục 8 — TtsEngine, Aligner interfaces, mục 10 — hiệu năng).

### Deliverables

| # | File | Mô tả |
|---|------|--------|
| 1 | `packages/media/package.json` | Package `@faceless/media` |
| 2 | `packages/media/tsconfig.json` | Extends base |
| 3 | `packages/media/vitest.config.ts` | Config |
| 4 | `packages/media/src/index.ts` | Re-exports |
| 5 | `packages/media/src/ffmpeg.ts` | Wrapper ffmpeg/ffprobe: `probe()`, `concat()`, `mixAudio()` — **chỉ type signatures + TODO body** |
| 6 | `packages/media/src/tts-client.ts` | Client gọi sidecar TTS — **chỉ interface + mock** |
| 7 | `packages/media/src/align-client.ts` | Client gọi sidecar Align — **chỉ interface + mock** |
| 8 | `packages/media/src/__tests__/ffmpeg.test.ts` | Test probe trả mock data |

### Hướng dẫn chi tiết

**`packages/media/package.json`:**
```json
{
  "name": "@faceless/media",
  "version": "0.0.1",
  "type": "module",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@faceless/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**`packages/media/src/ffmpeg.ts`** — Wrapper functions:
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  durationSec: number;
  codec: string;
  sampleRate?: number;
  width?: number;
  height?: number;
}

/**
 * Probe một file media bằng ffprobe.
 * Gọi ffprobe bằng danh sách đối số (không qua shell — AGENTS.md cross-platform).
 */
export async function probe(filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0];
  return {
    durationSec: parseFloat(data.format?.duration ?? "0"),
    codec: stream?.codec_name ?? "unknown",
    sampleRate: stream?.sample_rate ? parseInt(stream.sample_rate, 10) : undefined,
    width: stream?.width,
    height: stream?.height,
  };
}

/**
 * Ghép nhiều file media bằng ffmpeg concat.
 * TODO: Hiện thực đầy đủ ở Phase 1.
 */
export async function concat(
  inputPaths: string[],
  outputPath: string,
): Promise<void> {
  throw new Error("TODO: concat — implement in Phase 1");
}

/**
 * Mix audio tracks (narration + music + SFX) với ducking.
 * TODO: Hiện thực đầy đủ ở Phase 3.
 */
export async function mixAudio(options: {
  narrationPath: string;
  musicPaths: Array<{ path: string; volume: number; startSec: number }>;
  sfxPaths: Array<{ path: string; volume: number; startSec: number }>;
  outputPath: string;
  targetLufs?: number;
}): Promise<void> {
  throw new Error("TODO: mixAudio — implement in Phase 3");
}
```

**`packages/media/src/tts-client.ts`** — Mock TTS:
```ts
import type { TtsEngine, TtsJob, TtsResult } from "@faceless/core";

/**
 * Mock TTS engine — sinh file WAV trống (silence) cho testing.
 * Sẽ thay bằng VieNeu sidecar client ở Phase 1.
 */
export class MockTtsEngine implements TtsEngine {
  async *synthesizeBatch(jobs: TtsJob[]): AsyncIterable<TtsResult> {
    for (const job of jobs) {
      yield {
        jobId: job.id,
        audioPath: `audio/chunks/mock-${job.id}.wav`,
        durationSec: job.text.length * 0.08, // ~80ms per char estimate
      };
    }
  }
}
```

**`packages/media/src/align-client.ts`** — Mock Aligner:
```ts
import type { Aligner, Word } from "@faceless/core";

/**
 * Mock Aligner — phân bổ đều từng từ theo thời lượng.
 * Sẽ thay bằng WhisperX/stable-ts sidecar client sau spike.
 */
export class MockAligner implements Aligner {
  async align(audioPath: string, text: string, lang: "vi"): Promise<Word[]> {
    const words = text.split(/\s+/).filter(Boolean);
    const avgDur = 0.3; // 300ms per word mock
    return words.map((w, i) => ({
      id: `w${String(i + 1).padStart(3, "0")}`,
      text: w,
      startSec: i * avgDur,
      endSec: (i + 1) * avgDur,
      confidence: 0.95,
    }));
  }
}
```

**Test `ffmpeg.test.ts`:** Test `probe()` trên file thật sẽ cần ffprobe cài → viết test với mock hoặc skip nếu không có ffprobe. Pattern:
```ts
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("ffmpeg wrapper", () => {
  it("MockTtsEngine yields results for each job", async () => {
    const { MockTtsEngine } = await import("../tts-client.js");
    const engine = new MockTtsEngine();
    const results: any[] = [];
    for await (const r of engine.synthesizeBatch([
      { id: "j1", text: "Xin chào", voice: "default" },
      { id: "j2", text: "thế giới", voice: "default" },
    ])) {
      results.push(r);
    }
    expect(results).toHaveLength(2);
    expect(results[0].jobId).toBe("j1");
    expect(results[0].durationSec).toBeGreaterThan(0);
  });

  it("MockAligner produces words with sequential IDs", async () => {
    const { MockAligner } = await import("../align-client.js");
    const aligner = new MockAligner();
    const words = await aligner.align("fake.wav", "Xin chào thế giới", "vi");
    expect(words).toHaveLength(4);
    expect(words[0].id).toBe("w001");
    expect(words[3].id).toBe("w004");
    expect(words[0].startSec).toBe(0);
  });
});
```

### Tiêu chí tự nghiệm thu

- [ ] `cd packages/media && pnpm build` thành công.
- [ ] `cd packages/media && pnpm test` — tất cả test xanh.
- [ ] KHÔNG import `react`, `remotion`, browser API.
- [ ] `MockTtsEngine` implement `TtsEngine` interface từ `@faceless/core`.
- [ ] `MockAligner` implement `Aligner` interface từ `@faceless/core`.
- [ ] `probe()` gọi `ffprobe` bằng danh sách đối số (kiểm tra `execFile`, không phải `exec`).

### Báo cáo nghiệm thu
```
## Nghiệm thu Task 0.5
- Trạng thái: PASS / FAIL
- `pnpm build` exit code:
- `pnpm test` exit code:
- Số test: X passed, Y failed
- Việc còn mở:
```

---

## Task 0.6 — packages/cli: Scaffold + `studio doctor`

### Bối cảnh
Đọc: `AGENTS.md` (lệnh chính, cross-platform), `docs/ARCHITECTURE.md` mục 9 (studio doctor), mục 4 (packages/cli).

### Deliverables

| # | File | Mô tả |
|---|------|--------|
| 1 | `packages/cli/package.json` | Package `@faceless/cli` |
| 2 | `packages/cli/tsconfig.json` | Extends base |
| 3 | `packages/cli/vitest.config.ts` | Config |
| 4 | `packages/cli/src/main.ts` | Entry point — parse args, route to commands |
| 5 | `packages/cli/src/commands/doctor.ts` | `studio doctor` implementation |
| 6 | `packages/cli/src/utils/check-binary.ts` | Helper kiểm tra binary tồn tại + version |
| 7 | `packages/cli/src/__tests__/doctor.test.ts` | Test doctor output format |

### Hướng dẫn chi tiết

**`packages/cli/package.json`:**
```json
{
  "name": "@faceless/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": { "studio": "./dist/main.js" },
  "exports": { ".": { "import": "./dist/main.js" } },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@faceless/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**LƯU Ý:** Không thêm thư viện parse CLI (yargs, commander) ở Phase 0. Dùng `process.argv` trực tiếp cho lệnh đơn giản. Nếu cần thư viện → ghi vào báo cáo, chờ phê duyệt.

**`packages/cli/src/main.ts`:**
```ts
#!/usr/bin/env node

const [command, ...args] = process.argv.slice(2);
const jsonFlag = args.includes("--json");

switch (command) {
  case "doctor":
    const { runDoctor } = await import("./commands/doctor.js");
    await runDoctor({ json: jsonFlag });
    break;
  default:
    if (command) {
      console.error(`Unknown command: ${command}`);
    }
    console.log("Usage: studio <command> [options]");
    console.log("Commands: doctor");
    process.exit(command ? 1 : 0);
}
```

**`packages/cli/src/utils/check-binary.ts`:**
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CheckResult {
  name: string;
  found: boolean;
  version?: string;
  path?: string;
  error?: string;
  fix?: { windows: string; ubuntu: string };
}

/**
 * Kiểm tra binary có trong PATH và lấy version.
 * Gọi bằng danh sách đối số, không qua shell (cross-platform).
 */
export async function checkBinary(
  name: string,
  versionArgs: string[],
  versionPattern: RegExp,
  fix: { windows: string; ubuntu: string },
): Promise<CheckResult> {
  try {
    const { stdout, stderr } = await execFileAsync(name, versionArgs);
    const output = stdout || stderr; // some tools print to stderr
    const match = output.match(versionPattern);
    return {
      name,
      found: true,
      version: match?.[1] ?? "unknown",
      fix,
    };
  } catch (err: any) {
    return {
      name,
      found: false,
      error: err.code === "ENOENT" ? "not found in PATH" : err.message,
      fix,
    };
  }
}
```

**`packages/cli/src/commands/doctor.ts`:**

Kiểm tra danh sách sau (theo ARCHITECTURE.md mục 9):
1. **Node.js ≥ 22** — `node --version`, pattern `/v(\d+\.\d+\.\d+)/`
2. **pnpm** — `pnpm --version`
3. **Python ≥ 3.10** — `python3 --version` (Ubuntu) hoặc `python --version` (Windows)
4. **uv** — `uv --version`
5. **ffmpeg** — `ffmpeg -version`
6. **ffprobe** — `ffprobe -version`

Kết quả:
- Console mode: in bảng emoji (✅/❌) + tên + version + lệnh sửa nếu thiếu.
- `--json` mode: `JSON.stringify({ checks: CheckResult[], allPassed: boolean })` trên stdout, không in gì khác.

```ts
import { checkBinary, type CheckResult } from "../utils/check-binary.js";
import { platform } from "node:os";

const checks = [
  {
    name: "node",
    versionArgs: ["--version"],
    pattern: /v(\d+\.\d+\.\d+)/,
    minMajor: 22,
    fix: { windows: "winget install OpenJS.NodeJS.LTS", ubuntu: "sudo apt install -y nodejs" },
  },
  {
    name: "pnpm",
    versionArgs: ["--version"],
    pattern: /(\d+\.\d+\.\d+)/,
    fix: { windows: "npm i -g pnpm", ubuntu: "npm i -g pnpm" },
  },
  {
    name: platform() === "win32" ? "python" : "python3",
    versionArgs: ["--version"],
    pattern: /Python (\d+\.\d+\.\d+)/,
    minMajor: 3,
    minMinor: 10,
    fix: { windows: "winget install Python.Python.3.12", ubuntu: "sudo apt install -y python3" },
  },
  {
    name: "uv",
    versionArgs: ["--version"],
    pattern: /uv (\d+\.\d+\.\d+)/,
    fix: { windows: "powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\"", ubuntu: "curl -LsSf https://astral.sh/uv/install.sh | sh" },
  },
  {
    name: "ffmpeg",
    versionArgs: ["-version"],
    pattern: /ffmpeg version (\S+)/,
    fix: { windows: "winget install Gyan.FFmpeg", ubuntu: "sudo apt install -y ffmpeg" },
  },
  {
    name: "ffprobe",
    versionArgs: ["-version"],
    pattern: /ffprobe version (\S+)/,
    fix: { windows: "(included with ffmpeg)", ubuntu: "(included with ffmpeg)" },
  },
];

export async function runDoctor(options: { json: boolean }): Promise<void> {
  const results: CheckResult[] = [];

  for (const check of checks) {
    const result = await checkBinary(check.name, check.versionArgs, check.pattern, check.fix);
    results.push(result);
  }

  const allPassed = results.every((r) => r.found);

  if (options.json) {
    process.stdout.write(JSON.stringify({ checks: results, allPassed }, null, 2));
  } else {
    for (const r of results) {
      const icon = r.found ? "✅" : "❌";
      const ver = r.version ? ` (${r.version})` : "";
      const fixMsg = !r.found && r.fix
        ? ` → fix: ${platform() === "win32" ? r.fix.windows : r.fix.ubuntu}`
        : "";
      console.log(`${icon} ${r.name}${ver}${fixMsg}`);
    }
    console.log(allPassed ? "\n🎉 All checks passed!" : "\n⚠️  Some checks failed. See fix suggestions above.");
  }

  process.exit(allPassed ? 0 : 1);
}
```

**Test `doctor.test.ts`:**
```ts
import { describe, it, expect } from "vitest";
import { checkBinary } from "../utils/check-binary.js";

describe("checkBinary", () => {
  it("finds node", async () => {
    const result = await checkBinary("node", ["--version"], /v(\d+\.\d+\.\d+)/, {
      windows: "install node",
      ubuntu: "install node",
    });
    expect(result.found).toBe(true);
    expect(result.version).toMatch(/\d+\.\d+\.\d+/);
  });

  it("reports missing for fake binary", async () => {
    const result = await checkBinary("nonexistent-binary-xyz", ["--version"], /(.*)/, {
      windows: "n/a",
      ubuntu: "n/a",
    });
    expect(result.found).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Tiêu chí tự nghiệm thu

- [ ] `cd packages/cli && pnpm build` thành công.
- [ ] `cd packages/cli && pnpm test` — tất cả test xanh.
- [ ] `node packages/cli/dist/main.js doctor` chạy được, in bảng kiểm tra.
- [ ] `node packages/cli/dist/main.js doctor --json` in JSON hợp lệ ra stdout, `JSON.parse()` thành công.
- [ ] JSON output có trường `checks` (array) và `allPassed` (boolean).
- [ ] Mỗi check có `fix.windows` và `fix.ubuntu`.
- [ ] Không dùng `exec()` (shell), chỉ `execFile()` (danh sách đối số).
- [ ] Không thêm dependency CLI parser ngoài danh sách.

### Báo cáo nghiệm thu
```
## Nghiệm thu Task 0.6
- Trạng thái: PASS / FAIL
- `pnpm build` exit code:
- `pnpm test` exit code:
- `studio doctor` output (console):
- `studio doctor --json` output (first 5 lines):
- Việc còn mở:
```

---

## Task 0.7 — sidecar/ Scaffold (Python/uv)

### Bối cảnh
Đọc: `AGENTS.md` (cross-platform, không .sh/.bat), `docs/ARCHITECTURE.md` ADR-002 (TTS và căn từ chạy trong sidecar Python).

### Deliverables

| # | File | Mô tả |
|---|------|--------|
| 1 | `sidecar/pyproject.toml` | Python project config cho `uv` |
| 2 | `sidecar/tts.py` | Entry point TTS batch CLI — **stub** (nhận JSON, trả JSONL) |
| 3 | `sidecar/align.py` | Entry point Align CLI — **stub** (nhận JSON, trả JSON) |
| 4 | `sidecar/README.md` | Hướng dẫn setup + chạy |

### Hướng dẫn chi tiết

**`sidecar/pyproject.toml`:**
```toml
[project]
name = "faceless-sidecar"
version = "0.0.1"
requires-python = ">=3.10"
description = "TTS and alignment sidecar for Faceless Studio"

[project.scripts]
faceless-tts = "tts:main"
faceless-align = "align:main"

# Dependencies sẽ thêm khi có VieNeu-TTS + WhisperX
# [project.optional-dependencies]
# tts = ["vieneu-tts>=3.0"]
# align = ["whisperx>=3.0"]
```

**`sidecar/tts.py`** — Stub:
```python
"""
Faceless Studio — TTS Sidecar (stub).

Giao thức:
- Input: JSON file path qua argv[1], chứa list jobs:
  [{"id": "j1", "text": "Xin chào", "voice": "default", "speed": 1.0}, ...]
- Output: JSONL trên stdout, mỗi dòng:
  {"jobId": "j1", "audioPath": "audio/chunks/j1.wav", "durationSec": 1.5}
  hoặc {"jobId": "j1", "error": "..."}
- Exit code: 0 nếu tất cả thành công, 1 nếu có lỗi.

Hiện tại: stub — sinh file WAV silence (sử dụng wave module).
Thay bằng VieNeu-TTS khi có model.
"""
import json
import sys
import wave
import struct
from pathlib import Path


def generate_silence_wav(path: Path, duration_sec: float, sample_rate: int = 16000) -> None:
    """Sinh file WAV chứa silence."""
    n_frames = int(sample_rate * duration_sec)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{n_frames}h", *([0] * n_frames)))


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python tts.py <jobs.json>"}), file=sys.stderr)
        sys.exit(1)

    jobs_path = Path(sys.argv[1])
    if not jobs_path.exists():
        print(json.dumps({"error": f"File not found: {jobs_path}"}), file=sys.stderr)
        sys.exit(1)

    jobs = json.loads(jobs_path.read_text(encoding="utf-8"))
    has_error = False

    for job in jobs:
        try:
            job_id = job["id"]
            text = job["text"]
            duration = len(text) * 0.08  # ~80ms per character estimate
            out_path = Path(job.get("outputDir", "audio/chunks")) / f"{job_id}.wav"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            generate_silence_wav(out_path, duration)
            result = {"jobId": job_id, "audioPath": str(out_path), "durationSec": round(duration, 3)}
            print(json.dumps(result, ensure_ascii=False), flush=True)
        except Exception as e:
            has_error = True
            print(json.dumps({"jobId": job.get("id", "?"), "error": str(e)}, ensure_ascii=False), flush=True)

    sys.exit(1 if has_error else 0)


if __name__ == "__main__":
    main()
```

**`sidecar/align.py`** — Stub:
```python
"""
Faceless Studio — Alignment Sidecar (stub).

Giao thức:
- Input: JSON qua argv[1]:
  {"audioPath": "audio/narration.wav", "text": "Xin chào thế giới", "lang": "vi"}
- Output: JSON trên stdout:
  {"words": [{"id": "w001", "text": "Xin", "startSec": 0.0, "endSec": 0.3, "confidence": 0.95}, ...]}

Hiện tại: stub — phân bổ đều từng từ.
Thay bằng WhisperX/stable-ts sau spike.
"""
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python align.py <input.json>"}), file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(json.dumps({"error": f"File not found: {input_path}"}), file=sys.stderr)
        sys.exit(1)

    data = json.loads(input_path.read_text(encoding="utf-8"))
    text = data["text"]
    raw_words = text.split()

    avg_dur = 0.3  # 300ms per word
    words = []
    for i, w in enumerate(raw_words):
        words.append({
            "id": f"w{i + 1:03d}",
            "text": w,
            "startSec": round(i * avg_dur, 3),
            "endSec": round((i + 1) * avg_dur, 3),
            "confidence": 0.95,
        })

    result = {"words": words}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
```

**`sidecar/README.md`:**
```markdown
# Faceless Sidecar (TTS + Alignment)

## Setup
\```bash
cd sidecar
uv venv
uv pip install -e .
\```

## Chạy TTS (stub)
\```bash
echo '[{"id":"j1","text":"Xin chào","voice":"default"}]' > /tmp/jobs.json
uv run python tts.py /tmp/jobs.json
\```

## Chạy Align (stub)
\```bash
echo '{"audioPath":"test.wav","text":"Xin chào thế giới","lang":"vi"}' > /tmp/align-input.json
uv run python align.py /tmp/align-input.json
\```

## Trạng thái
- [ ] TTS: stub (silence WAV). Cần VieNeu-TTS v3 Turbo.
- [ ] Align: stub (phân bổ đều). Cần spike WhisperX / stable-ts.
```

### Tiêu chí tự nghiệm thu

- [ ] `cd sidecar && uv venv && uv pip install -e .` thành công (nếu uv có sẵn).
- [ ] `python3 sidecar/tts.py` (không đối số) → exit 1, stderr có JSON error.
- [ ] Tạo file `/tmp/test-jobs.json` với 1 job → `python3 sidecar/tts.py /tmp/test-jobs.json` → stdout có 1 dòng JSONL, parse được, có `jobId`, `audioPath`, `durationSec`.
- [ ] File WAV được tạo ở đường dẫn trong `audioPath`, `ffprobe` xác nhận là WAV hợp lệ (nếu có ffprobe).
- [ ] `python3 sidecar/align.py` (không đối số) → exit 1.
- [ ] Tạo file input align → stdout có JSON, có `words` array, mỗi word có `id`, `text`, `startSec`, `endSec`, `confidence`.
- [ ] Không có file `.sh` hay `.bat`.

### Báo cáo nghiệm thu
```
## Nghiệm thu Task 0.7
- Trạng thái: PASS / FAIL
- `uv venv` thành công: YES / NO / SKIPPED (uv not found)
- TTS stub test: PASS / FAIL
- Align stub test: PASS / FAIL
- WAV file valid: YES / NO / SKIPPED
- Việc còn mở:
```

---

## Tổng hợp Phase 0 — Checklist nghiệm thu cuối

Sau khi tất cả 7 task hoàn thành, chạy checklist sau từ root:

```bash
# 1. Install all dependencies
pnpm install

# 2. Build all packages
pnpm build

# 3. Run all tests
pnpm test

# 4. Run doctor
node packages/cli/dist/main.js doctor --json

# 5. Verify no React/Remotion in core
grep -rn "from 'react\|from 'remotion\|from '@remotion" packages/core/src/ packages/media/src/

# 6. Verify docs exist
ls docs/ROADMAP.md docs/VIDEO-SPEC.md docs/PIPELINE.md docs/TEMPLATES-AND-TOPICS.md docs/CINEMATIC-GRAMMAR.md docs/ASSETS-AND-AUDIO.md docs/QA-GATES.md docs/SKILLS.md

# 7. Verify sidecar
python3 sidecar/tts.py 2>&1 | head -1
python3 sidecar/align.py 2>&1 | head -1

# 8. Verify .gitattributes
cat .gitattributes
```

**Phase 0 PASS khi:**
- [ ] `pnpm build` exit 0
- [ ] `pnpm test` exit 0, tất cả test xanh
- [ ] `studio doctor --json` trả JSON hợp lệ
- [ ] `docs/VIDEO-SPEC.md` khớp zod schema (cùng commit)
- [ ] `docs/ROADMAP.md` có đầy đủ 5 phase
- [ ] Sidecar stub chạy được
- [ ] Không có import React/Remotion trong core/media
- [ ] `.gitattributes` có `* text=auto eol=lf`

---

## Ghi chú cho Orchestrator (review)

Khi sub-agent nộp báo cáo nghiệm thu, tôi sẽ:
1. Đọc code diff/file thực tế, không chỉ tin báo cáo.
2. Kiểm tra cross-reference: schema zod ↔ VIDEO-SPEC.md ↔ test fixtures.
3. Kiểm tra AGENTS.md compliance: no React in core, no shell strings, kebab-case files.
4. Chạy lại checklist tổng hợp.
5. **PASS** → commit + tag `phase-0-done`. **REJECT** → ghi lý do, trả task.
