# Cổng Kiểm soát Chất lượng (QA-GATES.md)

> Tài liệu quy định chi tiết các tiêu chuẩn kiểm duyệt chất lượng kỹ thuật, tính hợp pháp của tài nguyên và độ chuẩn xác âm thanh trước và sau khi render video trong **Faceless Studio**.

---

## 1. Triết lý Kiểm soát Chất lượng

Mỗi video được sản xuất bởi **Faceless Studio** phải đảm bảo 3 tiêu chí bất khả xâm phạm:
1. **Tính Tất định & Tính Toàn vẹn (Integrity & Determinism):** Mọi tài nguyên cấu thành video phải có sẵn trên đĩa và tuân thủ đúng hợp đồng spec dữ liệu (`VideoSpec`). Không có file rỗng, không có liên kết đứt gãy.
2. **Tuân thủ Bản quyền 100% (Legal & License Safety):** Mọi hình ảnh, video, âm thanh, font chữ sử dụng trong sản phẩm bắt buộc phải có license rõ ràng và được ghi nhận trong sổ cái (`assets/manifest.json` hoặc `library/library.json`).
3. **Tiêu chuẩn Phát thanh - Truyền hình (Broadcast & YouTube Compliance):** Âm thanh phải được chuẩn hóa âm lượng theo chuẩn quốc tế EBU R128 / YouTube (-14 LUFS, True Peak -1.0 dBTP), không quá to gây rè vỡ hoặc quá nhỏ làm giảm trải nghiệm người xem.

Hệ thống thiết lập **2 Cổng kiểm soát (QA Gates)** độc lập:
- **Cổng Pre-Render (`studio qa <slug> --pre`):** Chạy trước khi render, ngăn chặn các lỗi cấu trúc và tài nguyên thiếu sót gây lãng phí tài nguyên render.
- **Cổng Post-Render (`studio qa <slug> --post`):** Chạy sau khi xuất file MP4, kiểm tra độ hoàn thiện vật lý, thời lượng và thông số âm học.

---

## 2. Cổng Pre-Render: `studio qa <slug> --pre`

Cổng này kiểm tra dự án trước khi Remotion bắt đầu render. Lệnh thực thi:

```bash
studio qa <slug> --pre [--spec <file>] [--json]
```

### Các Quy tắc Kiểm tra:

