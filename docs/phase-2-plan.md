# Kế hoạch thực thi Phase 2 — Template & Asset hệ thống

> **Mục tiêu:** Xây dựng hệ thống Template linh hoạt (2 template MVP), quản lý phụ đề tiếng Việt với font nhúng, hệ thống Asset Router (Export/Import prompt pack) và cấu trúc Library theo dõi license.
> **Thời gian dự kiến:** 4-5 tasks.

## Danh sách Tasks

### Task 2.1: Cơ chế Template & Subtitles (Renderer)
**Package:** `@faceless/renderer-remotion`, `@faceless/core`
**Mô tả:** 
- Định nghĩa schema `TemplateConfig` cho các tệp `templates/<id>/template.json` (chứa font, color scheme, layout config).
- Xây dựng component `Subtitle.tsx` trong `@faceless/renderer-remotion` có khả năng đọc `spec.narration.words` và highlight chữ tương ứng với `frame` hiện tại (neo theo từ).
- Cơ chế nạp Font cục bộ (bundled fonts) thay vì phụ thuộc hệ thống (tránh lỗi font chữ tiếng Việt trên Ubuntu/Windows).
- Sửa `Root.tsx` để lấy `templateId` từ spec và cung cấp Theme Context cho các component bên trong.
**Tiêu chí nghiệm thu:**
- Hiển thị đúng phụ đề tiếng Việt với word-level timing trên một video.

### Task 2.2: Implement 2 Template MVP
**Package:** `@faceless/renderer-remotion`, `templates/`
**Mô tả:**
- **`baroque-mono`**: Template phong cách cổ điển, kể chuyện lịch sử/tâm lý. Dùng font Serif, nền tối, hiệu ứng chuyển cảnh mềm mại.
- **`clean-split`**: Template phong cách hiện đại, tin tức/tutorial. Dùng font Sans-serif, chia đôi màn hình (layout split cho text và ảnh minh họa).
- Cập nhật `MainVideo.tsx` để hiển thị layout tương ứng tuỳ thuộc vào biến theme/template.
**Tiêu chí nghiệm thu:**
- Đổi `templateId` trong `project.json` sang `baroque-mono` hoặc `clean-split`, chạy `studio render` sinh ra 2 video có ngoại hình khác biệt rõ ràng.

### Task 2.3: Asset Router & Lệnh `studio assets` (CLI & Core)
**Package:** `@faceless/cli`, `@faceless/core`
**Mô tả:**
- Định nghĩa cấu trúc thư mục `projects/<slug>/assets/` bao gồm `manifest.json`, `requests/`, `incoming/`, `processed/`.
- Lệnh `studio assets <slug> export`: Quét `spec.json` tìm các `visuals` cần sinh ảnh (missing assets). Xuất ra tệp `requests/prompt-pack.md` chứa danh sách prompt chi tiết để người dùng copy cho Midjourney/DALL-E.
- Lệnh `studio assets <slug> import`: Đọc thư mục `incoming/`, validate các file ảnh (định dạng, dung lượng), dời sang `processed/` và cập nhật `manifest.json`.
**Tiêu chí nghiệm thu:**
- Chạy lệnh `export` sinh đúng file markdown chứa prompts.
- Bỏ 1 file ảnh vào `incoming/`, chạy `import` thấy file vào đúng thư mục `processed/` và `manifest.json` được cập nhật.

### Task 2.4: Library & Quản lý License
**Package:** `@faceless/core`
**Mô tả:**
- Thiết lập thư mục `library/` ở thư mục gốc (chứa global assets như nhạc nền, SFX chung).
- Tạo schema và file `library/library.json` để khai báo tên tài sản, tác giả, loại license (ví dụ CC0, CC-BY 4.0, URL nguồn).
- Viết utils kiểm tra: nếu dự án sử dụng asset, asset đó bắt buộc phải có license hợp lệ khai báo trong hệ thống.
**Tiêu chí nghiệm thu:**
- Schema validation pass cho `library.json`.

### Task 2.5: Cập nhật Tài liệu
**Thư mục:** `docs/`
**Mô tả:**
- Xóa stub và viết đầy đủ tài liệu `docs/TEMPLATES-AND-TOPICS.md` (hướng dẫn tạo template mới).
- Viết phần Asset Router trong `docs/ASSETS-AND-AUDIO.md`.
- Ghi chú các rủi ro, bài học rút ra vào `ROADMAP.md` nếu có.
**Tiêu chí nghiệm thu:**
- Đọc tài liệu hiểu ngay cách thêm một template mới vào hệ thống mà không cần đọc code.

---

## Nguyên tắc thực hiện
- Mỗi task phải tạo branch/commit riêng.
- Vẫn tuân thủ TDD: viết integration test trong `@faceless/cli` hoặc `core/renderer` để kiểm chứng.
- Đảm bảo `pnpm -r run test` luôn ở trạng thái 100% green sau mỗi task.
