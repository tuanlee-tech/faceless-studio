# Kế hoạch thực thi Phase 3 — Short 9:16, QA Gates & Audio Mix

> **Mục tiêu:** 
> 1. Trích xuất và dựng video ngắn 9:16 (Shorts/TikTok/Reels) từ các đoạn `shortCandidate` trong `spec.json`.
> 2. Xây dựng hệ thống QA Gates (`studio qa --pre` và `--post`) kiểm tra chất lượng từ spec, license, asset tới file video đầu ra.
> 3. Hệ thống Audio Mixing (Narration + Music + SFX + Ducking) đạt chuẩn âm lượng YouTube (-14 LUFS ± 1).
> 
> **Thời gian dự kiến:** 4-5 tasks.

---

## Danh sách Tasks Phase 3

### Task 3.1: Cơ chế Short 9:16 & Lệnh `studio shorts`
**Package:** `@faceless/core`, `@faceless/renderer-remotion`, `@faceless/cli`
**Mô tả:**
- Cập nhật `docs/VIDEO-SPEC.md` và `BeatSchema` trong `@faceless/core`: Thêm trường `shortCandidate: z.boolean().default(false)` và `shortHook?: string` (Luật vàng #1).
- Xây dựng module `ShortsExtractor` trong `@faceless/core`:
  - Quét `spec.json` tìm các beat được đánh dấu `shortCandidate: true` (hoặc phân đoạn theo thời lượng tiêu chuẩn 30–60 giây).
  - Trích xuất sub-spec độc lập cho từng video Short (chứa narration words, beats, assets tương ứng).
- Tích hợp vào `RemotionRendererAdapter`: Hỗ trợ render định dạng `short-9x16` (1080x1920) tối ưu cho giao diện di động.
- Triển khai lệnh CLI `studio shorts <slug>`:
  - Tự động tìm các short candidates, render ra `projects/<slug>/dist/shorts/short-*.mp4`.
  - Cập nhật trạng thái `short-9x16` thành `done` trong `state.json` và ghi sự kiện vào `events.jsonl`.
**Tiêu chí nghiệm thu:**
- Lệnh `studio shorts <slug>` xuất ra ≥ 1 video MP4 9:16 hợp lệ với kích thước 1080x1920.

---

### Task 3.2: Hệ thống QA Gates & Lệnh `studio qa`
**Package:** `@faceless/core`, `@faceless/cli`
**Mô tả:**
- Xây dựng module `QAEngine` trong `@faceless/core`:
  - **Pre-render QA (`studio qa <slug> --pre`):**
    - Kiểm tra tính hợp lệ của `spec.json` theo Zod schema.
    - Kiểm tra sự tồn tại và tính nguyên vẹn của toàn bộ Visual Assets trong `manifest.json`.
    - Kiểm tra giấy phép bản quyền của mọi asset, nhạc, SFX qua `LicenseManager` (Golden Rule #8).
    - Kiểm tra độ tin cậy của phụ đề (`confidence >= 0.5` cho toàn bộ từ).
    - Cảnh báo các khẳng định chưa kiểm chứng `[VERIFY]` theo Fact Policy (Golden Rule #9).
  - **Post-render QA (`studio qa <slug> --post`):**
    - Kiểm tra sự tồn tại của file MP4 đầu ra trong `dist/`.
    - Kiểm tra định dạng video (codec h264, tỉ lệ khung hình, fps, bitrate).
    - Kiểm tra thời lượng video thực tế so với kịch bản (sai số cho phép < 2 giây).
    - Kiểm tra tính toàn vẹn âm thanh (đo loudness LUFS, phát hiện clipping/silence).
- Triển khai lệnh CLI `studio qa <slug> --pre|--post [--json]`:
  - Trả về danh sách chi tiết các tiêu chí (Checks, Status, Severity, Message).
  - Thoát mã 0 nếu đạt, thoát mã 1 nếu phát hiện lỗi nghiêm trọng (Critical error).
**Tiêu chí nghiệm thu:**
- `studio qa <slug> --pre` và `studio qa <slug> --post` chạy được, in kết quả dạng bảng hoặc JSON chính xác.

---

### Task 3.3: Audio Mixing Pipeline & Ducking
**Package:** `@faceless/media`, `@faceless/renderer-remotion`
**Mô tả:**
- Triển khai cơ chế Audio Ducking: Tự động giảm âm lượng nhạc nền xuống mức 15–20% khi có giọng đọc narration, và khôi phục về mức 40–50% trong các khoảng nghỉ giữa các câu.
- Tích hợp SFX triggers: Kích hoạt hiệu ứng âm thanh theo đúng `anchorWordId` và `offsetSec` trong beat.
- Chuẩn hóa âm lượng: Đảm bảo âm thanh xuất xưởng đạt mức YouTube Target (-14 LUFS ± 1 LUFS) không bị clipping hay méo tiếng.
**Tiêu chí nghiệm thu:**
- Nhạc nền tự động giảm âm lượng khi có lời đọc, SFX phát đúng vị trí neo từ.

---

### Task 3.4: Cập nhật Tài liệu & Đúc kết Bài học
**Thư mục:** `docs/`
**Mô tả:**
- Viết đầy đủ `docs/QA-GATES.md` (hướng dẫn vận hành QA pre và post render).
- Cập nhật `docs/CINEMATIC-GRAMMAR.md` và `docs/PIPELINE.md`.
- Cập nhật `docs/ROADMAP.md` (đánh dấu hoàn thành Phase 3).
- Bổ sung các bài học và checklist vào `docs/LESSONS-LEARNED.md`.
- Viết các báo cáo nghiệm thu từ `task-3.1-report.md` đến `task-3.4-report.md`.
**Tiêu chí nghiệm thu:**
- Tài liệu đồng bộ 100% với mã nguồn và schema.

---

## Nguyên tắc thực hiện
- Tuyệt đối tuân thủ 9 bài học trong `docs/LESSONS-LEARNED.md`.
- Chạy cả 3 cổng kiểm soát (`lint`, `build`, `test`) trước khi hoàn tất mỗi task.
- Zero-fabrication trong báo cáo nghiệm thu.