| Quy tắc | Danh mục | Mức độ | Điều kiện vi phạm | Hành động |
|---|---|---|---|---|
| **Spec Existence** | `schema` | **ERROR** | Không tìm thấy file spec (`spec.json` hoặc file spec chỉ định) | Chặn render lập tức |
| **Schema Validation** | `schema` | **ERROR** | Dữ liệu spec không khớp với `VideoSpecSchema` (zod) | Báo danh sách trường lỗi, chặn render |
| **Asset Physical Existence** | `asset` | **ERROR** | File hình ảnh/video được tham chiếu trong beat không tồn tại trên đĩa | Báo đường dẫn file thiếu, chặn render |
| **Asset License Integrity** | `license` | **ERROR** | Trường `license` bị bỏ trống hoặc rỗng | Chặn render (Luật vàng #8) |
| **Manifest Registration** | `license` | **ERROR** | Visual asset không được đăng ký trong `assets/manifest.json` | Chặn render, yêu cầu chạy `studio assets import` |
| **Narration Audio Existence** | `asset` | **ERROR** | File giọng đọc narration không tồn tại trên đĩa | Chặn render, yêu cầu chạy `studio run tts` |
| **Music Track Existence** | `asset` | **ERROR** | Nhạc nền không tìm thấy trong project hoặc thư viện `library/music/` | Chặn render |
| **SFX Existence** | `asset` | **ERROR** | Hiệu ứng âm thanh không tìm thấy trong project hoặc `library/sfx/` | Chặn render |
| **Word Alignment Confidence** | `audio_confidence` | **WARNING** | Từ trong narration có `confidence < 0.8` | Cảnh báo biên tập viên nghe kiểm tra lại phát âm |

---

## 3. Cổng Post-Render: `studio qa <slug> --post`

Cổng này kiểm tra thành phẩm video MP4 sau khi quá trình render hoàn tất. Lệnh thực thi:

```bash
studio qa <slug> --post [--video <path>] [--spec <file>] [--json]
```

### Các Quy tắc Kiểm tra:

| Quy tắc | Danh mục | Mức độ | Điều kiện vi phạm | Ý nghĩa & Hướng xử lý |
|---|---|---|---|---|
| **MP4 File Existence** | `file_integrity` | **ERROR** | Không tìm thấy file video MP4 tại `dist/` | Quá trình render thất bại hoặc file bị di chuyển |
| **Minimum File Size** | `file_integrity` | **ERROR** | Dung lượng file video $\le 1000$ bytes | File hỏng, rỗng hoặc bị cắt cụt giữa chừng |
| **Duration Compliance** | `duration` | **WARNING / ERROR** | Thời lượng lệch so với spec $> 2.0$s (Warning), lệch $> 5.0$s (Error) | Kiểm tra lại số frame hoặc độ dài track âm thanh |
| **Integrated Loudness** | `loudness` | **WARNING / ERROR** | Âm lượng lệch khỏi mục tiêu -14 LUFS $> 2.0$ LUFS (Warning), lệch $> 4.0$ LUFS (Error) | Kiểm tra bước hậu kỳ `LoudnessProcessor` |
| **True Peak Ceiling** | `loudness` | **WARNING** | Mức đỉnh thực tế `True Peak > -0.5 dBTP` | Nguy cơ rè âm trên một số thiết bị phát thanh |

---

## 4. Chính sách Phân loại Lỗi & Mã Thoát (Exit Codes)

Hệ thống phân tách rõ ràng giữa hai cấp độ sự cố:

### 4.1 Lỗi (Errors - Chặn Render)
- **Định nghĩa:** Bất kỳ vi phạm nào liên quan đến schema spec, thiếu file vật lý, thiếu license hoặc video render bị rỗng.
- **Hành vi hệ thống:** 
  - Đánh dấu báo cáo `passed: false`.
  - CLI kết thúc với mã thoát **`exit code 1`**.
  - Ngăn chặn các lệnh tiếp theo trong chuỗi CI/CD hoặc pipeline tự động.

### 4.2 Cảnh báo (Warnings - Thông tin Khuyến nghị)
- **Định nghĩa:** Các vấn đề về chất lượng cần sự chú ý của con người nhưng không phá vỡ tính toàn vẹn kỹ thuật (ví dụ: một từ đọc hơi mờ có độ tin cậy 0.75, hoặc âm lượng hơi lệch 0.3 LUFS).
- **Hành vi hệ thống:**
  - Hiển thị nổi bật trên màn hình để biên tập viên nắm thông tin.
  - Vẫn đánh dấu báo cáo `passed: true` (nếu không có lỗi nào khác).
  - CLI kết thúc với mã thoát **`exit code 0`**.

---

## 5. Hướng dẫn Sử dụng CLI & Định dạng Dữ liệu

### 5.1 Giao diện Console (Human-readable)
Khi chạy lệnh trực tiếp từ terminal, hệ thống hiển thị bảng trực quan:

```text
============================================================
QA Gate: [PRE-RENDER] for project: "test-psychology"
Result:  ❌ FAILED
Summary: 4 checks | 1 errors | 1 warnings
============================================================
Details:
  ❌ [ERROR] [asset           ] Visual asset file missing on disk: assets/diagram.png
  ⚠️  [WARN]  [audio_confidence] Low audio alignment confidence for word "tiềm thức" (w042): 0.72 < 0.80
```

### 5.2 Giao diện JSON (`--json`)
Khi gọi với cờ `--json`, CLI xuất ra một đối tượng JSON chuẩn duy nhất trên `stdout`, phục vụ Web UI và script tự động:

```json
{
  "projectSlug": "test-psychology",
  "gate": "pre",
  "passed": false,
  "timestamp": "2026-10-06T07:50:00.000Z",
  "summary": {
    "total": 2,
    "errors": 1,
    "warnings": 1
  },
  "items": [
    {
      "id": "asset-missing-diagram",
      "category": "asset",
      "severity": "error",
      "message": "Visual asset file missing on disk: assets/diagram.png"
    },
    {
      "id": "confidence-w042",
      "category": "audio_confidence",
      "severity": "warning",
      "message": "Low audio alignment confidence for word \"tiềm thức\" (w042): 0.72 < 0.80",
      "details": {
        "wordId": "w042",
        "text": "tiềm thức",
        "confidence": 0.72,
        "startSec": 14.5
      }
    }
  ]
}
```

Mỗi lần chạy QA cũng sẽ tự động ghi lại một bản ghi sự kiện `qa_checked` vào file `events.jsonl` trong thư mục dự án để phục vụ việc kiểm toán sau này.