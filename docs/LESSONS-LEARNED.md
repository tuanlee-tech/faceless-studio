# Đúc kết kinh nghiệm & Quy tắc phòng ngừa sai lầm (Lessons Learned)

> **Mục đích:** Tài liệu này đúc kết toàn bộ bài học xương máu từ các sai lầm, sự cố bị REJECT và cách khắc phục trong quá trình phát triển Phase 1 của dự án **Faceless Studio**.  
> **Đối tượng áp dụng:** Agent hiện tại và toàn bộ các sub-agents tiếp nối trong Phase 2, 3, 4. Bắt buộc phải đọc và tuân thủ trước khi triển khai bất kỳ task nào.

---

## Dành cho Agents: Cách ghi nhận bài học
- **Khi nào ghi:** BẤT CỨ KHI NÀO bạn làm sai, bị user hoặc agent khác review và chỉ ra lỗi, hoặc bạn mất nhiều thời gian fix một bug khó, hãy bổ sung một mục mới vào tài liệu này.
- **Cách ghi:** 
  - Tạo một Header `##` mới mang tên bài học (đánh số nối tiếp).
  - Viết ngắn gọn "Sai lầm đã mắc" và "Bài học & Quy tắc rút ra".
  - Bổ sung nguyên tắc kiểm tra vào **Checklist Tự Kiểm Tra** ở cuối file này.
  - Mục đích là để các agent (hoặc sub-agent) đi sau đọc được, học tập từ sai lầm của bạn và thực thi tốt hơn.

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

## 7. Cô lập tuyệt đối môi trường Trình duyệt khỏi Node Core Modules (`node:fs`) trong Remotion

- **Sai lầm đã mắc (Task 2.1 / 2.2):** 
  - Trong component `MainVideo.tsx` (được Webpack đóng gói để chạy trong môi trường Chromium), khi import biến runtime `BUILTIN_TEMPLATES` từ `@faceless/core`, Webpack phân giải file barrel `index.ts`. File này xuất các class phía server như `ProjectManager`, `TaskInbox`, `TemplateManager` vốn sử dụng `node:fs`.
  - Kết quả: Webpack 5 crash với lỗi `UnhandledSchemeError: Reading from "node:fs" is not handled by plugins (Unhandled scheme)`.
- **Quy tắc cho Sub-agents:**
  1. **Trong React/Remotion components:** Chỉ sử dụng **`import type`** từ `@faceless/core` (ví dụ `import type { VideoSpec, TemplateConfig } from "@faceless/core"`). `import type` bị TypeScript xóa sạch lúc biên dịch nên Webpack không bao giờ thấy mã nguồn phía server.
  2. **Chia tách trách nhiệm Node vs Browser:** Mọi thao tác đọc file đĩa (`readFileSync`) và nạp font phải được thực hiện ở `adapter.ts` (Node context), sau đó chuyển giao dữ liệu (ví dụ CSS `@font-face` base64 hoặc `templateConfig`) vào component thông qua `inputProps`.

---

## 8. Đồng bộ kiểu TypeScript giữa Zod Inferred Types và Test Fixtures

- **Sai lầm đã mắc (Task 2.4):**
  - Khi schema Zod định nghĩa các trường có `.default(...)` (như `offsetSec`, `volume`, `source`), hàm suy luận `z.infer<...>` xác định kiểu đầu ra có các thuộc tính này là **bắt buộc (required)**.
  - Khi viết test fixture gán trực tiếp kiểu `const spec: VideoSpec = { ... }` mà bỏ qua các trường có default, Vitest vẫn chạy qua (do strip types), nhưng `tsc` lập tức chặn lại với lỗi `TS2741: Property is missing`.
- **Quy tắc cho Sub-agents:**
  1. Khi viết test fixtures, hoặc là điền đầy đủ các trường có `.default()`, hoặc dùng `Schema.parse(...)` để Zod tự động bổ sung default values trước khi truyền vào hàm.
  2. Luôn chạy `pnpm run lint` (`tsc --noEmit`) ngay sau khi viết test mới để bắt các lỗi thiếu thuộc tính kiểu dữ liệu.

---

## 9. Phân tích Thông số Âm thanh FFmpeg bằng JSON Thay vì Regex Text Log

- **Sai lầm đã mắc (Task 3.3):** 
  - Khi đo loudness bằng `ebur128`, code cũ cố gắng dùng regex để bóc tách chuỗi `"I: -14.0 LUFS"` từ `stderr` khi truyền `-v error`. Tuy nhiên, `-v error` tắt toàn bộ log mức `info` khiến ffmpeg không in bảng tổng kết `[Parsed_ebur128_0] Summary:`, dẫn đến lỗi `ebur128 output not found`.
  - Nếu bỏ `-v error`, chuỗi log văn bản thay đổi tùy theo bản build và phiên bản ffmpeg (ví dụ Windows gyan.dev vs Linux distro).
