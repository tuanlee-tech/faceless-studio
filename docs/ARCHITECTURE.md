# ARCHITECTURE

## 1. Mục tiêu và ngoài phạm vi

**Mục tiêu**
- Từ `idea.md` (chủ đề hoặc nội dung thô, tùy chọn kèm link/bản nháp tham khảo) → video dài 16:9 (5–30 phút) + 2–N Short 9:16.
- Nhiều chủ đề, mỗi chủ đề dùng được nhiều template; chất lượng hình ảnh theo chuẩn editor chuyên nghiệp (nhịp cắt, chữ, ánh sáng, âm thanh).
- Tinh gọn, dễ dùng, mở rộng thành UI mà không viết lại lõi.
- Windows 10 và Ubuntu 24.04, CPU-first.

**Ngoài phạm vi (giai đoạn đầu):** video có người thật/talking-head; chỉnh sửa video có sẵn; đăng tải tự động lên nền tảng; multi-user/cloud;

## 2. Nguyên tắc thiết kế

| # | Nguyên tắc | Hệ quả |
|---|---|---|
| P1 | Project folder là nguồn sự thật | UI/agent/CLI đều đọc-ghi cùng một cấu trúc; resume được; diff được bằng git |
| P2 | Spec tách khỏi renderer | `spec.json` không chứa React/pixel; đổi renderer sau này chỉ viết adapter mới |
| P3 | Neo theo từ | Sửa script → chạy lại TTS+align cho câu đổi → spec tự cập nhật thời lượng |
| P4 | Bước tất định ≠ bước sáng tạo | Tất định: CLI/UI làm. Sáng tạo: đi qua Task Inbox |
| P5 | Cache theo hash đầu vào | Chạy lại rẻ; chỉ tái tạo phần đổi (TTS theo câu, render theo chương) |
| P6 | Đồng bộ cấu hình, không đồng bộ phép màu | Mọi lựa chọn (template, topic, ngân sách asset, ngưỡng QA) nằm trong file cấu hình có schema |

## 3. Các lớp

```text
 idea.md ─► [Director Pipeline] ─► spec.json ─► [Renderer Adapter] ─► mp4 (16:9, 9:16)
              │   ▲                  ▲  ▲              ▲
   Task Inbox │   │ results          │  │              │ Template Pack (layout, subtitle,
   (agent/UI) ▼   │                  │  │              │ motion, effects, style bible)
          tasks/*.md → results/*.json│  └── Asset Router (code / still / clip / stock / manual)
                                     │
                       TTS + Align (sidecar) ─► narration.wav + words[] (word IDs)
                       Audio mix (ffmpeg): music, SFX, ducking, loudness
```

## 4. Cấu trúc repo (monorepo)

```text
faceless-studio/
  AGENTS.md  README.md  .gitattributes
  docs/                    tài liệu (bộ này)
  skills/                  nguồn của skill tự viết (đồng bộ sang .agent/skills bằng script)
  packages/
    core/                  schema (zod), stages, cache, events, Task Inbox — KHÔNG phụ thuộc UI/Remotion
    media/                 ffmpeg wrapper, client TTS/align (gọi sidecar), mix âm thanh, xử lý ảnh/alpha
    renderer-remotion/     Composition Long16x9 + Short9x16, component, layout, motion preset, effect
    cli/                   lệnh `studio`
  sidecar/                 Python (uv): tts.py, align.py (batch CLI, JSON in/out)
  templates/<id>/          Template Pack
  topics/<id>/             Topic Pack
  library/                 music/, sfx/ + library.json (license)
  projects/<slug>/         dữ liệu video (gitignore)
  scripts/                 doctor, sync-skills (Node, đa nền tảng)
  apps/                    (Phase 4) server/ và web/
```

## 5. Thư mục project (nguồn sự thật)

```text
projects/<slug>/
  project.json        cấu hình: topic, template, targetMinutes, formats, budget, ngưỡng QA
  idea.md             đầu vào thô (+ link tham khảo)
  state.json          trạng thái từng stage + hash đầu vào/đầu ra
  events.jsonl        nhật ký sự kiện (UI đọc để hiển thị tiến độ)
  research/notes.md   (tùy chọn) ghi chú nguồn, có nhãn [VERIFY]
  script/             outline.json, script.md (câu có ID)
  audio/              chunks/<hash>.wav, narration.wav, words.json, mix/
  spec.json           Video Spec (xem VIDEO-SPEC.md)
  assets/             manifest.json, requests/ (prompt pack), incoming/, processed/, code/
  tasks/ results/     Task Inbox
  out/                long-16x9/, short-9x16/, thumbnails/, qa/
```

