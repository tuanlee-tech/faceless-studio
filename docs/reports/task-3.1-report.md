# Báo cáo Nghiệm thu Task 3.1: Short 9:16 Extraction (Core & CLI)

> **Mục tiêu:** Xây dựng thuật toán `extractShort` cắt `VideoSpec` dài thành sub-spec ngắn và dịch chuyển các mốc thời gian về gốc 0; triển khai lệnh CLI `studio shorts <slug>` tự động sinh các file `spec-short-*.json`; nâng cấp lệnh `studio render` hỗ trợ cờ `--spec <file>` render video 9:16 độc lập dưới 60 giây.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

1. **Thuật toán `extractShort` (`@faceless/core`):**
   - Tạo file `packages/core/src/shorts-extractor.ts`:
     - Nhận vào `spec` dài và khoảng từ `{ startWordId, endWordId }`.
     - Trích xuất mảng từ tương ứng và tính toán `timeOffset = words[0].startSec`.
     - Dịch chuyển toàn bộ mốc thời gian của `words`, `beats`, `captions` và `music` về gốc 0 (`startSec - timeOffset`, `endSec - timeOffset`).
     - Tự động cắt gọt (clamp) phạm vi của beat: Giữ lại các beat có giao thoa với khoảng Short, loại bỏ beat và chương nằm ngoài phạm vi.
     - Lọc danh sách `captions` và `sfx` chỉ giữ lại các thành phần neo vào các từ trong Short.
     - Thiết lập metadata: `isShort: true`, `shortIndex`, tiêu đề video ngắn.
     - Kiểm định đầu ra bằng `VideoSpecSchema.parse` đảm bảo tuân thủ nghiêm ngặt hợp đồng spec (Luật vàng #1).
   - Hàm `autoDetectShortCandidates`: Tự động nhận diện các phân đoạn cao trào / mở đầu có thời lượng phù hợp (15–50 giây) khi kịch bản chưa có kết quả chọn hook thủ công.

2. **Schema Hỗ trợ Task Inbox:**
   - Cập nhật `packages/core/src/schemas/task-results.ts` với `ShortCandidateSchema` và `ShortCandidatesResultSchema` cho phép agent gửi kết quả hook (`results/*-short-candidates.json`).

3. **Lệnh CLI `studio shorts <slug>` (`@faceless/cli`):**
   - Triển khai trong `packages/cli/src/commands/shorts.ts`:
     - Kiểm tra sự tồn tại của project và `spec.json`.
     - Nếu có file kết quả trong `results/`, nạp danh sách ứng viên hook được chọn.
     - Nếu chưa có, tạo task file `projects/<slug>/tasks/<slug>-shorts.md` cho Agent/Director và chạy bộ phát hiện tự động `autoDetectShortCandidates`.
     - Sinh các file `spec-short-1.json`, `spec-short-2.json`... trực tiếp trong thư mục project.
     - Cập nhật stage `short-9x16` thành `done` trong `state.json`.
     - Ghi nhận sự kiện `shorts_generated` vào `events.jsonl`.
     - Hỗ trợ xuất JSON qua `--json`.

4. **Nâng cấp lệnh `studio render`:**
   - Cập nhật `packages/cli/src/commands/render.ts`:
     - Bổ sung cờ `--spec <file>` cho phép người dùng chỉ định file spec bất kỳ thay vì mặc định `spec.json`.
     - Khi phát hiện spec là Short (`isShort` hoặc tên file chứa `short`), tự động mặc định định dạng `short-9x16` (1080x1920) và xuất file ra `projects/<slug>/dist/shorts/short-*.mp4`.

---

## 2. Kết quả kiểm thử & Nghiệm thu thực tế

- **Type-Check & Build:**
  - `pnpm -r run lint` (`tsc --noEmit`): ✅ 0 errors across 4 packages.
  - `pnpm -r run build` (`tsc`): ✅ Biên dịch thành công toàn bộ `dist/`.

- **Unit & Integration Tests (Vitest):**
  - **`packages/core/src/shorts-extractor.test.ts` (4/4 passed):**
    - `extracts short spec and shifts timestamps to start at 0`: Pass
    - `clamps beats and omits unincluded chapters/beats`: Pass
    - `throws error for non-existent word IDs`: Pass
    - `auto-detects sensible candidates from spec`: Pass
  - **`packages/cli/src/__tests__/shorts.test.ts` (4/4 passed):**
    - `fails when slug is missing`: Pass
    - `fails when project does not exist`: Pass
    - `generates task and extracts spec-short-*.json automatically`: Pass
    - `renders 9:16 short video using studio render --spec spec-short-1.json`: Pass (đã render thực tế video MP4 9:16 1080x1920 hợp lệ > 0 bytes)
  - **Tổng số test toàn Monorepo:** ✅ **77/77 tests passed (100% xanh)**:
    - `@faceless/core`: 37 tests
    - `@faceless/media`: 3 tests
    - `@faceless/renderer-remotion`: 6 tests
    - `@faceless/cli`: 31 tests
