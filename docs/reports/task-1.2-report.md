# Báo cáo nghiệm thu Task 1.2

## Thông tin chung
- **Task:** 1.2 — `@faceless/cli`: Lệnh `new` và `status`
- **Package:** `@faceless/cli`
- **Ngày thực hiện:** 2026-10-05
- **Trạng thái:** PASS

---

## Chi tiết thay đổi

### 1. Module parse arguments (`packages/cli/src/utils/parse-args.ts`)
- Viết parser thuần TypeScript xử lý arguments CLI, trích xuất lệnh chính (`command`), danh sách tham số vị trí (`positionals`) và cờ/tham số dạng `--flag value`, `--flag`, `-f`.
- Không sử dụng thư viện bên ngoài, tuân thủ kiến trúc tối giản và cross-platform.

### 2. Lệnh `studio new` (`packages/cli/src/commands/new.ts`)
- Cú pháp: `studio new <slug> --topic <t> --template <tp> --minutes <m> --formats <f> [--json]`
- Chức năng:
  - Kiểm tra tính hợp lệ của tham số `slug`.
  - Nhận và phân tách danh sách `formats` (hỗ trợ phân tách dấu phẩy như `long-16x9,short-9x16`).
  - Gọi `ProjectManager.createProject()` từ `@faceless/core` để tạo toàn bộ cấu trúc thư mục dự án (`project.json`, `state.json`, `events.jsonl`, `tasks/`, `results/`, `script/`).
  - Khi có cờ `--json`: Xuất JSON object chứa thông tin dự án (`success: true`, `slug`, `projectDir`, v.v.) ra stdout.
  - Khi không có cờ `--json`: In thông báo xác nhận thân thiện ra màn hình kèm đường dẫn và thông số.
  - Xử lý lỗi trùng lặp dự án hoặc lỗi validation schema (trả exit code 1 và thông báo lỗi rõ ràng theo format JSON hoặc text).

### 3. Lệnh `studio status` (`packages/cli/src/commands/status.ts`)
- Cú pháp: `studio status <slug> [--json]`
- Chức năng:
  - Đọc `pm.getState(slug)` từ `@faceless/core`.
  - Khi có cờ `--json`: Xuất trực tiếp cấu trúc JSON của `ProjectState` (tuân thủ `ProjectStateSchema`).
  - Khi không có cờ `--json`: Hiển thị bảng trạng thái terminal định dạng màu ANSI (biểu tượng và màu sắc cho các trạng thái `pending`, `running`, `done`, `failed`).
  - Xử lý trường hợp dự án không tồn tại (trả exit code 1 kèm thông báo lỗi).

### 4. Cập nhật CLI Entry Point (`packages/cli/src/main.ts`)
- Tích hợp điều phối các lệnh: `doctor`, `new`, `status` và `help/default`.

### 5. Cải tiến Cross-platform & Test
- Cập nhật [`doctor.test.ts`](file:///e:/faceless-studio/packages/cli/src/__tests__/doctor.test.ts): Loại bỏ hardcoded đường dẫn Ubuntu (`/home/vcc/...`), dùng đường dẫn động và hỗ trợ xử lý exit code trên Windows khi thiếu công cụ môi trường.
- Tạo mới [`new-status.test.ts`](file:///e:/faceless-studio/packages/cli/src/__tests__/new-status.test.ts) gồm 8 integration tests kiểm tra:
  - Tạo project mặc định và kiểm tra các file thực tế trên đĩa (`project.json`, `state.json`, `events.jsonl`, v.v.).
  - Tạo project với flags tùy biến và xuất kết quả dạng JSON.
  - Xử lý lỗi khi tạo trùng slug.
  - Xử lý lỗi khi thiếu slug.
  - Xem status dạng bảng text với đầy đủ các pipeline stages (`outline`, `script`, `direct`, `spec`, format stages).
  - Xem status dạng JSON khớp với `ProjectStateSchema`.
  - Xử lý lỗi khi xem status của project không tồn tại.
  - Xử lý lỗi khi status thiếu slug.

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

 Test Files  2 passed (2)
      Tests  13 passed (13)
```

### 2. Toàn bộ Monorepo (`pnpm -r run test`)
```text
Scope: 3 of 4 workspace projects
- @faceless/core:  17 tests passed (3 test files)
- @faceless/media:  3 tests passed (1 test file)
- @faceless/cli:   13 tests passed (2 test files)
Tổng cộng: 33 tests passed
```

---

## Tiêu chí nghiệm thu (Checklist)

| Tiêu chí | Trạng thái |
|----------|------------|
| Lệnh `studio new` tạo project hợp lệ theo đúng cấu trúc `ARCHITECTURE.md` | ✅ PASS |
| Lệnh `studio status` in bảng terminal màu hoặc JSON khớp schema khi có `--json` | ✅ PASS |
| Cả hai lệnh chạy không lỗi, kiểm tra đối số nghiêm ngặt | ✅ PASS |
| Test integration xác minh stdout và file hệ thống chạy xanh | ✅ PASS (13/13 tests) |
| Báo cáo nghiệm thu đầy đủ tại `docs/reports/task-1.2-report.md` | ✅ PASS |
