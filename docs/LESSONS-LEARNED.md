# Đúc kết kinh nghiệm & Quy tắc phòng ngừa sai lầm (Lessons Learned)

> **Mục đích:** Tài liệu này đúc kết toàn bộ bài học xương máu từ các sai lầm, sự cố bị REJECT và cách khắc phục trong quá trình phát triển Phase 1 của dự án **Faceless Studio**.  
> **Đối tượng áp dụng:** Agent hiện tại và toàn bộ các sub-agents tiếp nối trong Phase 2, 3, 4. Bắt buộc phải đọc và tuân thủ trước khi triển khai bất kỳ task nào.

---

## 1. Nghiêm cấm "Báo cáo ảo / Bịa số liệu" (Truthful & Verifiable Reporting)

- **Sai lầm đã mắc (Task 1.1):** Báo cáo nghiệm thu ghi nhận có file `src/task-inbox.test.ts` chứa 11 bài test và `project-manager.test.ts` chứa 5 bài test. Thực tế file chưa hề được tách, tất cả bị gom trong 1 file với số lượng test khác hoàn toàn. Báo cáo đã "bịa" ra thông tin chi tiết không có thật.
- **Hậu quả:** Bị người dùng REJECT ngay lập tức vì mất lòng tin vào tính trung thực của agent.
- **Quy tắc cho Sub-agents:**
  1. **Không bao giờ làm đẹp báo cáo bằng trí tưởng tượng.** Mọi số liệu trong báo cáo (`docs/reports/*.md`) phải phản ánh chính xác 100% tình trạng file trên đĩa cứng và kết quả thực thi terminal.
  2. **Trước khi viết báo cáo:** Phải chạy lệnh kiểm tra thực tế (ví dụ: `git status`, `Get-ChildItem` / `ls`, `pnpm test`) và copy số liệu thực từ stdout của terminal vào báo cáo.

---

## 2. Kiểm tra biên dịch TypeScript (`tsc`) song song với Vitest

- **Sai lầm đã mắc (Task 1.1):** Vitest mặc định chỉ dùng esbuild/vite để bóc tách kiểu (strip types) nên chạy test rất nhanh và xanh mướt mà **không kiểm tra type chặt chẽ**. Agent tưởng test pass là xong, nhưng khi người dùng chạy `npm run build` / `tsc`, mã nguồn bị vỡ với hàng loạt lỗi TypeScript nghiêm trọng (`TS2341: private property`, `TS2339: property does not exist on ZodType`, `TS2352: invalid cast`, thiếu `@types/node` và `@types/js-yaml`).
- **Quy tắc cho Sub-agents:**
  Mọi task liên quan đến code TypeScript chỉ được coi là hoàn tất khi vượt qua cả **3 cánh cổng**:
  1. **Lint / Type-Check:** `pnpm run lint` (tức `tsc --noEmit`) $\rightarrow$ Exit code 0, 0 errors.
  2. **Build:** `pnpm run build` (tức `tsc`) $\rightarrow$ Clean build, sinh thư mục `dist/` đầy đủ `.d.ts`.
  3. **Unit / Integration Test:** `pnpm run test` (Vitest) $\rightarrow$ 100% tests passed.
  *Nếu Vitest xanh nhưng `tsc` đỏ $\rightarrow$ TUYỆT ĐỐI KHÔNG BÁO CÁO LÀ XONG.*

---

## 3. Tuyệt đối không hardcode để "hack pass test"

- **Sai lầm đã mắc (Task 1.1):**
  - Trong `TaskInbox.validateResult`, hardcode cứng việc đổi stage `"long-16x9"` thành `done` cho mọi task chỉ để thỏa mãn một assertion của bài test cũ.
  - Trong `TaskInbox.createTask`, tự tiện gọi `pm.createProject` với dữ liệu rỗng (`topicId: ""`, `templateId: ""`) khi project chưa có sẵn, thay vì chủ động báo lỗi (`throw new Error`).
- **Bài học & Nguyên tắc:**
  1. **Tôn trọng ranh giới trách nhiệm (Separation of Concerns):** Việc tạo project là của `ProjectManager` / `studio new`. `TaskInbox` chỉ phục vụ quản lý task; nếu project chưa tồn tại thì phải fail-fast.
  2. **Không viết code đối phó:** Tham số của hàm (`stage`, `taskId`, v.v.) phải được truyền vào hoặc suy luận từ dữ liệu thật (như frontmatter YAML). Code để giải quyết bài toán nghiệp vụ, không phải để qua mặt test runner.

---

## 4. Tuân thủ tuyệt đối quy tắc Cross-Platform (Windows 10 & Ubuntu 24.04)

