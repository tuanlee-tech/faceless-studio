# ROADMAP

## Phase 0 — Foundation (Nền tảng)
**Mục tiêu:** Monorepo chạy được, schema zod, `studio doctor`, tài liệu gốc.
**Tiêu chí nghiệm thu:**
- Monorepo: `pnpm build` và `pnpm test` xanh trên Ubuntu 24.04.
- Schema: `VideoSpec`, `ProjectConfig`, `StageState` export được từ `@faceless/core`; có test roundtrip (parse → serialize → parse).
- `studio doctor` kiểm được: Node ≥ 22, pnpm, Python ≥ 3.10, uv, ffmpeg, ffprobe; in kết quả JSON khi `--json`.
- `docs/VIDEO-SPEC.md` khớp với schema zod (cùng commit).
- Spike TTS/Align: **hoãn** — tạo interface + mock; chạy spike thật khi có VieNeu-TTS.

## Phase 1 — Pipeline cốt lõi (Script → Spec → Render khung)
**Mục tiêu:** Từ `idea.md` → spec.json → render 1 video 16:9 đơn giản (text trên nền đen + TTS mock).
**Tiêu chí nghiệm thu:**
- `studio new test-01 --topic sample --template minimal --minutes 1 --formats long-16x9` tạo project hợp lệ.
- Task Inbox: outline → script → direct → spec, mỗi bước có task file, schema validate đạt.
- `studio render test-01 --format long-16x9` xuất mp4 ≥ 30 giây, có subtitle, có giọng TTS (mock sine wave nếu chưa có VieNeu).
- `studio status test-01 --json` trả JSON đúng schema.

## Phase 2 — Template & Asset hệ thống
**Mục tiêu:** 2 template (baroque-mono, clean-split), asset router (prompt pack → import), library management.
**Tiêu chí nghiệm thu:**
- Đổi template trong `project.json` → render lại cho kết quả khác biệt rõ ràng về layout/style.
- `studio assets test-01 export` xuất prompt pack; `studio assets test-01 import` nhận asset vào đúng vị trí.
- Subtitle tiếng Việt hiển thị đúng (font bundled, không dùng font hệ thống).

## Phase 3 — Short 9:16, QA, Audio mix
**Mục tiêu:** Sinh Short từ spec, QA gates, audio mixing (nhạc + SFX + ducking).
**Tiêu chí nghiệm thu:**
- `studio shorts test-01` xuất ≥ 1 Short 9:16 hợp lệ.
- `studio qa test-01 --pre` và `--post` chạy được, trả danh sách lỗi/cảnh báo.
- Audio mix: loudness đạt -14 LUFS ± 1 (YouTube target), ducking khi có giọng đọc.

## Phase 4 — UI (server + web)
**Mục tiêu:** Web UI gọi CLI qua REST, hiển thị tiến độ qua SSE.
**Tiêu chí nghiệm thu:**
- Xem `docs/ARCHITECTURE.md` mục 11.

## Spike & Rủi ro
- **Spike: TTS alignment** — WhisperX vs stable-ts trên giọng VieNeu thật. Tiêu chí: lệch từ TB < 80ms, không mất từ. → Chạy khi có model.
- **Spike: Render perf** — 1 chương 2 phút ở 30fps, đo thời gian trên CPU i5 đời 12. → Phase 1.
- **Rủi ro: Remotion license** — miễn phí ≤ 3 người. Kiểm lại trước Phase 4.
- **Rủi ro: VieNeu-TTS v3 Turbo** — chưa xác nhận GPU Pascal. CPU-first.
- **Rủi ro: Cross-platform** — Windows chưa kiểm. Ghi lại mỗi phát hiện.