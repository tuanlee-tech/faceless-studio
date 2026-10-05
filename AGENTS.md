# AGENTS.md — Luật làm việc cho agent

Dự án: **Faceless Studio** — ý tưởng thô → video faceless (16:9 dài + 9:16 Short) bằng Remotion, TTS tiếng Việt, và các asset sinh/chỉ đạo bởi AI. Ngôn ngữ nội dung: **tiếng Việt**. Ngôn ngữ mã và định danh: **tiếng Anh**.

Giữ file này ngắn. Quy trình chi tiết nằm trong `docs/` và `skills/`; đọc khi cần, đừng nhớ lại từ trí nhớ.

## Thứ tự đọc

1. `README.md` → `docs/ROADMAP.md` (biết phase hiện tại và tiêu chí nghiệm thu)
2. `docs/ARCHITECTURE.md` và `docs/VIDEO-SPEC.md` trước khi viết bất kỳ code nào
3. Tài liệu còn lại khi chạm vào phần tương ứng (templates, pipeline, assets/audio, QA, cinematic)

## Luật vàng

1. **Spec là hợp đồng.** Mọi thay đổi hình dạng dữ liệu phải sửa `docs/VIDEO-SPEC.md` và schema (zod) trong cùng một commit, kèm bước nâng `specVersion` nếu phá vỡ tương thích.
2. **Một renderer (Remotion).** Không thêm renderer, DSL hay framework video thứ hai. Cần cân nhắc → viết một ADR (xem `docs/ARCHITECTURE.md`) và hỏi người dùng.
3. **Neo theo từ.** Beat, caption, SFX gắn vào word ID. Không hard-code timestamp theo giây trong spec hoặc template.
4. **Tất định.** Mọi animation trong composition là hàm của `frame` (`interpolate`, `spring`, hoặc timeline GSAP được `seek(frame / fps)`). Cấm CSS transition/animation tự chạy, `setTimeout`, `requestAnimationFrame`, `Date.now()`, `Math.random()` không có seed.
5. **Mỗi bước có artifact rõ ràng** trong thư mục project và có thể chạy lại (idempotent) dựa trên hash đầu vào. Không ghi trạng thái ẩn trong bộ nhớ.
6. **Việc sáng tạo đi qua Task Inbox** (viết outline/script, chỉ đạo beat, viết prompt asset). Agent đọc `projects/<slug>/tasks/*.md`, ghi kết quả vào `results/`, rồi chạy `studio validate`. Không sửa `spec.json` bằng tay trừ khi task yêu cầu.
7. **Không phụ thuộc dịch vụ trả phí.** Mặc định dùng thứ miễn phí/local. Bước nào cần dịch vụ ngoài (ảnh/video AI) thì xuất **prompt pack** để người dùng chạy tay, rồi `studio assets import`.
8. **Mọi asset có license trong sổ cái** (`assets/manifest.json`, `library/library.json`). Không dùng nhạc/SFX/font không rõ license.
9. **Không bịa số liệu hay trích dẫn.** Nội dung tâm lý/xã hội: gắn `[VERIFY]` cho khẳng định chưa kiểm chứng và không khẳng định tuyệt đối (xem `topics/*/fact-policy.md`).

## Cross-platform (Windows 10 + Ubuntu 24.04)

- Chỉ viết script Node/TypeScript (chạy bằng `tsx`) và Python (chạy bằng `uv`). **Không** viết `.sh`/`.bat` làm đường chính.
- Dùng `path`/`node:url` cho đường dẫn; không ghép chuỗi với `/` hoặc `\`; không dùng symlink; tên file không dấu cách, chữ thường, `kebab-case`.
- `.gitattributes`: `* text=auto eol=lf`. Mọi file văn bản UTF-8 (không BOM).
- Font phải nằm trong repo (`templates/*/fonts/`), không dựa vào font hệ thống.
- Gọi tiến trình con bằng danh sách đối số (không qua shell) để tránh khác biệt quoting.
- CI/kiểm thử chạy trên cả hai OS. Phát hiện lệch hành vi → ghi vào `docs/ROADMAP.md` mục rủi ro.

## Lệnh chính (mục tiêu; hiện thực dần theo phase)

```text
studio doctor                       kiểm tra môi trường
studio new <slug> --topic --template --minutes --formats
studio status <slug>                trạng thái từng bước (JSON với --json)
studio run <slug> [stage]           chạy bước kế tiếp hoặc một bước cụ thể
studio tasks <slug>                 liệt kê task đang chờ agent
studio validate <slug>              kiểm tra kết quả task + spec
studio assets <slug> export|import  prompt pack ra / asset vào
studio render <slug> --format long-16x9|short-9x16 [--chapter c3]
studio shorts <slug>                dựng Short từ các đoạn short_candidate
studio qa <slug> --pre|--post
```

Mọi lệnh hỗ trợ `--json` (một đối tượng JSON trên stdout) và ghi sự kiện vào `events.jsonl`. Đây là giao diện mà UI sau này sẽ gọi.

## Quy ước mã

TypeScript strict; ESM; một package = một trách nhiệm (`core`, `media`, `renderer-remotion`, `cli`); `core` không import Remotion, React hay API trình duyệt. Kiểm thử bằng Vitest; mỗi stage có test với fixture nhỏ. Ưu tiên hàm thuần. Không thêm dependency khi chưa ghi lý do vào ADR.

## Định nghĩa "xong" cho một thay đổi

Code chạy trên cả hai OS (hoặc ghi rõ phần chưa kiểm) · test mới/cập nhật · tài liệu liên quan đã sửa · `studio qa` không có lỗi mới · liệt kê việc còn mở trong phần mô tả thay đổi.

## Khi bế tắc hoặc mâu thuẫn tài liệu

Dừng, nêu mâu thuẫn bằng 3–5 dòng kèm đề xuất, hỏi người dùng. Không tự chọn lặng lẽ.

## Skills

Dùng skill Remotion/GSAP đã cài cho cú pháp và mẹo thư viện. Dùng skill của dự án (`skills/`): `faceless-director`, `template-author`, `asset-prompter`, `qa-review`. Danh sách và cách cài: `docs/SKILLS.md`.
