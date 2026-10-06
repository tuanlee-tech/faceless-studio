# Kế hoạch thực thi Phase 4 — Giao diện UI (Server & Web)

> **Mục tiêu:** Xây dựng lớp giao diện web thân thiện, tương tác trực quan với toàn bộ hệ thống Faceless Studio thông qua kiến trúc Client-Server. UI chỉ đóng vai trò hiển thị và gọi lệnh (thin client), mọi logic lõi giữ nguyên tại `@faceless/core` và CLI.
> **Thời gian dự kiến:** 4-5 tasks.

## Danh sách Tasks

### Task 4.1: API Server (REST + SSE)
**Package:** `apps/server`
**Mô tả:**
- Khởi tạo ứng dụng Node.js (khuyến nghị dùng Hono, Fastify hoặc Express) với TypeScript.
- **REST Endpoints:**
  - `GET /projects`: Lấy danh sách dự án.
  - `POST /projects`: Tương đương lệnh `studio new`.
  - `GET /projects/:slug/status`: Lấy `state.json`.
  - `POST /projects/:slug/run`: Khởi chạy một stage.
  - `POST /projects/:slug/render`: Khởi chạy render video.
- **SSE (Server-Sent Events) Endpoint:**
  - `GET /projects/:slug/events`: Stream liên tục các dòng log mới từ `events.jsonl` ra frontend theo thời gian thực (dùng cho thanh tiến trình render, trạng thái agent...).
**Tiêu chí nghiệm thu:**
- Server chạy độc lập, Postman/cURL có thể gọi REST và nghe SSE thành công. Không viết lại logic nghiệp vụ mà gọi trực tiếp các class trong `@faceless/core` hoặc dùng `child_process.spawn("studio ... --json")`.

### Task 4.2: Web UI - Foundation & Quản lý Dự án
**Package:** `apps/web`
**Mô tả:**
- Khởi tạo Web App (Vite + React + Tailwind CSS). Thiết lập kết nối API với Server.
- **Dashboard:** Danh sách các dự án hiện có (đọc thư mục `projects/`).
- **Create Project Modal:** Form trực quan thay thế cho `studio new` (Dropdown chọn Template, Topic, Input thời lượng, Checkbox chọn Format).
**Tiêu chí nghiệm thu:**
- Tạo mới project từ UI thành công, thư mục project vật lý được sinh ra trên đĩa.

### Task 4.3: Web UI - Pipeline & Task Inbox
**Package:** `apps/web`
**Mô tả:**
- Giao diện chi tiết dự án (Project Detail View) với thanh tiến trình Pipeline (`outline` -> `script` -> `direct` -> `spec`).
- **Task Inbox View:**
  - Lắng nghe trạng thái `running`, hiển thị thông tin Markdown của Task hiện tại.
  - Form Editor cho phép người dùng tự điền JSON/nội dung hoặc tích hợp gọi Agent.
  - Nút **Validate** gọi `studio validate`, hiển thị popup lỗi/chi tiết Zod error (đọc từ `results/*-errors.md`) nếu điền sai.
**Tiêu chí nghiệm thu:**
- User có thể hoàn thành luồng tạo kịch bản hoàn toàn trên trình duyệt bằng cách click Next / Validate.

### Task 4.4: Web UI - Storyboard & Asset Manager
**Package:** `apps/web`
**Mô tả:**
- **Storyboard View:** Render giao diện lưới (grid) hiển thị các `beats` đọc từ `spec.json`.
- **Asset Manager:** 
  - Nút bấm xuất "Prompt Pack" (Download tệp Markdown).
  - Vùng Kéo-thả (Drag & Drop zone) để upload ảnh minh họa vào `incoming/`. Server tự động gọi lệnh `studio assets import` và hiển thị ảnh lên thẻ beat tương ứng.
- Nhúng `Remotion Player` cơ bản để xem trước đoạn video thô ngay trên trình duyệt mà không cần xuất MP4.
**Tiêu chí nghiệm thu:**
- Kéo thả 1 bức ảnh vào UI, ảnh tự động gán vào cảnh tương ứng và cập nhật lên Remotion Player.

### Task 4.5: Web UI - QA Gates & Render Queue
**Package:** `apps/web`
**Mô tả:**
- **QA View:** Nút chạy Pre-Render QA. Hiển thị bảng danh sách tick xanh (Passed) hoặc cảnh báo đỏ (Error/Missing Asset). Chặn nút Render nếu có lỗi.
- **Render View:** 
  - Chọn format cần xuất (16:9 dài hoặc 9:16 Short). Bấm xuất video.
  - Render Progress Bar: Lắng nghe SSE từ Server để update thanh % mượt mà.
  - Video Player để xem lại thành phẩm MP4 + báo cáo Post-Render QA (thời lượng, chuẩn âm lượng LUFS).
**Tiêu chí nghiệm thu:**
- Bấm render trên web, thanh tiến trình chạy, sau khi xong thì video hiện lên trình duyệt và play được.

---

## Nguyên tắc thực hiện
- Vẫn tuân thủ TDD: Backend (server) phải có test route. Web UI (tùy chọn viết component test cơ bản với React Testing Library).
- Tuân thủ **Kiến trúc mỏng (Thin Client)**: Mọi xử lý phức tạp về file, video, FFmpeg ĐÃ ĐƯỢC LÀM TRONG PHASE 1, 2, 3. Cấm tuyệt đối việc code lặp lại logic FFmpeg hay Zod schema parser trên UI (Re-use từ package `core`).
- Liên tục cập nhật kinh nghiệm UI vào `LESSONS-LEARNED.md`.