## 6. Task Inbox (cách tách việc sáng tạo khỏi việc tất định)

Khi một bước cần LLM sáng tạo, `core` **không gọi LLM**. Nó ghi một file task:

```text
tasks/003-direct-chapter-2.md
  ---
  id: 003
  stage: direct
  skill: faceless-director
  inputs: [script/script.md, audio/words.json, templates/baroque-mono/template.json]
  output: results/003-direct-chapter-2.json
  schema: packages/core/schemas/beats.schema.json
  ---
  (bối cảnh + yêu cầu + ví dụ ngắn)
```

Vòng đời: `pending → fulfilled → validated | rejected`. Agent điền `results/…`; `studio validate` kiểm theo schema và luật nghiệp vụ; nếu sai, ghi `results/…errors.md` để agent sửa. Lợi ích: (a) agent nào cũng làm được, kể cả chat thủ công; (b) UI sau này chỉ cần hiển thị hàng đợi task, hoặc nối thẳng API LLM mà không đổi lõi; (c) mọi bước sáng tạo có dấu vết và chạy lại được.

## 7. Quyết định kiến trúc (ADR)

### ADR-001 — Renderer mặc định: Remotion

- **Quyết định:** dùng Remotion cho cả hai khung (`Long16x9`, `Short9x16`) từ cùng component và cùng spec.
- **Lý do:** trưởng thành; nhiều Composition kích thước khác nhau từ một codebase; Remotion Player nhúng được vào UI; render theo khoảng frame (chia chương); skill chính thức cho agent.
- **License (kiểm tra tháng 10/2026):** miễn phí cho cá nhân và tổ chức tối đa 3 người, kể cả thương mại. Từ 4 người trở lên cần Company License (có phí). Dùng hợp lệ: người dùng điền nội dung vào template của mình rồi render. Không hợp lệ: cho người dùng nộp dự án Remotion tùy ý để render trên server. → **Khi UI thành sản phẩm cho người khác hoặc đội ≥ 4 người, kiểm tra lại license trước khi làm.**
- **GSAP/Three.js trong Remotion:** chỉ dùng dưới dạng timeline tạm dừng được `seek(frame / fps)`; Three.js qua `@remotion/three`. Không dùng Framer Motion/CSS animation tự chạy (không tất định theo frame).
- **Điều kiện xem lại:** (a) template cần nhiều GSAP/hiệu ứng tới mức gượng ép trong Remotion; (b) license thành rào cản. Khi đó đánh giá HyperFrames (HTML-native, Apache-2.0, adapter GSAP/Three có sẵn) bằng spike 1–2 ngày trên Template A. Ranh giới `RendererAdapter` (mục 8) giữ cho việc đổi chỉ tốn viết adapter.

### ADR-002 — TTS và căn từ chạy trong sidecar Python (batch CLI)

- **Quyết định:** `sidecar/tts.py` bọc **VieNeu-TTS v3 Turbo** (bản open-source; v4 chỉ có qua API riêng nên không dùng). `sidecar/align.py` căn từ theo **văn bản đã biết** (forced alignment). Node gọi bằng tiến trình con, đưa vào một file JSON công việc theo lô, nhận JSONL tiến độ.
- **Lý do:** nạp model mất hàng chục giây trên CPU → xử lý theo lô cả chương; tránh quản lý server; chạy giống nhau trên Windows/Ubuntu với `uv`. Có thể nâng thành server thường trực khi làm UI.
- **CPU-first:** README VieNeu đo RTF ≈ 0.5 trên i5 đời 12 (≈ 2 phút giọng mất ≈ 1 phút sinh). Đường GPU (PyTorch 2.8 + CUDA 12.8) chưa xác nhận chạy được trên card Pascal đời cũ → không phụ thuộc.
- **Căn từ:** ứng viên mặc định WhisperX (wav2vec2 tiếng Việt) hoặc stable-ts; chọn bằng spike ở Phase 0 trên giọng VieNeu thật (tiêu chí: lệch từ trung bình < 80 ms, không mất từ).

