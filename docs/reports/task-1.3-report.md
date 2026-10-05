# Báo cáo nghiệm thu Task 1.3

## Thông tin chung
- **Task:** 1.3 — `@faceless/cli`: Lệnh `run` và `validate`
- **Package:** `@faceless/cli` (tương tác với `@faceless/core` và `@faceless/media`)
- **Ngày thực hiện:** 2026-10-05
- **Trạng thái:** PASS

---

## Chi tiết thay đổi

### 1. Bổ sung schemas cho kết quả Task sáng tạo (`packages/core/src/schemas/task-results.ts`)
- Định nghĩa các Zod schema cho kết quả các bước sáng tạo trong pipeline:
  - `OutlineResultSchema`: Kiểm tra cấu trúc dàn ý (`title`, mảng `points`, mảng `sections`).
  - `ScriptResultSchema`: Kiểm tra kịch bản (`title`, `content`, `dialogue`, `sections`).
  - `DirectResultSchema`: Kiểm tra chỉ đạo nhịp điệu (`beats`, `visuals`).
- Re-export các schema này từ `@faceless/core` và export `z` từ `zod` để CLI sử dụng nhất quán.

### 2. Mở rộng `TaskInbox` trong `@faceless/core` (`packages/core/src/task-inbox.ts`)
- Thêm phương thức `listTasks(slug)`: Quét thư mục `projects/<slug>/tasks/*.md`, trích xuất frontmatter YAML (`id`, `stage`, `skill`, `schema`, `prompt`, `filePath`) phục vụ cho lệnh validate và liệt kê task.
- Nâng cấp `validateResult(params)`: Tự động tìm kiếm file kết quả theo cả hai định dạng `<taskId>.json` và `<taskId>-<stage>.json` trong thư mục `results/`.

### 3. Lệnh `studio run <slug> [stage]` (`packages/cli/src/commands/run.ts`)
- Cú pháp: `studio run <slug> [stage] [--json]`
- Chức năng:
  - **Tự động chọn stage:** Nếu không truyền `stage`, CLI tự động tìm stage đầu tiên chưa hoàn thành (`status !== "done"`).
  - **Creative stages (`outline`, `script`, `direct`, `spec`):**
    - Cập nhật trạng thái stage sang `running`.
    - Gọi `TaskInbox.createTask()` để sinh file markdown task vào `tasks/<id>-<stage>.md` với YAML frontmatter đầy đủ.
    - Xuất thông báo chuẩn: `"Task generated. Agent must fulfill results/... then run studio validate."` (hoặc JSON object tương ứng khi có cờ `--json`).
  - **Deterministic stages (`tts`, `align`):**
    - `tts`: Gọi `MockTtsEngine.synthesizeBatch` từ `@faceless/media`, sinh mock audio vào `audio/narration.wav`, cập nhật stage thành `done`.
    - `align`: Gọi `MockAligner.align` từ `@faceless/media`, sinh kết quả căn từ vào `audio/words.json`, cập nhật stage thành `done`.

### 4. Lệnh `studio validate <slug> [taskId]` (`packages/cli/src/commands/validate.ts`)
- Cú pháp: `studio validate <slug> [taskId] [--json]`
- Chức năng:
  - Quét danh sách task trong `tasks/` (hoặc lọc theo `taskId` cụ thể nếu được chỉ định).
  - Đối chiếu từng task với file kết quả trong thư mục `results/`.
  - Gọi `TaskInbox.validateResult()` đối chiếu với Zod schema tương ứng của stage.
  - **Nếu PASS:** In log `[PASSED] Task <id> (stage: <stage>)`, cập nhật stage sang `done` trong `state.json`.
  - **Nếu FAIL:** In log `[FAILED] Task <id> (stage: <stage>): <chi tiết lỗi>`, tự động tạo file `results/<taskId>-errors.md` ghi nhận lỗi Zod, giữ nguyên stage ở trạng thái `running` để agent sửa kết quả.
  - Hỗ trợ cờ `--json` xuất toàn bộ kết quả thẩm định dưới dạng đối tượng JSON.

### 5. Cập nhật CLI Entry Point (`packages/cli/src/main.ts`)
- Tích hợp thêm lệnh `run` và `validate` vào CLI router.

### 6. Bộ Integration Tests (`packages/cli/src/__tests__/run-validate.test.ts`)
- Viết 6 integration tests kiểm tra toàn bộ luồng hoạt động:
  1. **Full workflow:** `studio new` -> `studio run outline` (stage running, task created) -> agent tạo kết quả giả hợp lệ -> `studio validate` (PASS, stage chuyển sang done).
  2. **Auto stage selection:** `studio run` tự động nhận diện bước `outline` khi chưa truyền tham số stage.
  3. **Validation failure:** Ghi kết quả không hợp lệ -> `validate` báo `FAILED`, sinh file `001-errors.md`, stage không chuyển sang `done`.
  4. **TTS deterministic step:** `studio run <slug> tts` sinh file `audio/narration.wav` và hoàn tất stage `tts`.
  5. **Align deterministic step:** `studio run <slug> align` sinh file `audio/words.json` với danh sách căn từ.
  6. **Missing result handling:** `validate` báo lỗi rõ ràng khi chưa có file kết quả.

---

## Kết quả kiểm thử

### 1. Package `@faceless/cli`
```text
> @faceless/cli@0.0.1 build
> tsc (Clean build - Exit code 0)

> @faceless/cli@0.0.1 lint
> tsc --noEmit (Exit code 0)

> @faceless/cli@0.0.1 test
> vitest run
 ✓ src/__tests__/doctor.test.ts (5 tests)
 ✓ src/__tests__/new-status.test.ts (8 tests)
 ✓ src/__tests__/run-validate.test.ts (6 tests)

 Test Files  3 passed (3)
      Tests  19 passed (19)
```

### 2. Toàn bộ Monorepo (`pnpm -r run test`)
```text
Scope: 3 of 4 workspace projects
- @faceless/core:   17 tests passed (3 test files)
- @faceless/media:   3 tests passed (1 test file)
- @faceless/cli:    19 tests passed (3 test files)
Tổng cộng: 39/39 tests passed (100% green)
```

---

## Tiêu chí nghiệm thu (Checklist)

| Tiêu chí | Trạng thái |
|----------|------------|
| Lệnh `studio validate <slug>` quét `results/`, gọi `validateResult()`, ghi log PASSED/FAILED, cập nhật `state.json` | ✅ PASS |
| Lệnh `studio run <slug> [stage]` sinh task file và in thông báo cho creative stage | ✅ PASS |
| Lệnh `studio run <slug> [stage]` gọi MockTTS/MockAlign và cập nhật `done` cho deterministic stage | ✅ PASS |
| Chuỗi lệnh `new` -> `run outline` -> tạo kết quả giả -> `validate` chạy thành công | ✅ PASS |
| Báo cáo nghiệm thu đầy đủ tại `docs/reports/task-1.3-report.md` | ✅ PASS |