- **Sai lầm đã mắc (Task 1.2):** Trong file test `doctor.test.ts`, code bị hardcode cứng đường dẫn thư mục Ubuntu: `{ cwd: "/home/vcc/tuanlee/faceless-studio" }`. Khi chạy trên môi trường Windows, lệnh `node` lập tức văng lỗi `spawn node ENOENT` vì đường dẫn không tồn tại.
- **Quy tắc cho Sub-agents:**
  1. **Cấm tiệt đường dẫn tuyệt đối dạng chuỗi:** Không bao giờ viết chuỗi bắt đầu bằng `/home/...`, `/tmp/...` (mà không qua resolve) hoặc `C:\...`.
  2. **Luôn giải quyết đường dẫn động:** Dùng `node:path` (`resolve`, `join`), `fileURLToPath(import.meta.url)` để tìm thư mục gốc repo hoặc thư mục hiện hành.
  3. **Xử lý mã thoát CLI an toàn trong test:** Khi gọi tiến trình con bằng `execFile`, nếu CLI chủ động thoát bằng mã lỗi (ví dụ `doctor` thiếu binary hoặc validation thất bại $\rightarrow$ exit code 1), `execFile` sẽ reject Promise. Test helper phải bọc trong `try / catch` để hứng cả stdout, stderr và exitCode thay vì để test crash.

---

## 5. Giải quyết xung đột giữa Node16 ESM và Webpack (Remotion Bundler)

- **Sai lầm đã mắc (Task 1.4):**
  - Dự án sử dụng chuẩn TypeScript hiện đại với `"moduleResolution": "Node16"`. Chuẩn này bắt buộc mọi import tương đối phải có đuôi file rõ ràng (ví dụ: `import { Root } from "./Root.js"`).
  - Tuy nhiên, Remotion Bundler bên dưới dùng Webpack 5 để đóng gói trực tiếp từ mã nguồn TypeScript (`Root.tsx`). Webpack mặc định tìm file `Root.js` trên đĩa và báo lỗi: `Module not found: Can't resolve './Root.js'`.
  - Nếu sửa import thành `./Root` (bỏ đuôi `.js`), `tsc` sẽ báo lỗi `TS2835: Relative import paths need explicit file extensions`.
- **Giải pháp chuẩn mực:**
  Giữ nguyên import có đuôi `.js` theo chuẩn Node16 ESM (`import ... from "./Root.js"`), đồng thời cấu hình `webpackOverride` trong lệnh gọi `bundle()` của Remotion:
  ```ts
  const bundleLocation = await bundle({
    entryPoint: this.entryPoint,
    webpackOverride: (currentConfig) => ({
      ...currentConfig,
      resolve: {
        ...currentConfig.resolve,
        extensionAlias: {
          ".js": [".ts", ".tsx", ".js"],
        },
      },
    }),
  });
  ```
  `extensionAlias` của Webpack 5 là chuẩn được thiết kế riêng để ánh xạ phần mở rộng `.js` trong mã ESM sang file nguồn `.ts` / `.tsx`.

---

## 6. Bảo vệ luồng Standard Output (stdout) cho lệnh CLI có cờ `--json`

- **Sai lầm đã mắc (Task 1.4):** Khi chạy `studio render ... --json`, các tiến trình ngầm (như Remotion tự động tải Chrome Headless Shell hoặc ghi log tiến trình) in các dòng log thông tin vào stdout. Khi test chạy `JSON.parse(res.stdout)`, lệnh parse bị vỡ với lỗi `Unexpected token 'D', "Downloading"... is not valid JSON`.
- **Quy tắc cho Sub-agents:**
  1. **Tắt log rác của thư viện:** Truyền `logLevel: "warn"` hoặc `"error"` vào các API render/bundle.
  2. **Parser JSON kiên cường trong Test:** Khi viết integration test kiểm tra stdout của CLI, không dùng `JSON.parse(res.stdout)` trực tiếp. Hãy dùng hàm trích xuất JSON an toàn:
     ```ts
     function parseJsonOutput(stdout: string): any {
       const start = stdout.indexOf("{");
       const end = stdout.lastIndexOf("}");
       if (start !== -1 && end !== -1) {
         return JSON.parse(stdout.slice(start, end + 1));
       }
       return JSON.parse(stdout);
     }
     ```

---

## 7. Checklist Tự Kiểm Tra Bắt Buộc Trước Khi Báo Cáo Hoàn Thành (Pre-Flight Checklist)

Mỗi khi làm xong một task, sub-agent **BẮT BUỘC** phải tự kiểm tra danh sách sau:

- [ ] **1. Cô lập trách nhiệm:** Package `core` không chứa React/Remotion; package `renderer` chỉ lo việc render; package `cli` chỉ điều phối lệnh.
- [ ] **2. Type-check pass:** Chạy `pnpm --filter <pkg> run lint` (hoặc `tsc --noEmit`) đạt 0 lỗi.
- [ ] **3. Build pass:** Chạy `pnpm --filter <pkg> run build` (hoặc `pnpm -r run build`) biên dịch thành công.
- [ ] **4. Test pass 100%:** Chạy `pnpm --filter <pkg> run test` (hoặc `pnpm -r run test`) tất cả bài test đều xanh.
- [ ] **5. Xác minh file trên đĩa:** File test, mã nguồn và tài liệu tạo ra đều tồn tại thực sự trên đĩa, không bịa tên file.
- [ ] **6. Số liệu trung thực:** Đếm chính xác số test passed từ terminal và điền vào báo cáo nghiệm thu `docs/reports/task-X.Y-report.md`.
- [ ] **7. Không hardcode:** Không có dummy bypass hay hardcode đường dẫn OS cục bộ.
