# Kế hoạch thực thi Phase 3 — Shorts, Audio Mixing & QA Gates
> **Mục tiêu:** Sinh các đoạn Short 9:16 tự động từ video gốc, xử lý âm thanh chuyên nghiệp (nhạc nền, SFX, ducking, chuẩn hoá âm lượng -14 LUFS) và thiết lập cổng kiểm tra chất lượng (QA Gates) trước/sau khi render.
> **Thời gian dự kiến:** 4-5 tasks.
## Danh sách Tasks
### Task 3.1: Short 9:16 Extraction (Core & CLI)
**Package:** `@faceless/core`, `@faceless/cli`
**Mô tả:**
- Xây dựng thuật toán `extractShort(spec, { startWordId, endWordId })`: 
  - Cắt `VideoSpec` dài thành một phiên bản ngắn, lọc và dịch chuyển các `beats`, `words`, `captions` về gốc thời gian 0.
- Phát triển lệnh `studio shorts <slug>`:
  - Sinh một task cho Agent phân tích kịch bản và chọn ra các khoảng thời gian "hook" hấp dẫn (`results/*-short-candidates.json`).
  - Dựa trên kết quả chọn, tự động sinh các file `spec-short-1.json`, `spec-short-2.json` lưu trong project.
- Cập nhật lệnh `studio render`: Hỗ trợ flag `--spec <file>` để người dùng trỏ thẳng vào file spec của Short thay vì `spec.json` mặc định.
**Tiêu chí nghiệm thu:**
- Lệnh sinh ra được ít nhất 1 cấu hình Short hợp lệ và render được thành một video độc lập dài dưới 60 giây ở định dạng 9:16.
### Task 3.2: Audio Mixing & Ducking (Renderer)
**Package:** `@faceless/renderer-remotion`
**Mô tả:**
- Xử lý mảng `music` và `sfx` từ `VideoSpec`.
- Implement component `<AudioMixer />` sử dụng Remotion `<Audio />`:
  - Phát nhạc nền (Music) lặp lại (loop).
  - Định vị các hiệu ứng âm thanh (SFX) chính xác theo thời điểm của các beat.
  - **Auto Ducking**: Tính toán đường cong âm lượng (volume curve) dựa trên mảng `words`. Khi lời đọc (narration) cất lên, nhạc nền tự động giảm âm lượng (ducking) xuống 20-30%, và khôi phục khi có khoảng nghỉ (silence > 0.5s).
**Tiêu chí nghiệm thu:**
- Nghe rõ sự thay đổi âm lượng nhạc nền trong video render.
### Task 3.3: Loudness Normalization chuẩn -14 LUFS (Media)
**Package:** `@faceless/media`, `@faceless/renderer-remotion`
**Mô tả:**
- Tích hợp lớp `LoudnessProcessor` sử dụng `ffmpeg` (thông qua bộ lọc `loudnorm` hoặc `ebur128`).
- Gắn vào bước hậu kỳ sau khi Remotion render xong MP4: 
  - Trích xuất audio -> Normalize chuẩn YouTube (-14 LUFS, True Peak -1dB) -> Trộn lại (mux) vào video MP4.
**Tiêu chí nghiệm thu:**
- File video đầu ra khi kiểm tra bằng phần mềm phân tích âm thanh phải đạt xấp xỉ -14 LUFS.
### Task 3.4: QA Gates (Pre & Post Render)
**Package:** `@faceless/core`, `@faceless/cli`
**Mô tả:**
- Thiết kế `QAManager`.
- Implement `studio qa <slug> --pre`:
  - **Schema Validation:** Đảm bảo `spec.json` 100% hợp lệ.
  - **Asset & License Check:** Verify toàn bộ hình ảnh, âm thanh có tồn tại trên đĩa cứng và có license hợp lệ trong sổ cái.
  - **Audio Confidence:** Cảnh báo nếu các từ trong giọng đọc có `confidence < 0.8`.
- Implement `studio qa <slug> --post`:
  - **Integrity Check:** Thời lượng video MP4 trùng khớp với thời lượng yêu cầu. Kích thước file hợp lý.
  - **Loudness Check:** Đọc metadata âm thanh xác nhận đạt chuẩn LUFS.
**Tiêu chí nghiệm thu:**
- CLI in ra danh sách Lỗi (Errors - chặn render) và Cảnh báo (Warnings - chỉ hiển thị) dưới dạng bảng console và JSON.
### Task 3.5: Hoàn thiện Tài liệu (Docs)
**Thư mục:** `docs/`
**Mô tả:**
- Xóa stub và viết đầy đủ tài liệu `docs/PIPELINE.md` (mô tả luồng từ spec dài -> spec ngắn).
- Xóa stub và viết tài liệu `docs/QA-GATES.md` (giải thích các quy tắc kiểm tra).
- Rà soát và cập nhật tiến độ vào `ROADMAP.md`.
**Tiêu chí nghiệm thu:**
- Người mới đọc tài liệu hiểu rõ các bước kiểm tra chất lượng trước khi phát hành video.
---
## Nguyên tắc thực hiện
- Vẫn tuân thủ chặt chẽ **Luật Vàng #10** (đúc kết bài học vào `LESSONS-LEARNED.md`).