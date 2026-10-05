# Faceless Studio (tên tạm)

Hệ thống biến **một ý tưởng thô** thành **video faceless hoàn chỉnh** — video dài 16:9 cho YouTube (5–30 phút) và các Short 9:16 sinh ra từ cùng nội dung — với giọng đọc tiếng Việt, nhạc, SFX, subtitle và hình ảnh có chỉ đạo như một video director.

> Trạng thái: **giai đoạn đặc tả**. Chưa có code. Bộ tài liệu này là đầu vào để AI agent (Google Antigravity hoặc agent khác) xây dựng hệ thống.

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

## Cách giao việc cho agent

1. Tạo repo mới, chép toàn bộ thư mục này vào gốc repo (giữ nguyên `AGENTS.md`, `docs/`, `skills/`).
2. Cài skill theo `docs/SKILLS.md` (mục A), rồi đồng bộ skill tự viết sang thư mục skill của agent.
3. Dán prompt khởi động dưới đây vào agent:

```text
Đọc AGENTS.md, rồi docs/ROADMAP.md. Bắt đầu Phase 0.
Trước khi viết code: tóm tắt cho tôi (tối đa 15 dòng) kế hoạch Phase 0, các giả định,
và những điểm bạn thấy mâu thuẫn hoặc thiếu trong tài liệu. Chờ tôi xác nhận rồi mới code.
Mỗi phase kết thúc bằng: chạy kiểm thử, cập nhật tài liệu liên quan, và liệt kê việc còn mở.
```

4. Sau mỗi phase, kiểm tra theo "Tiêu chí nghiệm thu" trong `docs/ROADMAP.md` rồi mới cho agent sang phase tiếp theo.

## Yêu cầu môi trường (dự kiến)

Node.js 22 LTS · Python 3.10+ với `uv` · FFmpeg và ffprobe trong PATH · Chrome/Chromium (Remotion tự tải) · VieNeu-TTS (cài trong `sidecar/`). Lệnh `studio doctor` kiểm tra tất cả và chỉ cách sửa theo từng hệ điều hành.
