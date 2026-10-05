## Nghiệm thu Task 0.6

- Trạng thái: PASS
- `pnpm build` exit code: 0
- `pnpm test` exit code: 0
- `studio doctor` output (console):
```
✅ node (24.19.0)
✅ pnpm (9.15.4)
✅ python3 (3.12.3)
✅ uv (0.12.14)
✅ ffmpeg (6.1.1-3ubuntu5)
✅ ffprobe (6.1.1-3ubuntu5)

🎉 All checks passed!
```
- `studio doctor --json` output (first 5 lines):
```
{
  "checks": [
    {
      "name": "node",
      "found": true,
      "version": "24.19.0",
```
- Việc còn mở:
  - Không

---

### Checklist tự nghiệm thu (từ phase-0-plan.md)

- [x] `cd packages/cli && pnpm build` thành công
- [x] `cd packages/cli && pnpm test` — tất cả test xanh (5 tests passed)
- [x] `node packages/cli/dist/main.js doctor` chạy được, in bảng kiểm tra
- [x] `node packages/cli/dist/main.js doctor --json` in JSON hợp lệ ra stdout, `JSON.parse()` thành công
- [x] JSON output có trường `checks` (array) và `allPassed` (boolean)
- [x] Mỗi check có `fix.windows` và `fix.ubuntu`
- [x] Không dùng `exec()` (shell), chỉ `execFile()` (danh sách đối số)
- [x] Không thêm dependency CLI parser ngoài danh sách (đã xóa `execa`)
- [x] Package.json có `bin: { "studio": "./dist/main.js" }` cho phép chạy `pnpm studio doctor`

### Lưu ý thay đổi so với plan gốc

1. **Xóa dependency `execa`**: Plan chỉ liệt kê `@faceless/core` trong dependencies. Đã xóa `execa@^9.5.0`.
2. **Thêm `bin` field**: Plan yêu cầu `"bin": { "studio": "./dist/main.js" }` trong package.json. Đã thêm.
3. **Mở rộng test**: Thêm 2 test integration chạy CLI thực tế (`runDoctor (via CLI)`) để kiểm tra output format console và JSON, thay vì mock `process.stdout.write` (gây lỗi `process.exit` trong test unit).