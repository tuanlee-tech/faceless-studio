# Báo cáo Nghiệm thu Task 4.2: Web UI - Foundation & Quản lý Dự án

> **Mục tiêu:** Khởi tạo Web Application (`apps/web`) với Vite, React, TypeScript và Tailwind CSS; thiết lập API Client kết nối Server; xây dựng giao diện Dashboard quản lý danh sách dự án và modal khởi tạo dự án mới (`CreateProjectModal`).  
> **Nguyên tắc cốt lõi:** Tuân thủ triệt để **Kiến trúc mỏng (Thin Client)** — UI chỉ đảm nhiệm hiển thị, nhận tương tác người dùng và gọi các REST/SSE endpoints từ `@faceless/server`.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

### 1.1 Khởi tạo Package `apps/web` & Cấu hình Giao diện
- Tạo package `@faceless/web` ([`apps/web/package.json`](file:///e:/faceless-studio/apps/web/package.json)) sử dụng Vite 6, React 18, Tailwind CSS, Lucide icons và Vitest.
- Cấu hình TypeScript ESM Bundler mode ([`apps/web/tsconfig.json`](file:///e:/faceless-studio/apps/web/tsconfig.json)) và khai báo type Vite client ([`apps/web/src/vite-env.d.ts`](file:///e:/faceless-studio/apps/web/src/vite-env.d.ts)).
- Cấu hình Tailwind CSS & PostCSS ([`apps/web/tailwind.config.js`](file:///e:/faceless-studio/apps/web/tailwind.config.js)) với bảng màu slate dark mode và điểm nhấn tím violet/brand.
- Cấu hình build & test Vite ([`apps/web/vite.config.ts`](file:///e:/faceless-studio/apps/web/vite.config.ts)).

### 1.2 Kiến trúc Tầng Dữ liệu & API Client
Triển khai tập trung tại [`apps/web/src/api/client.ts`](file:///e:/faceless-studio/apps/web/src/api/client.ts) và [`apps/web/src/types/index.ts`](file:///e:/faceless-studio/apps/web/src/types/index.ts):
- Đọc `VITE_API_BASE_URL` (mặc định `http://localhost:3001`).
- Các hàm gọi API tương thích 100% với `@faceless/server`:
  - `checkHealth()`: Ping kiểm tra tình trạng server.
  - `getTemplates()` & `getTopics()`: Nạp động danh mục giao diện và chủ đề.
  - `getProjects()` & `getProject(slug)`: Lấy danh sách và chi tiết dự án.
  - `getStatus(slug)`: Lấy trạng thái `state.json`.
  - `createProject(payload)`: Gọi `POST /projects` khởi tạo dự án vật lý trên đĩa.
  - `runStage(slug, stage)`: Kích hoạt pipeline stage.
  - `validateTasks(slug)` & `extractShorts(slug)` & `render(slug)`: Sẵn sàng cho các task tiếp theo.
  - `getEventsUrl(slug)`: Cung cấp URL cho kết nối SSE realtime.

### 1.3 Thành phần Giao diện (Components)
1. **[`Header.tsx`](file:///e:/faceless-studio/apps/web/src/components/Header.tsx):**
   - Thanh điều hướng trên cùng, logo Faceless Studio, nhãn "Phase 4 UI".
   - Đèn báo trạng thái kết nối máy chủ API (Online / Offline pulse).
   - Nút làm mới danh sách (Refresh) và nút "+ Tạo dự án".
2. **[`Dashboard.tsx`](file:///e:/faceless-studio/apps/web/src/components/Dashboard.tsx):**
   - 3 thẻ chỉ số thống kê (Metrics): Tổng số dự án, Đang thực thi (`running`), Đã hoàn thành (`done`).
   - Ô tìm kiếm dự án theo tên slug thời gian thực.
   - Dropdown lọc danh sách theo Chủ đề (Topic).
   - Lưới hiển thị các thẻ dự án (`ProjectCard`) hoặc trạng thái rỗng (Empty State) kèm nút kêu gọi hành động.
3. **[`ProjectCard.tsx`](file:///e:/faceless-studio/apps/web/src/components/ProjectCard.tsx):**
   - Hiển thị slug dự án, badge chủ đề và template.
   - Thời lượng mục tiêu và các định dạng xuất bản (`16:9`, `9:16`).
   - Thanh tiến trình Pipeline kèm tỷ lệ % hoàn thành (`completedStages / totalStages`).
   - Huy hiệu trực quan theo từng stage (`done`, `running`, `failed`, `pending`).
4. **[`CreateProjectModal.tsx`](file:///e:/faceless-studio/apps/web/src/components/CreateProjectModal.tsx):**
   - Form thay thế hoàn chỉnh cho lệnh `studio new`:
     - Tên định danh (Slug) với bộ chuẩn hóa tự động kebab-case và kiểm tra regex.
     - Dropdown chọn Chủ đề (Topic) nạp động từ máy chủ.
     - Dropdown chọn Giao diện (Template) nạp động từ máy chủ.
     - Thời lượng mục tiêu (Phút).
     - Checkbox chọn định dạng (16:9 Dài và 9:16 Short).
     - Khung tùy chọn nâng cao (Collapsible): Giọng đọc (`voice`), Tốc độ đọc (`speed`), Ngân sách Asset (`assetBudget`), Ngưỡng QA (`qaThreshold`).
     - Hiển thị spinner khi submit và thông báo lỗi popup nếu slug bị trùng (HTTP 409).
5. **[`App.tsx`](file:///e:/faceless-studio/apps/web/src/App.tsx):**
   - Điều phối state tổng thể, tự động ping health định kỳ 30s, quản lý thông báo Toast.

---

## 2. Kết quả Xác thực Tiêu chí Nghiệm thu

### Tiêu chí cốt lõi:
> *"Tạo mới project từ UI thành công, thư mục project vật lý được sinh ra trên đĩa."*

- **Xác thực tự động (Integration Test):**
  Trong bài kiểm thử [`apps/web/src/__tests__/web.test.ts`](file:///e:/faceless-studio/apps/web/src/__tests__/web.test.ts), hàm `api.createProject` gửi payload tới server; server gọi `ProjectManager.createProject`. Bài test xác thực trực tiếp trên ổ cứng:
  - Thư mục dự án `projects/<slug>` được sinh ra.
  - Tệp `project.json` chứa đầy đủ cấu hình hợp lệ.
  - Tệp `state.json` khởi tạo các stage ban đầu (`pending`).
  - Tệp `events.jsonl` ghi nhận sự kiện `project_created`.
  - Các thư mục con `tasks/`, `results/` được tạo sẵn sàng.

---

## 3. Kết quả 3-Gate Quality Check

### 3.1 Kiểm thử Đơn vị & Tích hợp `@faceless/web`
```text
 ✓ src/__tests__/web.test.ts (10 tests) 62ms
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > checkHealth returns server uptime and ok status
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > getTemplates returns available templates list
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > getTopics returns available topics list
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > getProjects returns empty array when no projects exist
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > createProject creates a new project and physically produces files on disk
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > createProject throws error if slug is already taken
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > getProjects and getProject return newly created project details
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > getStatus returns pipeline stages state
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > runStage creates task file in tasks/ directory
   ✓ Web UI Foundation & API Client (@faceless/web) > API Client <-> Server Integration > getEventsUrl generates proper SSE endpoint URL

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

### 3.2 Kiểm thử Toàn Monorepo (6 Workspace Projects)
- **Lint (`pnpm -r run lint`):** ✅ **0 errors** trên toàn bộ 6 packages (`core`, `media`, `renderer-remotion`, `cli`, `server`, `web`).
- **Build (`pnpm -r run build`):** ✅ Toàn bộ 6 packages biên dịch sạch (bao gồm `tsc && vite build` tạo bundle production).
- **Test (`pnpm -r run test`):** ✅ **140/140 tests passed (100% XANH)**:
  - `@faceless/core`: 45 tests (8 test files)
  - `@faceless/media`: 7 tests (2 test files)
  - `@faceless/renderer-remotion`: 24 tests (4 test files)
  - `@faceless/server`: 18 tests (1 test file)
  - `@faceless/cli`: 36 tests (7 test files)
  - `@faceless/web`: 10 tests (1 test file)

---

## 4. Đúc kết Bài học Kinh nghiệm

Đã bổ sung **Bài học #14** vào [`docs/LESSONS-LEARNED.md`](file:///e:/faceless-studio/docs/LESSONS-LEARNED.md):
- **Phân tách Môi trường Kiểm thử (Node vs Jsdom) khi Tích hợp Web & Bundler:**
  - Nhận diện lỗi `Invariant violation` của `esbuild` do prototype `Uint8Array` bị sandbox bởi jsdom.
  - Cấu hình `environment: "node"` cho các bài test tích hợp API client gọi in-memory server.
  - Luôn khai báo `"types": ["vite/client"]` trong `tsconfig.json` cho ứng dụng Vite.
