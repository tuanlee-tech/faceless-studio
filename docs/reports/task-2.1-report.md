# Báo cáo Nghiệm thu Task 2.1: Cơ chế Template & Subtitles (Renderer)

> **Mục tiêu:** Định nghĩa schema `TemplateConfig`, xây dựng component `Subtitle.tsx` neo theo từ (word-level highlight) và cơ chế nạp font cục bộ (bundled fonts) thay vì phụ thuộc font hệ thống.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

1. **Schema & Types (`@faceless/core`):**
   - Tạo file `packages/core/src/schemas/template-config.ts` với các schema:
     - `TemplateConfigSchema`: Quản lý `id`, `name`, `version`, `fonts`, `colors`, `subtitles`, `layoutPresets`, `motionPresets`.
     - `TemplateFontSchema`: Quản lý khai báo font (`family`, `file`, `weight`, `style`).
     - `TemplateColorsSchema`: Quản lý màu nền, màu chữ, màu primary, highlight.
     - `TemplateSubtitleStyleSchema`: Cấu hình font chữ, cỡ chữ, màu sắc, màu highlight, khoảng cách bottom, số từ tối đa trên dòng.
     - `BUILTIN_TEMPLATES`: Khai báo sẵn các preset cấu hình thuần dữ liệu cho `minimal`, `baroque-mono`, `clean-split`.
   - Xuất khẩu đầy đủ từ `packages/core/src/schemas/index.ts` và `packages/core/src/index.ts`.

2. **Component Subtitle Neo Theo Từ (`@faceless/renderer-remotion`):**
   - Tạo `packages/renderer-remotion/src/remotion/Subtitle.tsx`:
     - Neo theo từ (Golden Rule #3): Đọc `spec.narration.words` và beat `captions`.
     - Tất định (Golden Rule #4): Xác định từ đang nói tại thời điểm `frame / fps`.
     - Highlight từ đang đọc bằng `highlightColor`, font weight 700, tỉ lệ scale 1.08.
     - Hàm `groupWordsIntoChunks`: Tự động phân đoạn lời đọc thành các cụm 5–7 từ hoặc ngắt theo khoảng nghỉ > 0.4s giúp trải nghiệm đọc mượt mà.

3. **Cơ chế Bundled Font Chống Lỗi Hiển Thị Tiếng Việt:**
   - Tải và đóng gói sẵn các font OFL-1.1 vào repo:
     - `templates/baroque-mono/fonts/PlayfairDisplay-Regular.ttf` & `PlayfairDisplay-Bold.ttf`
     - `templates/clean-split/fonts/BeVietnamPro-Regular.ttf` & `BeVietnamPro-Bold.ttf`
   - Trong `RemotionRendererAdapter` (`adapter.ts`): Tự động đọc file `.ttf` từ đĩa, chuyển đổi thành `@font-face` data URI dạng base64 và nhúng trực tiếp qua `fontsCss` vào `<style>` của composition. Đảm bảo Chromium render phụ đề tiếng Việt đồng nhất 100% trên cả Windows 10 và Ubuntu 24.04 mà không phụ thuộc font hệ điều hành.

---

## 2. Kết quả kiểm thử

- **Unit tests:**
  - `packages/renderer-remotion/src/__tests__/subtitle.test.ts` (3 tests):
    - `chunks words respecting maxWordsPerLine limit`: Pass
    - `splits chunks early on spoken pauses > 0.4s`: Pass
    - `handles empty words array gracefully`: Pass
  - `packages/core/src/schemas/__tests__/schemas.test.ts` (12 tests):
    - `TemplateConfigSchema` validation và roundtrip tests: Pass
- **Type-Check & Build:**
  - `tsc --noEmit`: 0 errors
  - `tsc`: Clean build