- **Quy tắc cho Sub-agents:**
  1. Khi cần thông số âm học từ ffmpeg, luôn sử dụng bộ lọc `loudnorm` với tham số `print_format=json`.
  2. ffmpeg sẽ in ra một khối JSON hoàn chỉnh vào `stderr`. Trích xuất khối JSON an toàn bằng `stderr.slice(stderr.indexOf("{"), stderr.lastIndexOf("}") + 1)` và parse bằng `JSON.parse()`. Phương pháp này đạt độ tin cậy 100% trên mọi nền tảng.

---

## 10. Kỹ thuật Stream-Copy (`-c:v copy`) trong Xử lý Hậu kỳ Muxing

- **Kinh nghiệm thực tiễn (Task 3.3):**
  - Sau khi Remotion render xong video MP4, nếu re-encode lại toàn bộ video chỉ để thay đổi luồng âm thanh sẽ tốn gấp đôi thời gian render và làm suy giảm chất lượng hình ảnh (generational loss).
- **Quy tắc cho Sub-agents:**
  1. Luôn sử dụng cờ **`-c:v copy`** khi mux lại âm thanh đã chuẩn hóa vào video:
     `ffmpeg -y -i input.mp4 -i norm_audio.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest output.mp4`
  2. Video stream được sao chép nguyên trạng ở cấp độ packet bitstream (tốc độ xử lý chỉ mất < 500ms cho video ngắn), giữ nguyên 100% chất lượng hình ảnh sắc nét từ Remotion.

---

## 11. Dependency Inversion trong Package Core để Tránh Cyclic Dependency

- **Kinh nghiệm kiến trúc (Task 3.4):**
  - Package `@faceless/core` nằm ở đáy của cây phụ thuộc. `@faceless/media` và `@faceless/cli` phụ thuộc vào `core`.
  - Khi xây dựng `QAManager` tại `core` để kiểm tra độ lớn âm thanh (LUFS) của file video MP4 sau render, nếu `core` import trực tiếp `LoudnessProcessor` từ `media`, dự án sẽ bị lỗi phụ thuộc vòng (Cyclic Dependency: `core` $\leftrightarrow$ `media`).
- **Quy tắc cho Sub-agents:**
  1. Áp dụng nguyên lý **Dependency Inversion (IoC)**: Định nghĩa interface trừu tượng `QAMediaInspector` tại `core`:
     ```ts
     export interface QAMediaInspector {
       probeDuration(filePath: string): Promise<number>;
       measureLoudness(filePath: string): Promise<{ input_i: number; input_tp: number }>;
     }
     ```
  2. Caller ở tầng trên (`@faceless/cli`) sẽ inject implementation cụ thể (`getDuration`, `measureLoudness` từ `@faceless/media`) khi thực thi. Trong unit test của `core`, có thể inject mock inspector mà không cần gọi native binary.

---

## 13. Đồng bộ Trạng thái Stage Status Enum trong Thin Client Server

- **Sai lầm đã mắc (Task 4.1):** 
  - Khi thiết kế route `POST /projects/:slug/run`, server ban đầu cập nhật trạng thái stage là `"in_progress"`.
  - Tuy nhiên, `StageStatusSchema` trong `@faceless/core` định nghĩa enum chuẩn gồm `["pending", "running", "done", "failed", "skipped"]`. Khi server gọi `pm.updateStage`, Zod ném lỗi `invalid_enum_value`.
- **Bài học & Quy tắc:**
  1. Kiểm tra kỹ enum definition trong schema Zod của `core` trước khi cập nhật state. Luôn dùng đúng giá trị enum chuẩn (`"running"` thay vì `"in_progress"`).
  2. Khi validation thất bại (`ti.validateResult`), ghi nhận status `"failed"` kèm error detail, không để ứng dụng rơi vào trạng thái không xác định.
  3. Tái sử dụng 100% Zod parsing (`ProjectConfigSchema.parse`) để tận dụng default values và kiểm tra hợp lệ ngay tại REST endpoint.

---

## 14. Phân tách Môi trường Kiểm thử (Node vs Jsdom) khi Tích hợp Web & Bundler

- **Sai lầm đã mắc (Task 4.2):**
  - Khi cấu hình Vitest trong `apps/web`, thiết lập mặc định `environment: "jsdom"`.
  - Khi test file import `createApp` từ `@faceless/server` (vốn nạp `@remotion/bundler` và `esbuild`), `esbuild` kiểm tra điều kiện bất biến: `new TextEncoder().encode("") instanceof Uint8Array`.
  - Do `jsdom` chạy trên một realm/sandbox VM riêng, prototype của `Uint8Array` bị lệch khỏi global Node, khiến `esbuild` văng lỗi: `Invariant violation: "new TextEncoder().encode("") instanceof Uint8Array" is incorrectly false`.
