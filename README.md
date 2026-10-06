# Faceless Studio (tên tạm)

Hệ thống biến **một ý tưởng thô** thành **video faceless hoàn chỉnh** — video dài 16:9 cho YouTube (5–30 phút) và các Short 9:16 sinh ra từ cùng nội dung — với giọng đọc tiếng Việt, nhạc, SFX, subtitle và hình ảnh có chỉ đạo như một video director.

> Trạng thái: **Đã hoàn thiện Phase 0 đến Phase 4** (Core Engine, Pipeline, Templates, Shorts, Audio Mix, QA Gates, CLI và Web UI).

## Nguyên tắc cốt lõi

1. **Tinh gọn:** một renderer, một schema, một CLI. Thêm thứ gì phải thay thế được thứ đang có (xem `docs/ARCHITECTURE.md`, mục ADR).
2. **Một Video Spec, hai Composition:** nội dung nằm trong `spec.json`; video dài 16:9 và Short 9:16 đều dựng lại từ spec đó, không crop từ video đã render.
3. **Neo theo từ, không theo giây:** mọi beat gắn vào word ID của lời đọc. Sửa script thì timing tự co giãn.
4. **Topic × Template:** nội dung (Topic Pack) tách khỏi phong cách (Template Pack). Thêm chủ đề hoặc template = thêm một thư mục.
5. **Sẵn sàng cho UI:** thư mục project là nguồn sự thật duy nhất; mọi bước là lệnh CLI trả JSON; việc cần sáng tạo (viết script, chỉ đạo) đi qua "Task Inbox" để agent hoặc UI đều xử lý được.
6. **Chạy được trên Windows 10 và Ubuntu 24.04**, CPU-first (không bắt buộc GPU).
7. **Ưu tiên tài nguyên miễn phí** và ghi lại license của mọi asset.

## Bản đồ tài liệu

| File | Nội dung |
|---|---|
| `AGENTS.md` | Luật làm việc cho agent (đọc đầu tiên) |
| `docs/ARCHITECTURE.md` | Kiến trúc, cấu trúc repo, Task Inbox, quyết định kỹ thuật (ADR), cross-platform, hướng UI |
| `docs/VIDEO-SPEC.md` | Hợp đồng dữ liệu `spec.json` |
| `docs/TEMPLATES-AND-TOPICS.md` | Template Pack, Topic Pack, 2 template + 1 chủ đề MVP |
| `docs/PIPELINE.md` | Các bước từ ý tưởng đến video; quy tắc video dài và Short |
| `docs/CINEMATIC-GRAMMAR.md` | Ngôn ngữ điện ảnh → recipe → cách hiện thực |
| `docs/ASSETS-AND-AUDIO.md` | Asset Router, prompt pack, trong suốt, TTS, căn từ, nhạc, SFX |
| `docs/QA-GATES.md` | Cổng kiểm tra trước và sau render |
| `docs/ROADMAP.md` | Các phase, tiêu chí nghiệm thu, spike, rủi ro |
| `docs/SKILLS.md` | Skill cần cài + skill tự viết |
| `skills/*/SKILL.md` | Bản nháp 4 skill tự viết |

## Hướng dẫn sử dụng & Khởi chạy (Usage Guide)

### 1. Chuẩn bị môi trường & Cài đặt

```bash
# Cài đặt toàn bộ dependencies
pnpm install

# Build mã nguồn TypeScript cho toàn bộ packages & apps
pnpm build

# Kiểm tra tính tương thích môi trường (Node, pnpm, Python, uv, ffmpeg, ffprobe)
pnpm studio doctor
```

---

### 2. Chạy giao diện Web (Web UI & API Server)

Dự án hỗ trợ Web UI tương tác trực quan với SSE realtime:

```bash
# Khởi động Backend API server (Hono) - mặc định tại http://localhost:3005
pnpm server

# Khởi động Frontend Web (Vite + React) - mặc định tại http://localhost:3000
pnpm web
```

Truy cập trình duyệt tại **http://localhost:3000** để tạo dự án mới, giám sát trạng thái pipeline, duyệt Task Inbox, quản lý assets và render video.

---

### 3. Sử dụng qua dòng lệnh CLI (`studio`)

Bạn có thể chạy toàn bộ pipeline độc lập thông qua CLI:

```bash
# 1. Kiểm tra môi trường hệ thống
pnpm studio doctor

# 2. Khởi tạo một dự án video mới
pnpm studio new demo-video --topic sample --template baroque-mono --minutes 1 --formats long-16x9

# 3. Xem trạng thái và các stage của dự án
pnpm studio status demo-video

# 4. Xem danh sách task đang chờ agent hoặc người dùng xử lý
pnpm studio tasks demo-video

# 5. Chạy stage tiếp theo (hoặc chỉ định stage: outline, script, direct, spec, tts, align)
pnpm studio run demo-video

# 6. Kiểm tra hợp lệ (validate) kịch bản, beat và spec.json
pnpm studio validate demo-video

# 7. Xuất Prompt Pack cho AI sinh ảnh/video
pnpm studio assets demo-video export

# 8. Nhập tài nguyên (assets) đã sinh vào dự án
pnpm studio assets demo-video import ./my-assets

# 9. Render video dài 16:9 (MP4 kèm audio mix & subtitle chuẩn neo theo từ)
pnpm studio render demo-video --format long-16x9

# 10. Render các đoạn video Shorts 9:16
pnpm studio shorts demo-video

# 11. Kiểm tra chất lượng video trước và sau render (QA Gates)
pnpm studio qa demo-video --pre
pnpm studio qa demo-video --post

# 12. Xóa dự án (xóa toàn bộ file và thư mục dự án trên đĩa)
pnpm studio delete demo-video
```

Mọi lệnh CLI đều hỗ trợ cờ `--json` để xuất kết quả dạng JSON cho automation hoặc tích hợp bên ngoài.

## Cách giao việc cho agent

1. Tạo repo mới, chép toàn bộ thư mục này vào gốc repo (giữ nguyên `AGENTS.md`, `docs/`, `skills/`).
2. Cài skill theo `docs/SKILLS.md` (mục A), rồi đồng bộ skill tự viết sang thư mục skill của agent.
3. Dán prompt khởi động dưới đây vào agent:

```text
Đọc AGENTS.md, docs/ROADMAP.md và docs/LESSONS-LEARNED.md. Bắt đầu Phase 0.
Trước khi viết code: tóm tắt cho tôi (tối đa 15 dòng) kế hoạch Phase 0, các giả định,
và những điểm bạn thấy mâu thuẫn hoặc thiếu trong tài liệu. Chờ tôi xác nhận rồi mới code.
Mỗi phase kết thúc bằng: chạy kiểm thử, cập nhật tài liệu liên quan, ghi bài học vào docs/LESSONS-LEARNED.md, và liệt kê việc còn mở.
```

4. Sau mỗi phase, kiểm tra theo "Tiêu chí nghiệm thu" trong `docs/ROADMAP.md` rồi mới cho agent sang phase tiếp theo.

## Yêu cầu môi trường (dự kiến)

Node.js 22 LTS · Python 3.10+ với `uv` · FFmpeg và ffprobe trong PATH · Chrome/Chromium (Remotion tự tải) · VieNeu-TTS (cài trong `sidecar/`). Lệnh `studio doctor` kiểm tra tất cả và chỉ cách sửa theo từng hệ điều hành.
