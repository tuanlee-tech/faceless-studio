# Kiến trúc & Quy trình Pipeline (PIPELINE.md)

> Tài liệu mô tả toàn diện luồng chuyển đổi từ **Ý tưởng thô (Idea)** thành **Video hoàn chỉnh** (bao gồm cả Video ngang dài 16:9 và Video dọc ngắn Shorts 9:16) trong hệ thống **Faceless Studio**.

---

## 1. Sơ đồ Tổng quan Quy trình (End-to-End Pipeline)

```mermaid
flowchart TD
    A[studio new <slug>] --> B[Stage: outline]
    B --> C[Stage: script]
    C --> D[Stage: direct]
    D --> E[Stage: tts & align]
    E --> F[Stage: spec]
    F --> G[QA Gate: studio qa --pre]
    G --> H[studio render --format long-16x9]
    H --> I[QA Gate: studio qa --post]
    I --> J[Video dài 16:9 (-14 LUFS)]
    
    F --> K[studio shorts <slug>]
    K --> L[spec-short-1.json, spec-short-2.json...]
    L --> M[studio render --spec spec-short-1.json]
    M --> N[Video Short 9:16 (-14 LUFS)]
```

---

## 2. Giai đoạn 1: Khởi tạo Dự án (`studio new`)

Lệnh khởi tạo thiết lập cấu trúc thư mục tiêu chuẩn:

```bash
studio new <slug> --topic <topicId> --template <templateId> --minutes <number> --formats long-16x9,short-9x16
```

### Cấu trúc Thư mục Dự án (`projects/<slug>/`)
- `project.json`: Chứa cấu hình metadata (chủ đề, template, thời lượng đích, định dạng xuất bản).
- `state.json`: Sổ theo dõi trạng thái tiến trình từng stage (`pending`, `in_progress`, `done`, `failed`).
- `events.jsonl`: Nhật ký sự kiện định dạng JSON Lines ghi lại toàn bộ hoạt động của hệ thống.
- `tasks/`: Chứa các yêu cầu nhiệm vụ dạng Markdown cho AI Agent.
- `results/`: Chứa kết quả xử lý của Agent theo định dạng JSON.
- `assets/`: Chứa hình ảnh, video asset được import kèm sổ cái `manifest.json`.
- `dist/`: Thư mục xuất video MP4 thành phẩm (`long-16x9.mp4`, `shorts/short-*.mp4`).

---

## 3. Giai đoạn 2: Sáng tạo Nội dung qua Task Inbox (`studio run` & `studio validate`)

Hệ thống phân tách triệt để giữa **công việc sáng tạo** (do AI Agent đảm nhiệm) và **xử lý tất định** (do code máy tính thực thi):

### 3.1 Quy trình Task Inbox
1. Khi chạy `studio run <slug>`, hệ thống kiểm tra `state.json` và tạo file task Markdown tương ứng trong `projects/<slug>/tasks/<slug>-<stage>.md`:
   - `outline`: Xây dựng cấu trúc bài học, các chương (`chapters`), luận điểm chính và hook mở đầu.
   - `script`: Viết lời thoại dẫn chuyện (narration) chi tiết bằng tiếng Việt tự nhiên.
   - `direct`: Phân bổ nhịp điệu (beats), chọn layout preset, motion, hiệu ứng âm thanh (SFX) và chỉ định visual asset cần thiết.
2. Agent đọc task, xử lý nghiệp vụ sáng tạo và lưu kết quả JSON vào `projects/<slug>/results/<slug>-<stage>.json`.
3. Kiểm tra tính hợp lệ bằng lệnh:
   ```bash
   studio validate <slug> [taskId]
   ```
   Hệ thống xác thực kết quả qua các Schema Zod (`OutlineResultSchema`, `ScriptResultSchema`, `DirectResultSchema`). Nếu hợp lệ, stage chuyển thành `done` và cập nhật hash đầu vào/đầu ra.

---

## 4. Giai đoạn 3: Sinh Dữ liệu Tất định (`tts` & `align`)

Sau khi hoàn tất kịch bản:
1. **TTS (Text-to-Speech):** Hệ thống chuyển văn bản kịch bản thành file âm thanh giọng đọc dẫn chuyện (`audio/narration.wav` hoặc `.mp3`).
2. **Align (Forced Alignment):** Căn chỉnh thời gian âm thanh đến từng từ (Word-level timestamps). Mỗi từ được gán:
   - `id`: Định danh duy nhất (ví dụ: `w001`, `w002`).
   - `startSec` & `endSec`: Mốc thời gian chính xác tới mili-giây.
   - `confidence`: Độ tin cậy nhận diện (từ 0.0 đến 1.0).
3. **Spec Compilation:** Kết hợp giọng đọc, mốc từ và chỉ đạo beat để tạo thành `spec.json` hoàn chỉnh tuân thủ `VideoSpecSchema`.

---

## 5. Giai đoạn 4: Trích xuất Short 9:16 (`studio shorts`)

Hệ thống cho phép cắt tự động các video ngắn dưới 60 giây (Shorts / Reels / TikTok) từ video dài nguyên bản:

