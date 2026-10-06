# Báo cáo Nghiệm thu Task 4.1: API Server (REST + SSE)

> **Mục tiêu:** Xây dựng cầu nối backend API (`apps/server`) phục vụ giao diện Web UI, cung cấp đầy đủ các REST endpoints tương đương bộ lệnh CLI và SSE endpoint stream sự kiện thời gian thực từ `events.jsonl`.  
> **Nguyên tắc cốt lõi:** Tuân thủ triệt để **Kiến trúc mỏng (Thin Client)** — Server chỉ tiếp nhận HTTP request và ủy quyền 100% xử lý nghiệp vụ cho `@faceless/core`, `@faceless/media`, và `@faceless/renderer-remotion`.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

### 1.1 Khởi tạo Package `apps/server` & Cấu hình Workspace
- Cập nhật [`pnpm-workspace.yaml`](file:///e:/faceless-studio/pnpm-workspace.yaml) khai báo thêm `apps/*`.
- Khởi tạo package `@faceless/server` (`apps/server/package.json`) sử dụng framework [Hono](https://hono.dev/) (`hono`, `@hono/node-server`).
- Thiết lập `tsconfig.json` kế thừa chuẩn ESM Node16 của dự án, hỗ trợ đầy đủ `tsc --noEmit` (lint) và `tsc` (build).
- Cấu hình `vitest.config.ts` phục vụ kiểm thử đơn vị và tích hợp.

### 1.2 REST Endpoints Hoàn chỉnh
Được triển khai tập trung tại [`apps/server/src/app.ts`](file:///e:/faceless-studio/apps/server/src/app.ts):

| Phương thức | Endpoint | Mô tả & Tích hợp Domain Logic |
| :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra tình trạng server, trả về status `"ok"` và `uptime`. |
| `GET` | `/templates` | Quét danh sách templates trên đĩa hoặc nạp `BUILTIN_TEMPLATES` từ `core`. |
| `GET` | `/topics` | Quét danh sách chủ đề trong thư mục `topics/`. |
| `GET` | `/projects` | Quét thư mục dự án, trả về danh sách kèm cấu hình `project.json` và `state.json`. |
| `POST` | `/projects` | Tương đương `studio new`: Xác thực tham số qua `ProjectConfigSchema`, gọi `ProjectManager.createProject`. Trả về HTTP 201 hoặc 409 nếu slug đã tồn tại. |
| `GET` | `/projects/:slug` | Lấy chi tiết dự án (config, state, tồn tại spec.json). |
| `GET` | `/projects/:slug/status` | Lấy trực tiếp `state.json` qua `ProjectManager.getState`. |
| `POST` | `/projects/:slug/run` | Tương đương `studio run`: Hỗ trợ creative stages (`outline`, `script`, `direct`, `spec`) tạo tệp trong `tasks/` và cập nhật trạng thái `"running"`; hỗ trợ deterministic stages (`tts`, `align`). |
| `GET` | `/projects/:slug/tasks` | Liệt kê các nhiệm vụ đang chờ agent trong thư mục `tasks/` (`TaskInbox.listTasks`). |
| `POST` | `/projects/:slug/validate` | Tương đương `studio validate`: Gọi `TaskInbox.validateResult` đối chiếu schema Zod (`OutlineResultSchema`, `ScriptResultSchema`, v.v.), cập nhật trạng thái stage thành `"done"` nếu hợp lệ hoặc `"failed"` kèm chi tiết lỗi. |
| `POST` | `/projects/:slug/shorts` | Tương đương `studio shorts`: Tự động dò tìm ứng viên (`autoDetectShortCandidates`) và trích xuất sub-spec 9:16 (`extractShort`) dời gốc thời gian về 0. |
| `GET` | `/projects/:slug/spec` | Đọc nội dung tệp `spec.json` hoặc các sub-spec của short. |
| `POST` | `/projects/:slug/render` | Tương đương `studio render`: Gọi `RemotionRendererAdapter.render`, phát sinh sự kiện tiến trình qua `events.jsonl`. |
| `GET` | `/projects/:slug/qa` | Tương đương `studio qa`: Chạy QA Gates (`QAManager.runPreRenderQA` hoặc `QAManager.runPostRenderQA`). |

### 1.3 Real-time SSE (Server-Sent Events) Endpoint
- `GET /projects/:slug/events`: 
  - Khởi tạo kết nối SSE chuẩn `text/event-stream` thông qua tiện ích `streamSSE` của Hono.
  - Tự động nạp toàn bộ các dòng sự kiện lịch sử từ `events.jsonl`.
  - Thiết lập polling theo chu kỳ phát hiện các dòng log mới nối tiếp (tail stream), gửi `event: "log"` theo thời gian thực tới client.
  - Hỗ trợ tham số `?once=true` giúp các bài test tự động đóng stream an toàn ngay sau khi nhận snapshot.

---

## 2. Kết quả Xác thực & Kiểm thử (Quality Gates)

### 2.1 Kiểm thử Đơn vị & Tích hợp `@faceless/server`
File kiểm thử: [`apps/server/src/__tests__/server.test.ts`](file:///e:/faceless-studio/apps/server/src/__tests__/server.test.ts)

```text
 ✓ src/__tests__/server.test.ts (18 tests) 104ms
   ✓ API Server (@faceless/server) > Base / System Endpoints > GET /health returns 200 and ok status
   ✓ API Server (@faceless/server) > Base / System Endpoints > GET /templates returns list of available templates
   ✓ API Server (@faceless/server) > Base / System Endpoints > GET /topics returns list of available topics
   ✓ API Server (@faceless/server) > Project CRUD & State Endpoints > GET /projects returns empty array when no projects exist
   ✓ API Server (@faceless/server) > Project CRUD & State Endpoints > POST /projects rejects missing slug with 400
   ✓ API Server (@faceless/server) > Project CRUD & State Endpoints > POST /projects creates project and returns 201
   ✓ API Server (@faceless/server) > Project CRUD & State Endpoints > POST /projects returns 409 when project slug already exists
   ✓ API Server (@faceless/server) > Project CRUD & State Endpoints > GET /projects lists created projects
   ✓ API Server (@faceless/server) > Project CRUD & State Endpoints > GET /projects/:slug returns project details or 404
   ✓ API Server (@faceless/server) > Project CRUD & State Endpoints > GET /projects/:slug/status returns project state
   ✓ API Server (@faceless/server) > Pipeline & Task Execution Endpoints > POST /projects/:slug/run generates creative task and marks running
   ✓ API Server (@faceless/server) > Pipeline & Task Execution Endpoints > POST /projects/:slug/run executes deterministic stages (tts, align)
   ✓ API Server (@faceless/server) > Pipeline & Task Execution Endpoints > POST /projects/:slug/validate handles both failure and success
   ✓ API Server (@faceless/server) > Shorts, QA, Spec & SSE Endpoints > GET /projects/:slug/spec returns spec.json content
   ✓ API Server (@faceless/server) > Shorts, QA, Spec & SSE Endpoints > POST /projects/:slug/shorts auto-detects candidates and writes short spec
   ✓ API Server (@faceless/server) > Shorts, QA, Spec & SSE Endpoints > GET /projects/:slug/qa?gate=pre executes pre-render QA gate
   ✓ API Server (@faceless/server) > Shorts, QA, Spec & SSE Endpoints > POST /projects/:slug/render returns 400 when spec file is missing
   ✓ API Server (@faceless/server) > Shorts, QA, Spec & SSE Endpoints > GET /projects/:slug/events?once=true streams SSE log events

 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 2.2 Kiểm thử Toàn Monorepo (5 Workspace Projects)
Đã chạy kiểm tra cả 3 tiêu chuẩn chất lượng (Lint, Build, Test) trên toàn bộ dự án:
- **Lint (`pnpm -r run lint`):** ✅ **0 errors** trên toàn bộ 5 packages (`core`, `media`, `renderer-remotion`, `cli`, `server`).
- **Build (`pnpm -r run build`):** ✅ Toàn bộ 5 packages biên dịch ra `dist/` thành công.
- **Test (`pnpm -r run test`):** ✅ **130/130 tests passed (100% XANH)**:
  - `@faceless/core`: 45 tests (8 test files)
  - `@faceless/media`: 7 tests (2 test files)
  - `@faceless/renderer-remotion`: 24 tests (4 test files)
  - `@faceless/server`: 18 tests (1 test file)
  - `@faceless/cli`: 36 tests (7 test files)

---

## 3. Đúc kết Bài học Kinh nghiệm

Đã bổ sung **Bài học #13** vào [`docs/LESSONS-LEARNED.md`](file:///e:/faceless-studio/docs/LESSONS-LEARNED.md):
- **Đồng bộ Trạng thái Stage Status Enum trong Thin Client Server:**
  - Nhận diện enum hợp lệ trong `StageStatusSchema`: `["pending", "running", "done", "failed", "skipped"]`.
  - Luôn sử dụng đúng enum `"running"` (không dùng `"in_progress"`).
  - Tái sử dụng triệt để `ProjectConfigSchema.parse()` tại REST endpoint để tận dụng default values và bắt lỗi định dạng đầu vào sớm.
