# Hướng dẫn Thiết kế & Quản lý Templates và Topics

> **Trạng thái:** Hoàn thiện Phase 2.  
> **Áp dụng cho:** `@faceless/renderer-remotion`, `@faceless/core`, thư mục `templates/`, thư mục `topics/`.

---

## 1. Cấu trúc một Template Pack (`templates/<templateId>/`)

Mỗi template là một gói khép kín định nghĩa phong cách thị giác, bố cục (layouts), font chữ và màu sắc của video.

```text
templates/<templateId>/
├── template.json         # Cấu hình chính (schema: TemplateConfigSchema)
└── fonts/                # Thư mục font cục bộ (.ttf / .woff2)
    ├── <FontName>-Regular.ttf
    └── <FontName>-Bold.ttf
```

> **Luật vàng về Font (AGENTS.md):** Font bắt buộc phải nằm trong repo (`templates/*/fonts/`), không dựa vào font hệ thống. Điều này đảm bảo render trên Ubuntu 24.04 và Windows 10 cho ra phụ đề tiếng Việt chính xác 100%, không bị lỗi ô vuông hay font fallback ngoài ý muốn.

### Cấu hình `template.json`

```json
{
  "id": "baroque-mono",
  "name": "Baroque Monochrome",
  "version": "1.0.0",
  "description": "Phong cách cổ điển, trầm mặc, kể chuyện lịch sử & triết học với gam màu tối và font Serif",
  "fonts": [
    {
      "family": "Playfair Display",
      "file": "fonts/PlayfairDisplay-Regular.ttf",
      "weight": "400",
      "style": "normal"
    },
    {
      "family": "Playfair Display",
      "file": "fonts/PlayfairDisplay-Bold.ttf",
      "weight": "700",
      "style": "normal"
    }
  ],
  "colors": {
    "background": "#0c0a09",
    "text": "#f5f5f4",
    "primary": "#d97706",
    "secondary": "#78716c",
    "accent": "#b45309",
    "highlight": "#fbbf24"
  },
  "subtitles": {
    "fontFamily": "'Playfair Display', Georgia, serif",
    "fontSize": 48,
    "color": "#f5f5f4",
    "highlightColor": "#fbbf24",
    "bottomOffset": 100,
    "maxWordsPerLine": 6,
    "textTransform": "none"
  },
  "layoutPresets": ["center-text", "ornate-frame", "full-bleed"],
  "motionPresets": ["fade-in", "slow-zoom", "cross-fade"]
}
```

---

## 2. Danh sách Template MVP (Phase 2)

| Template ID | Tên | Phong cách | Font chủ đạo | Bố cục đặc trưng |
|---|---|---|---|---|
| `minimal` | Minimal Dark | Tối giản, nền đen thuần | System UI / Sans-serif | Căn giữa, tập trung vào text |
| `baroque-mono` | Baroque Monochrome | Cổ điển, lịch sử, triết học, tâm lý trầm lắng | Playfair Display (Serif) | Khung viền chỉ vàng tinh tế, tiêu đề trang trọng, phụ đề highlight màu hổ phách (`#fbbf24`) |
| `clean-split` | Clean Split | Hiện đại, tin tức, tài chính, công nghệ | Be Vietnam Pro (Sans-serif) | Chia đôi màn hình: bên trái là text & context, bên phải là card visual media |

---

## 3. Cơ chế Template Switching

Để thay đổi giao diện video, người dùng chỉ cần sửa trường `templateId` trong file `projects/<slug>/project.json`:

```json
{
  "templateId": "clean-split"
}
```

Khi chạy lệnh render:
```bash
studio render <slug> --format long-16x9
```
Hệ thống sẽ:
1. Đọc `templateId` từ `project.json` / `spec.json`.
2. `TemplateManager` trong `@faceless/core` tự động nạp cấu hình `template.json`.
3. `RemotionRendererAdapter` chuyển font `.ttf` thành base64 nhúng thẳng vào composition.
4. `MainVideo.tsx` tự động chuyển đổi layout tương ứng (`BaroqueMonoLayout` hoặc `CleanSplitLayout`).

---

## 4. Subtitle neo theo từ (Word-Level Subtitles)

Component `Subtitle.tsx` trong `@faceless/renderer-remotion` thực hiện:
- **Neo theo từ:** Đọc mảng `narration.words` từ `spec.json`.
- **Tất định (Deterministic):** Tính toán thời gian hiện tại từ `frame / fps`.
- **Active word highlight:** Từ đang được đọc sẽ nổi bật bằng màu `highlightColor` và kích thước tăng nhẹ 8%, các từ còn lại mang màu sắc chuẩn của template.
- **Tự động phân đoạn (Chunking):** Nhóm 5–7 từ mỗi dòng (hoặc theo nhịp ngắt câu > 0.4s) tạo cảm giác đọc tự nhiên như TikTok/Reels/Shorts.

---

## 5. Hướng dẫn tạo một Template mới

1. Tạo thư mục `templates/<new-template-id>/`.
2. Tạo file `template.json` theo đúng schema `TemplateConfigSchema`.
3. Bỏ font chữ `.ttf` vào `templates/<new-template-id>/fonts/` (chọn font có hỗ trợ đầy đủ ký tự tiếng Việt và có license tự do như OFL-1.1).
4. Khai báo font vào `library/library.json`.
5. Tạo layout component tương ứng trong `packages/renderer-remotion/src/remotion/templates/<NewTemplateLayout>.tsx`.
6. Đăng ký layout trong `MainVideo.tsx`.