### ADR-003 — Spec là JSON, schema bằng zod

`zod` là nguồn sự thật; xuất JSON Schema cho agent (Task Inbox) và UI. Phiên bản hóa bằng `specVersion`, có hàm migrate.

### ADR-004 — Không tích hợp Hypit hay FlowKit

Chỉ lấy triết lý: neo theo từ, spec khai báo + biến thể, component cắm rút (Hypit); entity/ảnh tham chiếu để nhất quán, prompt chuyển động có mốc thời gian, review bằng contact sheet (FlowKit). FlowKit là tự động hóa giao diện web không chính thức (rủi ro tài khoản, dễ vỡ) → chỉ xem xét như `AssetProvider` tùy chọn nếu nó thay thế được bước dán tay mà không tăng độ phức tạp lõi.

## 8. Ranh giới mở rộng

```ts
// packages/core
interface RendererAdapter {
  render(o: { specPath: string; format: FormatId; frames?: [number, number]; outPath: string; onProgress(p: number): void }): Promise<void>;
  still(o: { specPath: string; format: FormatId; frame: number; outPath: string }): Promise<void>;
}
interface AssetProvider {            // mặc định: "manual" (prompt pack + import)
  name: string; kinds: Array<"image" | "video">;
  request(r: AssetRequest): Promise<AssetResult | { status: "needs-manual"; packPath: string }>;
}
interface TtsEngine { synthesizeBatch(jobs: TtsJob[]): AsyncIterable<TtsResult>; }
interface Aligner  { align(audioPath: string, text: string, lang: "vi"): Promise<Word[]>; }
```

Mỗi interface có đúng một hiện thực ở MVP. Không thêm hiện thực thứ hai trước khi có nhu cầu thật.

## 9. Cross-platform

Xem mục “Cross-platform” trong `AGENTS.md`. Thêm: `studio doctor` kiểm Node ≥ 22, Python ≥ 3.10 + `uv`, `ffmpeg`/`ffprobe`, Chrome của Remotion, quyền ghi đường dẫn dài trên Windows, dung lượng đĩa, font nạp được và **kiểm glyph tiếng Việt**, sidecar TTS/align chạy được; mỗi lỗi kèm lệnh sửa cho Windows (winget/choco) và Ubuntu (apt). Máy Ubuntu không GPU: tra tùy chọn `gl` của Remotion cho cảnh WebGL; mặc định hạn chế cảnh 3D (xem ngân sách trong `PIPELINE.md`).

## 10. Hiệu năng (video dài)

- 30 phút ở 30 fps = 54.000 frame. Render **theo chương** (khoảng frame), rồi ghép bằng FFmpeg; chương không đổi dùng lại từ cache.
- TTS theo câu có cache (`hash(text, voice, engineVersion, speed)`); sửa một câu chỉ tổng hợp lại câu đó và căn lại cả chương.
- Hạn chế: lớp blur/shadow lớn, video nền độ phân giải cao chồng nhiều lớp, Three.js trên máy không GPU. Đặt “ngân sách hiệu ứng” mỗi beat và đo thời gian render ở Phase 0–1 để chỉnh.
- Mặc định xem trước bằng độ phân giải thấp (`--scale 0.5`) và chỉ render đầy đủ khi QA đạt.

## 11. Hướng UI (Phase 4, thiết kế sẵn từ bây giờ)

- `apps/server`: lớp HTTP mỏng bọc `core` (REST + SSE đọc `events.jsonl`). Không thêm logic nghiệp vụ.
- `apps/web`: React + Remotion Player. Màn hình: **Tạo video** (ý tưởng, chủ đề, template, độ dài, khung) · **Duyệt script** · **Storyboard** (thẻ beat có ảnh xem trước + trạng thái asset) · **Asset** (tải xuống prompt pack, kéo-thả asset vào) · **Hàng đợi render** · **Thư viện template/chủ đề**.
- Việc routine (đổi template, chỉnh style subtitle, render lại một chương, xuất Short) là thao tác UI → gọi cùng lệnh CLI. Chỉ việc sáng tạo mới cần agent (hoặc API LLM nối vào Task Inbox).
- Hợp đồng UI ↔ lõi chính là: `studio … --json`, `state.json`, `events.jsonl`, schema JSON. Mọi thứ khác là chi tiết.
