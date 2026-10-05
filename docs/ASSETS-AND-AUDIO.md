# Quản trị Asset, Âm thanh & Bản quyền (Assets & Audio)

> **Trạng thái:** Hoàn thiện Phase 2.  
> **Áp dụng cho:** `@faceless/core`, `@faceless/cli`, thư mục `library/`, `projects/<slug>/assets/`.

---

## 1. Asset Router & Quy trình xuất nhập Prompt Pack

Theo **Luật vàng #7 (AGENTS.md)**: Hệ thống không phụ thuộc vào các API sinh ảnh trả phí đắt đỏ. Thay vào đó, hệ thống xuất ra **Prompt Pack** để người dùng sinh ảnh bằng các công cụ AI yêu thích (Midjourney, DALL-E 3, Stable Diffusion, Recraft, Flux), rồi nhập lại vào project thông qua CLI.

### Cấu trúc thư mục Asset của dự án

```text
projects/<slug>/assets/
├── manifest.json         # Sổ cái tài sản cục bộ của project
├── requests/             # Nơi chứa các prompt pack được sinh ra
│   └── prompt-pack.md
├── incoming/             # Thư mục tạm để người dùng thả ảnh vừa tải về
└── processed/            # Thư mục chính thức chứa ảnh đã được kiểm tra và đánh hash
    ├── b1.png
    └── b2.png
```

### Các bước thực thi:

#### Bước 1: Xuất Prompt Pack
```bash
studio assets <slug> export
```
- Lệnh sẽ quét `spec.json` (các beats và director notes) để tạo ra danh sách prompt được tối ưu hóa theo phong cách của topic/template.
- Xuất file `projects/<slug>/assets/requests/prompt-pack.md`.
- Ghi nhận sự kiện `assets_exported` vào `events.jsonl`.

#### Bước 2: Thả ảnh vào `incoming/`
- Người dùng chạy prompt trên Midjourney / Flux.
- Đặt tên file theo định dạng target (ví dụ: `b1.png`, `b2.png`).
- Bỏ tất cả ảnh vào `projects/<slug>/assets/incoming/`.

#### Bước 3: Nạp ảnh vào hệ thống
```bash
studio assets <slug> import
```
- Hệ thống quét `incoming/`:
  - Kiểm tra định dạng (`.png`, `.jpg`, `.jpeg`, `.webp`).
  - Kiểm tra dung lượng hợp lệ (> 0 bytes).
  - Tính mã băm `sha256` để chống trùng lặp.
  - Chuyển file sang thư mục `processed/`.
  - Cập nhật thông tin asset vào `manifest.json`.
- Ghi nhận sự kiện `assets_imported` vào `events.jsonl`.

---

## 2. Quản lý License & Sổ cái bản quyền (Golden Rule #8)

> **Luật vàng #8:** Mọi asset có license trong sổ cái (`assets/manifest.json`, `library/library.json`). Không dùng nhạc/SFX/font không rõ license.

### 2.1 Sổ cái toàn cục: `library/library.json`
Theo dõi các tài sản dùng chung cho toàn bộ dự án (nhạc nền, âm thanh hiệu ứng SFX, font chữ):

```json
{
  "music": [
    {
      "id": "ambient_track",
      "name": "Ambient Cinematic",
      "type": "music",
      "path": "library/music/ambient.mp3",
      "license": "CC-BY-4.0",
      "author": "Composer Name",
      "sourceUrl": "https://freemusicarchive.org/..."
    }
  ],
  "sfx": [
    {
      "id": "whoosh",
      "name": "Whoosh Transition",
      "type": "sfx",
      "path": "library/sfx/whoosh.wav",
      "license": "CC0"
    }
  ],
  "fonts": [
    {
      "id": "playfair-display",
      "name": "Playfair Display",
      "type": "font",
      "path": "templates/baroque-mono/fonts/PlayfairDisplay-Regular.ttf",
      "license": "OFL-1.1",
      "author": "Claus Eggers Sørensen",
      "sourceUrl": "https://fonts.google.com/specimen/Playfair+Display"
    }
  ]
}
```

### 2.2 License Validator (`LicenseManager`)
Class `LicenseManager` trong `@faceless/core` chịu trách nhiệm:
- Kiểm tra tính hợp lệ của license: Phải thuộc các chuẩn mở được công nhận (CC0, CC-BY, OFL, MIT, Public Domain, custom-internal).
- Kiểm tra chéo (Cross-check): Mọi asset xuất hiện trong `VideoSpec` phải tồn tại trong `manifest.json` hoặc `library.json` và có license rõ ràng. Nếu thiếu sẽ bị từ chối render hoặc cảnh báo QA.