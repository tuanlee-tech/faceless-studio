# Báo cáo Nghiệm thu Task 3.4: QA Gates (Pre & Post Render) (`studio qa`)

> **Mục tiêu:** Thiết kế lớp `QAManager` tại `@faceless/core` và lệnh CLI `studio qa <slug>` tại `@faceless/cli` thiết lập hai cổng kiểm soát chất lượng nghiêm ngặt trước khi render (`--pre`) và sau khi render (`--post`), xuất báo cáo dưới dạng bảng console và đối tượng JSON chuẩn.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

1. **Lớp `QAManager` (`@faceless/core/src/qa-manager.ts`):**
   - **Pre-Render QA Gate (`runPreRenderQA`):**
     - **Schema Validation:** Kiểm tra sự tồn tại của file spec (`spec.json` hoặc spec Short tùy chỉnh) và xác thực 100% qua Zod schema (`VideoSpecSchema`). Chặn render và báo lỗi chi tiết nếu schema không hợp lệ.
     - **Asset & License Check:** 
       - Quét toàn bộ hình ảnh, video asset được khai báo trong các beat của chapter.
       - Kiểm tra sự tồn tại của file vật lý trên đĩa cứng (`asset.filePath`).
       - Xác minh trường `license` không rỗng và asset đã được đăng ký hợp lệ trong sổ cái `assets/manifest.json`.
       - Kiểm tra file âm thanh narration (`audioPath`), nhạc nền (`spec.music[].libraryId`) và SFX (`beats[].sfx[].sfxId`) trên đĩa hoặc trong sổ cái `library/library.json`.
     - **Audio Confidence Check:**
       - Quét mảng từ `spec.narration.words`, phát cảnh báo (`warning`) cho bất kỳ từ nào có độ tin cậy căn chỉnh `confidence < 0.8` để biên tập viên kịp thời soát lại.
   - **Post-Render QA Gate (`runPostRenderQA`):**
     - **File Integrity Check:** Kiểm tra sự tồn tại của file video MP4 kết quả (`dist/long-16x9.mp4`, `dist/shorts/short-*.mp4`, v.v.), kiểm tra kích thước file phải hợp lệ ($> 1000$ bytes).
     - **Duration Check:** Đo thời lượng thực tế của video MP4 thông qua `QAMediaInspector`, đối chiếu với thời lượng mong muốn của narration trong spec (ngưỡng lệch cho phép $\pm 2.0$ giây).
     - **Loudness Check:** Đo đạc integrated loudness (`input_i`) và true peak (`input_tp`), đối chiếu với chuẩn phát hành YouTube (-14 LUFS, True Peak -1.0 dBTP). Cảnh báo nếu lệch quá 2.0 LUFS và báo lỗi nếu lệch nghiêm trọng $> 4.0$ LUFS.
   - **Thiết kế Dependency Injection (Kiến trúc sạch):**
     - `QAManager` trong `core` không import trực tiếp `ffmpeg` hay `@faceless/media` (tránh cyclic dependency), mà nhận interface `QAMediaInspector` được inject từ CLI hoặc mock inspector trong unit test.

2. **Lệnh CLI `studio qa` (`@faceless/cli/src/commands/qa.ts` & `main.ts`):**
   - Hỗ trợ cú pháp: `studio qa <slug> [--pre|--post] [--spec <file>] [--video <file>] [--json]`
   - Tự động chọn `--pre` làm mặc định nếu không truyền cờ.
   - Ghi nhận sự kiện `qa_checked` vào `events.jsonl` của project.
   - Định dạng hiển thị trực quan:
     - Console table: In banner trạng thái `[PASSED]` / `[FAILED]`, bảng tóm tắt số lượng lỗi/cảnh báo, và danh sách chi tiết các mục vi phạm gắn icon `❌ [ERROR]` / `⚠️  [WARN]`.
     - Chế độ `--json`: Xuất một đối tượng JSON duy nhất chuẩn `QAReport` ra stdout phục vụ tích hợp tự động hóa / UI.
   - Mã thoát an toàn: Thoát với exit code `0` nếu pass (0 errors), và `1` nếu phát hiện lỗi chặn (errors $> 0$).

---

## 2. Kết quả kiểm thử & Nghiệm thu thực tế

- **Type-Check & Build (2 Cánh cổng chất lượng đầu tiên):**
  - `pnpm -r run lint` (`tsc --noEmit`): ✅ **0 errors** trên toàn bộ 4 packages.
  - `pnpm -r run build` (`tsc`): ✅ Biên dịch thành công toàn bộ `dist/`.

- **Unit & Integration Tests (Vitest):**
  - **`packages/core/src/qa-manager.test.ts` (8/8 passed):**
    - Báo lỗi khi thiếu file spec.
    - Báo lỗi khi spec sai schema.
    - Bắt lỗi asset thiếu trên đĩa, thiếu license, và sinh cảnh báo confidence thấp.
    - Vượt qua kiểm tra (Passed 100%) khi spec, file asset, manifest và license hợp lệ.
    - Báo lỗi khi thiếu file video hoặc video dung lượng $< 1000$ bytes.
    - Cảnh báo lệch duration hoặc loudness.
    - Vượt qua kiểm tra Post-Render khi video nguyên vẹn và âm lượng đạt chuẩn -14 LUFS.
  - **`packages/cli/src/__tests__/qa.test.ts` (5/5 passed):**
    - Báo lỗi thiếu slug khi gọi `studio qa`.
    - Báo lỗi project không tồn tại.
    - Chạy `studio qa --pre` thực tế đạt PASS với output bảng và JSON hợp lệ.
    - Chạy `studio qa --pre` bắt lỗi khi asset không tồn tại (exit code 1).
    - Chạy `studio qa --post` kiểm tra file MP4 thực tế và đo loudness thành công.

- **Tổng kết kiểm thử Monorepo:** ✅ **112/112 tests passed (100% xanh)** trên cả 21 test files:
  - `@faceless/core`: 45 tests (8 files)
  - `@faceless/media`: 7 tests (2 files)
  - `@faceless/renderer-remotion`: 24 tests (4 files)
  - `@faceless/cli`: 36 tests (7 files)
