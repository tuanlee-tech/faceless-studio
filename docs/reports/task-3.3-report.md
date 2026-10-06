# Báo cáo Nghiệm thu Task 3.3: Loudness Normalization chuẩn -14 LUFS (Media)

> **Mục tiêu:** Tích hợp lớp `LoudnessProcessor` sử dụng ffmpeg bộ lọc `loudnorm` hai bước (two-pass) để chuẩn hóa âm lượng theo tiêu chuẩn phát hành YouTube (-14 LUFS, True Peak -1.0 dBTP, LRA 7.0 LU); gắn tự động vào bước hậu kỳ sau khi Remotion render xong MP4 (trích xuất audio -> normalize -> mux stream-copy video).  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

1. **Lớp `LoudnessProcessor` (`@faceless/media/src/loudness-processor.ts`):**
   - **`measure(inputPath, options)`:**
     - Gọi `ffmpeg -af loudnorm=...:print_format=json` đo đạc chính xác integrated loudness (`input_i`), true peak (`input_tp`), loudness range (`input_lra`), threshold và offset.
     - Phân tích trực tiếp khối JSON từ output stderr của ffmpeg, khắc phục triệt để sự cố regex dựa trên text log ở phiên bản cũ.
   - **`extractAudio(videoPath, outputAudioPath)`:**
     - Trích xuất luồng âm thanh nguyên bản từ container video thành file PCM WAV 16-bit (`pcm_s16le`) với cờ `-vn`.
   - **`normalizeAudio(inputAudioPath, outputAudioPath, options)`:**
     - Thực hiện quy trình chuẩn hóa âm thanh hai bước (Two-pass Loudness Normalization):
       - Pass 1: Đo đạc các thông số âm lượng thực tế của file nguồn.
       - Pass 2: Áp dụng các giá trị đo được (`measured_I`, `measured_TP`, `measured_LRA`, `measured_thresh`, `offset`) vào bộ lọc `loudnorm` với `linear=true`.
   - **`muxAudio(videoPath, audioPath, outputVideoPath)`:**
     - Ghép luồng âm thanh đã chuẩn hóa vào video MP4 bằng cơ chế copy luồng hình ảnh (`-c:v copy`) không re-encode hình, mã hóa audio AAC chuẩn 192 kbps (`-c:a aac -b:a 192k`) và đảm bảo đồng bộ thời lượng với `-shortest`.
   - **`processVideo(videoPath, outputPath, options)`:**
     - Hàm hậu kỳ tự động trọn gói: Probe kiểm tra luồng audio trong file video -> Trích xuất audio -> Bỏ qua nếu audio tiệm cận im lặng ($\le -70$ LUFS) -> Normalize về -14 LUFS -> Mux lại vào video MP4 và dọn dẹp an toàn các file tạm.

2. **Nâng cấp Hàm `measureLoudness` trong `ffmpeg.ts`:**
   - Cập nhật hàm `measureLoudness` trong `@faceless/media/src/ffmpeg.ts` sang sử dụng bộ lọc `loudnorm=print_format=json` để đồng bộ và thống nhất độ chính xác.

3. **Gắn vào bước hậu kỳ của `RemotionRendererAdapter` (`adapter.ts`):**
   - Thêm `@faceless/media` vào dependencies của `@faceless/renderer-remotion`.
   - Ngay sau khi `renderMedia` hoàn thành việc xuất file MP4, adapter tự động khởi tạo `LoudnessProcessor` và gọi `processVideo(options.outPath, options.outPath)`.
   - Toàn bộ video xuất ra từ lệnh `studio render` hoặc `studio render --spec` đều tự động đạt chuẩn âm lượng -14 LUFS mà không cần thao tác thủ công.

---

## 2. Kết quả kiểm thử & Nghiệm thu thực tế

- **Type-Check & Build (2 Cánh cổng chất lượng đầu tiên):**
  - `pnpm -r run lint` (`tsc --noEmit`): ✅ **0 errors** trên toàn bộ 4 packages.
  - `pnpm -r run build` (`tsc`): ✅ Biên dịch thành công toàn bộ `dist/`.

- **Unit & Integration Tests (Vitest):**
  - **`packages/media/src/__tests__/loudness.test.ts` (4/4 passed):**
    - `measures audio loudness accurately`: Đo đạc chính xác LUFS của âm thanh tổng hợp.
    - `normalizes audio to approximately -14 LUFS`: Chuẩn hóa âm thanh từ ~ -21 LUFS lên xấp xỉ -14.0 LUFS (kết quả thực nghiệm đạt $-14.0 \pm 0.5$ LUFS).
    - `processes video end-to-end`: Trích xuất, chuẩn hóa và mux lại vào video MP4, kiểm tra video output đạt chính xác $-14.0$ LUFS và giữ nguyên stream video gốc.
    - `handles video without audio stream gracefully`: Xử lý an toàn khi video không có track âm thanh, không gây crash tiến trình.
  - **`packages/media/src/__tests__/media.test.ts` (3/3 passed):**
    - Mock TTS, aligner và asset provider vẫn pass 100%.
  - **`packages/renderer-remotion/src/__tests__/` (24/24 passed):**
    - Tích hợp adapter và mixer với quy trình hậu kỳ loudness chạy ổn định.

- **Tổng kết kiểm thử Monorepo:** ✅ **99/99 tests passed (100% xanh)** trên cả 19 test files:
  - `@faceless/core`: 37 tests (7 files)
  - `@faceless/media`: 7 tests (2 files)
  - `@faceless/renderer-remotion`: 24 tests (4 files)
  - `@faceless/cli`: 31 tests (6 files)