```bash
studio shorts <slug>
```

### Thuật toán Trích xuất Short (`extractShort`)
- **Tự động nhận diện Hook:** Quét qua các chương/beat để tìm các phân đoạn cao trào, lôi cuốn có độ dài từ 15 đến 50 giây (`autoDetectShortCandidates` hoặc đọc từ `results/*-short-candidates.json`).
- **Dời trục thời gian về gốc 0 ($t=0$):**
  - Giả sử đoạn Short bắt đầu từ từ `w100` ($t = 12.5$s) đến `w180` ($t = 42.5$s).
  - Thuật toán trừ mốc thời gian $12.5$s cho toàn bộ `words`, `beats`, `captions` và `music`. Từ `w100` sẽ xuất phát tại đúng $t = 0$.
- **Cắt gọt (Clamping) beat & SFX:**
  - Loại bỏ các chương và beat nằm ngoài phạm vi Short.
  - Cắt gọt các beat giao thoa để khớp khít với khoảng thời gian của Short.
  - Lọc danh sách SFX và captions, chỉ giữ lại các hiệu ứng neo vào các từ trong Short.
- **Xuất Spec độc lập:** Sinh các file `spec-short-1.json`, `spec-short-2.json`... sẵn sàng render ngay lập tức.

---

## 6. Giai đoạn 5: Hệ thống Âm thanh Chuyên nghiệp & Auto-Ducking

Renderer Remotion tích hợp component `<AudioMixer />` xử lý đa kênh âm thanh:

### 6.1 Neo theo từ (Word-anchored SFX)
- Toàn bộ hiệu ứng âm thanh (SFX) được neo vào Word ID (`anchorWordId` + `offsetSec`).
- Không phụ thuộc vào thời gian cứng, khi thay đổi tốc độ TTS, SFX tự động di chuyển theo từ tương ứng.

### 6.2 Giải thuật Auto-Ducking Tất định
- **Gom cụm hội thoại:** Các từ có khoảng im lặng $< 0.5$s được tự động gộp thành một khối hội thoại liên tục (speech segment), loại bỏ hiện tượng âm lượng giật cục (pumping).
- **Đường cong âm lượng Remotion:**
  - Khi lời dẫn cất lên: Âm lượng nhạc nền tự động hạ (duck) xuống **20–30%** (mặc định 25%).
  - Khi có khoảng lặng $\ge 0.5$s hoặc kết thúc lời thoại: Nhạc nền phục hồi mượt mà về 100% trong vòng $0.2$s.
  - Toàn bộ phép tính là hàm tất định theo `frame`, đảm bảo khả năng render lại y hệt (idempotent).

### 6.3 Hậu kỳ Chuẩn hóa Âm lượng -14 LUFS (`LoudnessProcessor`)
Ngay sau khi Remotion xuất xong file MP4, hệ thống tự động chạy quy trình chuẩn hóa:
1. Trích xuất luồng audio PCM WAV.
2. Áp dụng bộ lọc `loudnorm` hai bước (two-pass) của ffmpeg.
3. Ghép lại luồng video gốc (`-c:v copy` giữ nguyên 100% chất lượng hình ảnh) và mã hóa audio AAC 192 kbps.
4. Đầu ra đạt tiêu chuẩn phát sóng YouTube: **-14 LUFS (± 0.5 LUFS), True Peak -1.0 dBTP**.

---

## 7. Giai đoạn 6: Cổng Kiểm soát Chất lượng QA Gates (`studio qa`)

Trước và sau khi render, video phải vượt qua hai cổng kiểm duyệt:

### 7.1 Cổng Pre-Render: `studio qa <slug> --pre`
- **Schema Validation:** Xác thực `spec.json` hợp lệ 100%.
- **Asset & License Check:** Verify toàn bộ hình ảnh, âm thanh có mặt trên đĩa cứng và được ghi danh đầy đủ trong `assets/manifest.json` hoặc `library/library.json`.
- **Audio Confidence:** Cảnh báo nếu có từ phát âm không rõ ràng (`confidence < 0.8`).

### 7.2 Cổng Post-Render: `studio qa <slug> --post`
- **File Integrity:** Kiểm tra file MP4 tồn tại, dung lượng hợp lệ ($> 1000$ bytes).
- **Duration Check:** Thời lượng thực tế khớp với thời lượng kịch bản (sai số $\le \pm 2.0$s).
- **Loudness Check:** Đo đạc audio xác nhận đạt chuẩn -14 LUFS.

---

## 8. Giai đoạn 7: Xuất bản Video Thành phẩm (`studio render`)

```bash
# Render video ngang dài 16:9
studio render <slug> --format long-16x9

# Render video dọc ngắn Shorts 9:16 từ file spec Short
studio render <slug> --spec spec-short-1.json
```

Video thành phẩm được xuất tại `projects/<slug>/dist/` với hình ảnh sắc nét, phụ đề tiếng Việt chuẩn font OFL, hiệu ứng âm thanh đồng bộ và chuẩn âm lượng phát sóng toàn cầu.