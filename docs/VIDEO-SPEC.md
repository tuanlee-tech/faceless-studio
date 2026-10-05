# VIDEO-SPEC.md — Đặc tả `spec.json`

> **specVersion:** `0.1.0`  
> **Mục đích:** Định dạng dữ liệu trung gian (intermediate representation) cho một video faceless. Được sinh từ pipeline `outline → script → direct`, sau đó nạp vào renderer (Remotion) để xuất video.  
> **Quy tắc phiên bản hóa:** `specVersion` tuân thủ **semantic versioning cho dữ liệu**. Nâng `PATCH` khi thêm trường optional, `MINOR` khi thêm trường required hoặc thay đổi ý nghĩa trường, `MAJOR` khi xóa/bỏ đổi trường required hoặc đổi cấu trúc lồng (breaking change). Mọi thay đổi schema **phải** cập nhật cả file này và zod schema trong cùng một commit (Luật vàng #1).

---

## 1. Bảng tổng quan — Top-level fields

| Trường | Kiểu | Required | Mặc định | Mô tả |
|--------|------|----------|----------|-------|
| `specVersion` | `string` | ✅ | — | Phiên bản spec, phải khớp `SPEC_VERSION` trong zod. |
| `projectSlug` | `string` | ✅ | — | Slug dự án (kéo từ `project.json`), dùng làm tên thư mục. |
| `topicId` | `string` | ✅ | — | ID chủ đề (ví dụ: `sample`, `psychology`, `history`). |
| `templateId` | `string` | ✅ | — | ID template (ví dụ: `minimal`, `baroque-mono`, `clean-split`). |
| `fps` | `integer` > 0 | ❌ | `30` | Khung hình mỗi giây. |
| `narration` | `Narration` | ✅ | — | Thông tin lời đọc + alignment theo từ. |
| `chapters` | `Chapter[]` | ✅ (min 1) | — | Danh sách chương, mỗi chương chứa các beat. |
| `music` | `MusicTrack[]` | ❌ | `[]` | Danh sách track nhạc nền. |
| `meta` | `Record<string, unknown>` | ❌ | `{}` | Metadata bổ sung (title, description, tags cho YouTube, v.v.). |

---

## 2. Chi tiết các object lồng

### 2.1 `Word` — Một từ trong lời đọc

Mọi beat, caption, SFX **neo vào word ID** — không hard-code timestamp giây trong beat (Luật vàng #3).

| Trường | Kiểu | Required | Mô tả |
|--------|------|----------|-------|
| `id` | `string` | ✅ | ID duy nhất toàn spec, format khuyến nghị `w001`, `w002`... |
| `text` | `string` | ✅ | Văn bản gốc (tiếng Việt, không dấu câu tách riêng). |
| `startSec` | `number` ≥ 0 | ✅ | Thời điểm bắt đầu (giây) trong file narration audio. |
| `endSec` | `number` ≥ 0 | ✅ | Thời điểm kết thúc (giây). |
| `confidence` | `number` 0–1 | ✅ | Độ tin cậy alignment. Dưới 0.5 → cảnh báo QA. |

### 2.2 `Narration` — Lời đọc hoàn chỉnh

| Trường | Kiểu | Required | Mô tả |
|--------|------|----------|-------|
| `audioPath` | `string` | ✅ | Đường dẫn tương đối từ project root tới file narration (WAV/MP3). |
| `durationSec` | `number` > 0 | ✅ | Tổng thời lượng narration (giây). |
| `words` | `Word[]` | ✅ | Tất cả từ, theo thứ tự đọc. Không được rỗng. |

### 2.3 `Chapter` — Chương

| Trường | Kiểu | Required | Mô tả |
|--------|------|----------|-------|
| `id` | `string` | ✅ | ID chương, format khuyến nghị `c1`, `c2`... |
| `title` | `string` | ✅ | Tiêu đề chương (hiển thị trên UI, chapter marker). |
| `beats` | `Beat[]` | ✅ (min 1) | Danh sách beat trong chương. |

### 2.4 `Beat` — Đơn vị trình bày nhỏ nhất

**Quan trọng:** Beat **không chứa trường giây trực tiếp**. Thời gian suy ra từ `range` tham chiếu `wordId`.

| Trường | Kiểu | Required | Mặc định | Mô tả |
|--------|------|----------|----------|-------|
| `id` | `string` | ✅ | — | ID beat, format khuyến nghị `b1`, `b2`... (unique trong toàn spec). |
| `range` | `TimeRange` | ✅ | — | Khoảng thời gian neo theo từ (xem 2.4.1). |
| `layout` | `string` | ✅ | — | Tên layout preset từ template (ví dụ: `center-text`, `split-left`, `full-bleed`). |
| `motion` | `string` | ❌ | — | Tên motion preset từ template (ví dụ: `fade-in`, `ken-burns-slow`). |
| `assets` | `AssetRef[]` | ❌ | `[]` | Asset hiển thị trong beat này. |
| `captions` | `Caption[]` | ❌ | `[]` | Dòng phụ đề trong beat. |
| `sfx` | `Sfx[]` | ❌ | `[]` | Trigger SFX trong beat. |
| `directorNote` | `string` | ❌ | — | Ghi chú cho đạo diễn/agent (không render ra video). |

#### 2.4.1 `TimeRange` — Khoảng neo theo từ

| Trường | Kiểu | Required | Mô tả |
|--------|------|----------|-------|
| `startWordId` | `string` | ✅ | ID từ đầu tiên trong khoảng (tham chiếu `words[].id`). |
| `endWordId` | `string` | ✅ | ID từ cuối cùng trong khoảng. |

> **Quy tắc:** `startWordId` phải xuất hiện trước hoặc trùng `endWordId` trong mảng `narration.words`.

### 2.5 `Caption` — Dòng phụ đề

| Trường | Kiểu | Required | Mô tả |
|--------|------|----------|-------|
| `id` | `string` | ✅ | ID caption line, format khuyến nghị `cap1`, `cap2`... |
| `wordIds` | `string[]` | ✅ (min 1) | Danh sách word IDs tạo thành dòng caption này (liên tiếp trong `words`). |
| `style` | `Record<string, unknown>` | ❌ | Override style (fontSize, color, position...) nếu khác template default. |

### 2.6 `Sfx` — Hiệu ứng âm thanh

| Trường | Kiểu | Required | Mặc định | Mô tả |
|--------|------|----------|----------|-------|
| `id` | `string` | ✅ | — | ID SFX trigger, unique trong beat. |
| `anchorWordId` | `string` | ✅ | — | Word ID neo SFX (tham chiếu `words[].id`). |
| `offsetSec` | `number` | ❌ | `0` | Offset (giây) so với `startSec` của anchor word. Âm = trước từ, dương = sau từ. |
| `sfxId` | `string` | ✅ | — | Tên SFX trong library (`library/sfx/`). |
| `volume` | `number` 0–1 | ❌ | `0.8` | Âm lượng phát. |

### 2.7 `AssetRef` — Tham chiếu asset

Mọi asset phải có license rõ ràng (Luật vàng #8).

| Trường | Kiểu | Required | Mô tả |
|--------|------|----------|-------|
| `assetId` | `string` | ✅ | ID asset trong project (`assets/manifest.json`). |
| `filePath` | `string` | ✅ | Đường dẫn tương đối từ project root. |
| `kind` | `"image" \| "video" \| "code"` | ✅ | Loại asset. |
| `license` | `string` | ✅ | License identifier (ví dụ: `CC0`, `CC-BY-4.0`, `custom-internal`). |

### 2.8 `MusicTrack` — Track nhạc nền

| Trường | Kiểu | Required | Mặc định | Mô tả |
|--------|------|----------|----------|-------|
| `id` | `string` | ✅ | — | ID track, unique trong `music[]`. |
| `libraryId` | `string` | ✅ | — | Tên trong library (`library/music/`). |
| `startSec` | `number` ≥ 0 | ✅ | — | Bắt đầu ở giây nào của video (0 = đầu video). |
| `endSec` | `number` ≥ 0 | ❌ | — | Kết thúc (giây). Không set → chạy tới hết video hoặc track sau. |
| `volume` | `number` 0–1 | ❌ | `0.3` | Âm lượng cơ bản. Ducking sẽ giảm thêm khi có narration. |

---

## 3. Ví dụ JSON tối thiểu

Copy từ test fixture (`packages/core/src/schemas/__tests__/schemas.test.ts`), format đẹp:

```json
{
  "specVersion": "0.1.0",
  "projectSlug": "test-01",
  "topicId": "sample",
  "templateId": "minimal",
  "fps": 30,
  "narration": {
    "audioPath": "audio/narration.wav",
    "durationSec": 60,
    "words": [
      {
        "id": "w001",
        "text": "Xin",
        "startSec": 0,
        "endSec": 0.3,
        "confidence": 0.95
      },
      {
        "id": "w002",
        "text": "chào",
        "startSec": 0.3,
        "endSec": 0.6,
        "confidence": 0.92
      }
    ]
  },
  "chapters": [
    {
      "id": "c1",
      "title": "Mở đầu",
      "beats": [
        {
          "id": "b1",
          "range": {
            "startWordId": "w001",
            "endWordId": "w002"
          },
          "layout": "center-text",
          "captions": [
            {
              "id": "cap1",
              "wordIds": ["w001", "w002"]
            }
          ]
        }
      ]
    }
  ],
  "music": [],
  "meta": {}
}
```

---

## 4. Quy tắc bắt buộc

### 4.1 Neo theo từ (Word-anchored)
- **Beat:** `range` chỉ chứa `startWordId` + `endWordId`. Không có `startSec`/`endSec` trong beat.
- **Caption:** `wordIds` tham chiếu mảng `words` theo thứ tự.
- **SFX:** `anchorWordId` + `offsetSec`. Không có timestamp tuyệt đối.
- **Lợi ích:** Thay đổi TTS speed / alignment không cần sửa spec; renderer tính toán frame từ word timestamp tại runtime.

### 4.2 specVersion
- Mọi commit thay đổi schema **bắt buộc** cập nhật `SPEC_VERSION` trong `video-spec.ts` và `specVersion` trong doc này.
- Breaking change → nâng `MAJOR` (0.x → 1.0).
- Thêm trường optional → nâng `PATCH` (0.1.0 → 0.1.1).

### 4.3 License asset
- Mọi `AssetRef` **bắt buộc** có trường `license` không rỗng.
- License phải tồn tại trong `library/library.json` hoặc `assets/manifest.json`.
- Không dùng asset không rõ license.

### 4.4 Tính tất định (Determinism)
- `spec.json` là input duy nhất của renderer. Không có random, không đọc filesystem ngẫu nhiên, không dùng `Date.now()`.
- Mọi animation là hàm của `frame` (Remotion `interpolate`/`spring` hoặc GSAP timeline `seek(frame / fps)`).

### 4.5 Validation
- `VideoSpecSchema.parse(spec)` phải pass trước khi render.
- QA gate kiểm tra: `words` không rỗng, `chapters` ≥ 1, mọi `wordId` trong beat/caption/sfx tồn tại trong `narration.words`.

---

## 5. Changelog

### 0.1.0 — Khởi tạo (2026-10-05)
- Định nghĩa `VideoSpecSchema` lần đầu.
- Các object: `Word`, `Narration`, `Chapter`, `Beat`, `TimeRange`, `Caption`, `Sfx`, `AssetRef`, `MusicTrack`.
- Top-level: `specVersion`, `projectSlug`, `topicId`, `templateId`, `fps`, `narration`, `chapters`, `music`, `meta`.
- Quy tắc: neo theo từ, specVersion semantic, license bắt buộc, determinism.
- Ví dụ JSON tối thiểu trong test fixture.

---