- **Bài học & Quy tắc:**
  1. Các bài kiểm thử tích hợp API client (gọi in-memory backend Hono hoặc thao tác file hệ thống) bắt buộc phải cấu hình `environment: "node"`.
  2. Không lạm dụng `jsdom` cho toàn bộ test suite trừ khi bài test thực sự render DOM component với React Testing Library.
  3. Trong `tsconfig.json` của Vite frontend, luôn khai báo `"types": ["vite/client"]` để `tsc --noEmit` nhận diện chính xác `import.meta.env`.

---

## 15. Quản lý Lỗi Nghiệp vụ và HTTP Status Code trong Client-Server Protocol

- **Sai lầm đã mắc (Task 4.3):**
  - Ban đầu hàm helper `request()` trong `apps/web/src/api/client.ts` tự động ném ngoại lệ khi `data.success === false`.
  - Tuy nhiên trong nghiệp vụ thẩm định (`studio validate`), khi kịch bản vi phạm schema Zod, backend trả về HTTP 200 `{ success: false, results: [...] }` để client bóc tách chi tiết từng task bị lỗi.
  - Việc `request()` tự ý throw khiến UI bị crash hoặc không bắt được danh sách lỗi chi tiết để hiển thị lên popup / form error cho người dùng sửa.
- **Bài học & Quy tắc:**
  1. Phân biệt rạch ròi giữa lỗi tầng HTTP transport (`!response.ok` $\implies$ ném Error) và kết quả thẩm định thất bại của domain (`data.success === false` với status 200 $\implies$ trả về data đầy đủ để UI hiển thị phản hồi/gợi ý sửa đổi).
  2. Các hàm thẩm định trên UI luôn trả về payload kết quả chứa mảng `results: [{ taskId, stage, status, error }]` để render UI thân thiện.

---

## 16. Đồng bộ Bản dựng Server (Build Out-of-date) trong Monorepo khi Test Phụ thuộc

- **Sai lầm đã mắc (Task 4.4):**
  - Khi bổ sung endpoint mới vào `apps/server/src/app.ts`, `apps/web/src/__tests__/web.test.ts` import `createApp` từ `@faceless/server/app` (vốn trỏ tới `./dist/app.js` trong `package.json`).
  - Nếu quên chạy lệnh build trên `@faceless/server`, test của web sẽ chạy trên file build cũ và báo lỗi `404 Route Not Found`.
- **Bài học & Quy tắc:**
  1. Trong monorepo TypeScript, khi một package import `dist` của package khác qua workspace, luôn chạy `pnpm --filter <dep> run build` ngay sau khi cập nhật mã nguồn dependency trước khi chạy test tầng trên.
  2. Luôn duy trì quy trình 3 cổng kiểm tra đồng thời trên toàn bộ monorepo: `pnpm -r run lint`, `pnpm -r run build`, `pnpm -r run test`.

---

## 12. Checklist Tự Kiểm Tra Bắt Buộc Trước Khi Báo Cáo Hoàn Thành (Pre-Flight Checklist)

Mỗi khi làm xong một task, sub-agent **BẮT BUỘC** phải tự kiểm tra danh sách sau:

- [ ] **1. Cô lập trách nhiệm:** Package `core` không chứa React/Remotion/native binaries; package `renderer` chỉ lo việc render; package `media` xử lý ffmpeg/audio; package `cli` chỉ điều phối lệnh; `apps/server` đóng vai trò API thin layer tái sử dụng 100% logic cốt lõi.
- [ ] **2. Type-check pass:** Chạy `pnpm --filter <pkg> run lint` (hoặc `tsc --noEmit`) đạt 0 lỗi.
- [ ] **3. Build pass:** Chạy `pnpm --filter <pkg> run build` (hoặc `pnpm -r run build`) biên dịch thành công.
- [ ] **4. Test pass 100%:** Chạy `pnpm --filter <pkg> run test` (hoặc `pnpm -r run test`) tất cả bài test đều xanh.
- [ ] **5. Xác minh file trên đĩa:** File test, mã nguồn và tài liệu tạo ra đều tồn tại thực sự trên đĩa, không bịa tên file.
- [ ] **6. Số liệu trung thực:** Đếm chính xác số test passed từ terminal và điền vào báo cáo nghiệm thu `docs/reports/task-X.Y-report.md`.
- [ ] **7. Không hardcode:** Không có dummy bypass hay hardcode đường dẫn OS cục bộ.

