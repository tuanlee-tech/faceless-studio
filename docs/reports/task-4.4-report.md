# Báo cáo Nghiệm thu Task 4.4: Web UI - Storyboard & Asset Manager

> **Mục tiêu:** Xây dựng giao diện Storyboard dạng lưới (Grid) hiển thị các beat từ `spec.json`; Asset Manager hỗ trợ xuất "Prompt Pack" ra tệp Markdown và vùng Kéo-thả (Drag & Drop zone) để upload ảnh minh họa vào `assets/incoming/` kèm cơ chế auto-import; nhúng Trình xem trước Video (Preview Player) hiển thị trực quan bố cục và phụ đề.  
> **Nguyên tắc cốt lõi:** Kiến trúc mỏng (Thin Client) — Tái sử dụng `AssetManager` và `LicenseManager` từ `@faceless/core` để tính hash SHA-256, chuẩn hóa tên file và cập nhật sổ cái `manifest.json`.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

### 1.1 Storyboard Grid View
Triển khai tại [`apps/web/src/components/StoryboardAssetView.tsx`](file:///e:/faceless-studio/apps/web/src/components/StoryboardAssetView.tsx):
- Đọc thông số phân cảnh trực tiếp từ `spec.json` (`api.getSpec(slug)`).
- Hiển thị lưới trực quan từng `beat`:
  - Số thứ tự beat và mã định danh (ví dụ `#1 • Beat [b1]`).
  - Tên layout bố cục (`title-card`, `full-bleed`, `split-left`, `split-right`).
  - Khung xem trước ảnh thumbnail tương ứng đọc từ `api.getFileUrl(slug, asset.filePath)`.
  - Ghi chú đạo diễn và visual prompt đề xuất.
  - Vùng neo thời gian từ ngữ (Words range: `startWordId` $\to$ `endWordId`).

### 1.2 Asset Manager & Kéo Thả (Drag & Drop Zone)
- Xuất Prompt Pack:
  - Nút bấm **"Xuất Prompt Pack (.md)"** gọi `AssetManager.exportPromptPack` qua endpoint `GET /projects/:slug/assets/export`. Tự động tải tệp markdown định dạng sẵn câu lệnh AI prompt (Midjourney, DALL-E, Recraft) về máy người dùng.
- Vùng Kéo-thả (Drag & Drop Zone):
  - Cho phép người dùng kéo thả trực tiếp tệp ảnh (`.png`, `.jpg`, `.jpeg`, `.webp`) hoặc bấm chọn tệp.
  - Mã hóa Base64 và gửi lên `POST /projects/:slug/assets/upload`.
  - Backend tự động ghi tệp vào `assets/incoming/`, kích hoạt `AssetManager.importAssets()`:
    1. Tính mã băm SHA-256 kiểm tra tính toàn vẹn.
    2. Chuyển tệp vào thư mục `assets/processed/`.
    3. Gán giấy phép bản quyền `CC0` và lưu vào sổ cái `assets/manifest.json`.
  - Hiển thị badge xanh tick thành công ngay trên thẻ beat tương ứng.

### 1.3 Remotion Preview Player
- Trình xem trước video nhẹ trực tiếp trên trình duyệt không cần chờ render MP4:
  - Hỗ trợ đổi tỷ lệ khung hình hiển thị (16:9 Dài và 9:16 Short).
  - Tự động nạp ảnh minh họa beat hiện tại làm background.
  - Hiển thị overlay phụ đề (subtitles) và nhãn bố cục beat nổi bật.
  - Bộ điều khiển phát/dừng tự động duyệt qua các phân cảnh.

---

## 2. Nghiệm thu Tiêu chí Cốt lõi của Task 4.4

> **Tiêu chí nghiệm thu:** *Kéo thả 1 bức ảnh vào UI, ảnh tự động gán vào cảnh tương ứng và cập nhật lên Remotion Player.*

- **Xác thực tự động (Integration Test):**
  Trong [`apps/web/src/__tests__/web.test.ts`](file:///e:/faceless-studio/apps/web/src/__tests__/web.test.ts):
  - Test case `Task 4.4: exportPromptPack, uploadAsset, and getAssetManifest manage visual assets`:
    - Gửi tệp ảnh base64 `b1.png` qua `api.uploadAsset()`.
    - Server tự động import vào `assets/processed/b1.png`.
    - Kiểm tra `manifest.json` ghi nhận asset có `id: "b1"`, `fileName: "b1.png"`.
    - `api.getFileUrl` cung cấp đúng URL phục vụ hiển thị ảnh lên player và storyboard.

---

## 3. Kết quả Kiểm thử
- **Unit & Integration Test:** 14/14 tests passed trong `@faceless/web`.
- **Lint (`tsc --noEmit`):** 0 errors.
- **Build (`vite build`):** Clean build.
