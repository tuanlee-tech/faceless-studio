# Báo cáo Nghiệm thu Task 4.3: Web UI - Pipeline & Task Inbox

> **Mục tiêu:** Xây dựng giao diện chi tiết dự án (Project Detail View) với thanh tiến trình Pipeline (`outline` $\to$ `script` $\to$ `direct` $\to$ `spec`); Task Inbox View hỗ trợ xem thông tin task, soạn thảo kết quả kịch bản qua Form/JSON Editor và thực hiện thẩm định (Validate) đối chiếu Zod schema trực tiếp trên trình duyệt.  
> **Nguyên tắc cốt lõi:** Kiến trúc mỏng (Thin Client) — Tái sử dụng logic xác thực schema Zod và cập nhật trạng thái của `TaskInbox` trong `@faceless/core`.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

### 1.1 Giao diện Pipeline Tiến trình Sáng tạo
Triển khai tại [`apps/web/src/components/PipelineInboxView.tsx`](file:///e:/faceless-studio/apps/web/src/components/PipelineInboxView.tsx):
- Thanh tiến trình 4 giai đoạn sáng tạo chuẩn: `outline` $\to$ `script` $\to$ `direct` $\to$ `spec`.
- Thẻ trạng thái từng stage hiển thị trực quan:
  - `done`: Biểu tượng tick xanh (CheckCircle2).
  - `running`: Spinner hoạt ảnh vàng (Loader2).
  - `failed`: Biểu tượng cảnh báo đỏ (AlertCircle).
  - `pending`: Đánh số thứ tự stage.
- Nút bấm **"Khởi chạy Stage Kế tiếp"** gọi `POST /projects/:slug/run`.

### 1.2 Task Inbox & Form/JSON Editor
- Danh sách Task Inbox:
  - Hiển thị ID nhiệm vụ (`Task #001`, `#002`, v.v.), giai đoạn tương ứng và prompt chỉ đạo kịch bản.
- Trình biên soạn Form/JSON Editor:
  - Cho phép người dùng hoặc Agent nhập nội dung kết quả kịch bản (`results/<taskId>.json`).
  - Nút **"Nạp Mẫu Chuẩn"** tự động điền cấu trúc JSON mẫu hợp lệ theo từng stage (`OutlineResultSchema`, `ScriptResultSchema`, `DirectResultSchema`, `VideoSpecSchema`).
- Thẩm định (Validate) & Xử lý Lỗi Trực quan:
  - Nút **"Lưu & Thẩm định (Validate)"**:
    1. Lưu kết quả vào `results/<taskId>.json` qua endpoint `POST /projects/:slug/tasks/:taskId/result`.
    2. Gọi `POST /projects/:slug/validate`.
    3. Nếu kết quả hợp lệ: Tự động cập nhật stage thành `"done"`, chuyển tiếp sang stage kế tiếp.
    4. Nếu kết quả không hợp lệ: Hiển thị popup và hộp cảnh báo đỏ chi tiết lỗi Zod (trích xuất từ `results/<taskId>-errors.md`).

---

## 2. Nghiệm thu Tiêu chí Cốt lõi của Task 4.3

> **Tiêu chí nghiệm thu:** *User có thể hoàn thành luồng tạo kịch bản hoàn toàn trên trình duyệt bằng cách click Next / Validate.*

- **Xác thực tự động (Integration Test):**
  Trong [`apps/web/src/__tests__/web.test.ts`](file:///e:/faceless-studio/apps/web/src/__tests__/web.test.ts):
  - Test case `Task 4.3: saveTaskResult and validateTasks completes the pipeline stage`: Tạo dự án, chạy stage `outline`, gửi kết quả qua `saveTaskResult`, gọi `validateTasks`, xác nhận kết quả trả về `PASSED` và stage trong `state.json` chuyển thành `done`.
  - Test case `Task 4.3: getTaskErrors reads errors.md when validation fails`: Gửi dữ liệu thiếu trường bắt buộc, xác nhận `validateTasks` trả về `FAILED` và `getTaskErrors` đọc đúng nội dung tệp `results/001-errors.md`.

---

## 3. Kết quả Kiểm thử
- **Unit & Integration Test:** 14/14 tests passed trong `@faceless/web`.
- **Lint (`tsc --noEmit`):** 0 errors.
- **Build (`vite build`):** Clean build.
