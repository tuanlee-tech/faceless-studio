# Báo cáo Nghiệm thu Task 2.3: Asset Router & Lệnh `studio assets`

> **Mục tiêu:** Xây dựng module quản lý Asset (`AssetManager`), triển khai cấu trúc thư mục `projects/<slug>/assets/`, lệnh CLI `studio assets <slug> export` và `studio assets <slug> import`.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

1. **Schema & Cấu trúc thư mục Asset:**
   - Định nghĩa `AssetManifestSchema` và `AssetManifestItemSchema` trong `packages/core/src/schemas/asset-manifest.ts`.
   - Cấu trúc thư mục được tự động khởi tạo khi làm việc với project:
     - `projects/<slug>/assets/manifest.json`
     - `projects/<slug>/assets/requests/`
     - `projects/<slug>/assets/incoming/`
     - `projects/<slug>/assets/processed/`

2. **Lớp nghiệp vụ `AssetManager` (`@faceless/core`):**
   - `exportPromptPack(slug)`:
     - Quét `spec.json` tìm các beat cần sinh hình ảnh minh họa.
     - Sinh tệp Markdown `projects/<slug>/assets/requests/prompt-pack.md` bao gồm: Tên file target (`b1.png`), tỉ lệ khung hình (`--ar 16:9` hoặc `9:16`), prompt chi tiết, negative prompt, và ghi chú đạo diễn.
   - `importAssets(slug)`:
     - Quét các file trong `projects/<slug>/assets/incoming/`.
     - Lọc các định dạng ảnh hợp lệ (`.png`, `.jpg`, `.jpeg`, `.webp`), kiểm tra dung lượng > 0.
     - Tính toán mã băm sha256 cho mỗi ảnh.
     - Di chuyển ảnh vào `projects/<slug>/assets/processed/<assetId>.<ext>`.
     - Cập nhật sổ cái `manifest.json` với giấy phép mặc định `CC0` và nguồn `ai-generated-user-import`.

3. **CLI Command `studio assets` (`@faceless/cli`):**
   - Cú pháp: `studio assets <slug> export|import [--base-dir <dir>] [--json]`.
   - Ghi nhật ký sự kiện vào `projects/<slug>/events.jsonl`:
     - `assets_exported` khi xuất prompt pack.
     - `assets_imported` khi nạp ảnh thành công.
   - Hỗ trợ cờ `--json` xuất kết quả chuẩn JSON cho UI/automation.

---

## 2. Kết quả kiểm thử

- **Unit tests (`packages/core/src/asset-manager.test.ts` - 3 tests):**
  - `initializes project asset directories and empty manifest`: Pass
  - `exports prompt-pack.md for project`: Pass
  - `imports valid images from incoming directory to processed and updates manifest`: Pass
- **Integration tests (`packages/cli/src/__tests__/assets.test.ts` - 5 tests):**
  - `fails when slug is missing`: Pass
  - `fails when project does not exist`: Pass
  - `fails when action is invalid`: Pass
  - `exports prompt pack and logs event`: Pass
  - `imports incoming assets, updates manifest, and logs event`: Pass
