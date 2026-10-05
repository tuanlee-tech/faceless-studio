## Nghiệm thu Task 0.3

- Trạng thái: **PASS**
- `pnpm build` exit code: **0**
- `pnpm test` exit code: **0**
- Số test: **7 passed, 0 failed**
- grep React/Remotion: **(trống — không tìm thấy)**
- Việc còn mở: **Không có**

---

### Chi tiết kiểm tra

#### 1. Build & TypeScript
```
cd packages/core && pnpm install && pnpm build
→ Exit code 0, không lỗi TypeScript
```

#### 2. Unit Tests
```
cd packages/core && pnpm test
→ 7 tests passed (VideoSpecSchema: 4, ProjectConfigSchema: 2, ProjectStateSchema: 1)
```

#### 3. Không phụ thuộc React/Remotion/Browser API
```
grep -rn "from 'react\|from 'remotion\|from '@remotion\|window\.\|document\." packages/core/src/
→ Không có kết quả (exit code 1)
```

#### 4. Schema export: Zod schema + TypeScript type
| File | Zod Schema | Type Export |
|------|------------|-------------|
| video-spec.ts | `VideoSpecSchema`, `ChapterSchema`, `BeatSchema`, `CaptionSchema`, `SfxSchema`, `AssetRefSchema`, `WordSchema`, `NarrationSchema`, `MusicTrackSchema`, `WordRefSchema`, `TimeRangeSchema` | `VideoSpec`, `Chapter`, `Beat`, `Caption`, `Sfx`, `WordEntry`, `Narration`, `MusicTrack`, `AssetRef` |
| project-config.ts | `ProjectConfigSchema`, `FormatIdSchema` | `ProjectConfig` |
| stage-state.ts | `ProjectStateSchema`, `StageEntrySchema`, `StageStatusSchema` | `ProjectState`, `StageEntry`, `StageStatus` |

Tất cả được re-export qua `schemas/index.ts` → `src/index.ts`.

#### 5. specVersion
```
export const SPEC_VERSION = "0.1.0";
```

#### 6. VideoSpecSchema enforcement
| Quy tắc | Kết quả | Dòng |
|---------|---------|------|
| chapters.min(1) | ✅ `z.array(ChapterSchema).min(1)` | 110 |
| words là mảng bắt buộc | ✅ `z.array(WordSchema)` (không optional) | 87 |
| beat.range neo theo wordId | ✅ `range: TimeRangeSchema` với `startWordId`, `endWordId` | 13-17, 52 |
| Không có trường giây trong beat | ✅ Chỉ có `range`, không có `startSec`/`endSec` | 49-65 |

---

### Tóm tắt
Tất cả deliverables của Task 0.3 đã hoàn thành và pass mọi tiêu chí tự nghiệm thu.