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

## 17. Thiết kế Thao tác Xóa Dữ liệu An toàn (Destructive Operation Safety & Anti-Path Traversal)

- **Nguyên tắc an toàn khi xóa dự án:**
  - Xóa dự án là thao tác hủy diệt (destructive) không thể hoàn tác trên hệ thống tệp. Nếu không kiểm soát chặt, kẻ tấn công hoặc lỗi cấu hình có thể gây xóa nhầm dữ liệu ngoài ý muốn hoặc tấn công Directory Traversal (`../../`).
- **Quy tắc cho Sub-agents:**
  1. **Chống Path Traversal ở tầng Core:**
     - Validate định dạng slug nghiêm ngặt (`/^[a-zA-Z0-9_-]+$/`).
     - Luôn kiểm tra `projectDir.startsWith(resolve(this.baseDir))` trước khi gọi `rmSync`.
  2. **Fail-Fast & Đúng HTTP Status:**
     - Nếu slug không hợp lệ $\rightarrow$ throw error / HTTP 400.
     - Nếu dự án không tồn tại $\rightarrow$ throw error `Project not found` / HTTP 404.
  3. **Bảo vệ dữ liệu & Trải nghiệm UI:**
     - Không bao giờ thực thi xóa ngay lập tức khi người dùng click một chạm. Luôn hiển thị Dialog/Modal xác nhận rõ ràng với tên slug cần xóa và cảnh báo rủi ro.
     - Trên thẻ `ProjectCard`, gọi `e.stopPropagation()` khi bấm nút xóa để không kích hoạt sự kiện click mở trang chi tiết.
     - Sau khi xóa thành công, tự động làm sạch `selectedSlug` nếu đang ở trang chi tiết của dự án đó và refresh danh sách dashboard.

---

## 18. Tính toàn vẹn của Dữ liệu Âm thanh Giả lập (Mock Audio Integrity & FFprobe Validation)

- **Sai lầm đã mắc:**
  - Trong `packages/cli/src/commands/run.ts`, stage `tts` trước đây ghi chuỗi text thô `"RIFF mock wav audio data"` thành file `audio/narration.wav`.
  - Khi Remotion tiến hành render video, `ffprobe` (tích hợp trong bundle Remotion compositor) kiểm tra cấu trúc stream âm thanh và lập tức crash với lỗi: `Invalid data found when processing input`.
- **Bài học & Quy tắc:**
  1. Khi tạo file nhị phân giả lập (audio WAV, image PNG) trong CLI hoặc Server, **tuyệt đối không dùng plain-text string**.
  2. Phải luôn sử dụng header nhị phân hợp lệ tối thiểu (ví dụ chuỗi Base64 của 44-byte PCM WAV header: `UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=`), hoặc gọi lệnh `ffmpeg` sinh file audio thực thụ trước khi đưa vào pipeline render.
  3. Trong `qa-manager.ts`, danh sách đường dẫn tìm kiếm video hậu kỳ (`candidates`) cần bao gồm cả thư mục `out/long-16x9/<slug>.mp4` lẫn `dist/` để hỗ trợ tự động nhận diện kết quả render của cả CLI và Web UI mà không cần cờ thủ công.

---

## 19. Trải nghiệm Tự động hóa Pipeline & Sáng tạo Asset AI trong Web Studio (Pipeline Auto-Advancement & AI Asset Synergy)

- **Sai lầm đã mắc:**
  1. Form Editor kết quả trước đây luôn nạp `SAMPLE_TEMPLATES` đè lên `resultJson` mỗi lần `loadData()`, khiến người dùng tưởng hệ thống chưa lưu hoặc hiển thị sai placeholder mẫu sau khi đã báo "Done".
  2. Không tự động chuyển tiếp stage sau khi thẩm định thành công, khiến người dùng phải tự tìm nút khởi chạy stage tiếp theo.
  3. Bắt người dùng phải tự nhập cấu trúc JSON phức tạp bằng tay thay vì cho phép viết ý tưởng tự nhiên dạng chat prompt.
  4. Storyboard chưa hỗ trợ tạo ảnh AI tự động (khiến video thiếu asset minh họa) và chưa hiển thị chi tiết prompt đạo diễn cho những ai muốn tự tạo thủ công trên Midjourney / DALL-E.
- **Bài học & Quy tắc giải quyết:**
  1. **Nạp kết quả thực tế:** Endpoint `GET /projects/:slug/tasks/:taskId/result` luôn được ưu tiên gọi đầu tiên để hiển thị đúng nội dung đã lưu từ đĩa (`results/<taskId>.json`). Chỉ hiển thị sample khi task hoàn toàn mới.
  2. **Tự động chuyển tiếp Stage (Auto Next Stage):** Khi thẩm định thành công (`PASSED`), UI tự động xác định stage tiếp theo trong chuỗi `outline` $\rightarrow$ `script` $\rightarrow$ `direct` $\rightarrow$ `spec`, kích hoạt `api.runStage(slug, nextStage)`, load task mới và hiển thị thông báo chuyển tiếp mượt mà.
  3. **Chat Prompt Assistant:** Tích hợp bộ trợ lý AI trên đầu editor; người dùng chỉ cần nhập văn bản ý tưởng tự nhiên hoặc click chip gợi ý, Agent sẽ gọi backend để tự động suy luận ra JSON chuẩn Zod để người dùng duyệt trước khi lưu.
  4. **Song hành 2 chế độ Asset (AI & Thủ công):**
     - **AI Assets:** Nút 1-click sinh toàn bộ ảnh hoặc sinh từng beat qua Gemini Imagen API (nếu có `GEMINI_API_KEY`) hoặc Creative Synth cục bộ (Python Pillow/FFmpeg).
     - **Tự tạo thủ công:** Hiển thị thẻ Prompt Chi Tiết (Chủ đề, Ánh sáng Baroque Chiaroscuro, Ống kính 35mm anamorphic, Bố cục `--ar 16:9`/`9:16`, Negative prompt) kèm nút 1-click Copy và ô dropzone upload riêng cho từng beat.

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


---

## 20. Trải nghiệm UX với các State đặc thù không có trong Task Inbox (UI-driven Stages)

- **Sai lầm đã mắc:**
  - Stage `tts` là một stage không chạy ngầm mà yêu cầu tương tác UI (chèn thẻ cảm xúc). Khi thiết kế UI, do dựa vào `nextPendingStage === "tts"` để hiển thị, nếu user đã hoàn thành stage này (`status: "done"`) thì sẽ không còn cách nào mở lại giao diện TTS để sửa.
- **Bài học & Quy tắc giải quyết:**
  1. Với các Stage không có task tĩnh (như `tts`), phải chủ động tiêm (inject) mock task vào danh sách Task Inbox trong React State để user có thể click chọn lại bất cứ lúc nào.
  2. Dùng điều kiện hiển thị UI phụ thuộc vào `activeTask.stage` (task đang chọn) thay vì trạng thái pending của dự án. Điều này đảm bảo trải nghiệm thống nhất với các task tĩnh.
  3. Khi một UI-driven stage hoàn tất (như click "Tạo Audio"), phải tự động chạy stage tiếp theo ngầm (`spec`) và báo hiệu rõ ràng cho user.

---

## 21. Tránh Dùng Emoji Thô trong Giao diện Web (Cross-Platform Emoji Rendering & Icon Standardization)

- **Sai lầm đã mắc:**
  - Dùng trực tiếp các ký tự Unicode Emoji mới như `🪄` (U+1FA84 - Magic Wand) hoặc `💡` trong JSX (`<span>🪄</span>`).
  - Trên Windows 10/11 hoặc các môi trường font hệ thống thiếu bảng ký tự emoji mở rộng, các emoji này bị render thành ô vuông rỗng `[?]` hoặc icon biến dạng gây mất thẩm mỹ giao diện.
- **Bài học & Quy tắc giải quyết:**
  1. Tuyệt đối không dùng emoji thô trong mã JSX giao diện cho các biểu tượng chức năng hoặc nút bấm.
  2. Luôn chuẩn hóa và sử dụng thư viện vector icon thống nhất (`lucide-react`) như `<Wand2 />`, `<Lightbulb />`, `<Sparkles />`, v.v.
  3. Trong chuỗi văn bản thông báo Toast hoặc alert, ưu tiên dùng text tiếng Việt rõ nghĩa và icon vector đi kèm thay cho chuỗi emoji.

---

## 22. Tự Động Đồng Bộ Chế Độ Nghe Thử & Điều Hướng Voice Routing (Interactive TTS Preview Sync & Engine Mapping)

- **Sai lầm đã mắc:**
  - Trong `TTSGenerator.tsx`, khi người dùng đổi "Giọng đọc (Voice ID)", component chỉ cập nhật state `voiceId` mà không tự động phát sinh audio nghe thử mới. Người dùng click nghe lại vẫn phát ra file âm thanh của giọng cũ.
  - Tầng server `tts-helper.ts` khi `model: "auto"` có API Key lại gửi toàn bộ voice sang Gemini API, khiến các giọng VieNeu ("Thiện Minh", "Hải Đăng"...) bị lỗi 400 và rớt xuống fallback Google Translate (giọng robot đơn điệu không đổi).
- **Bài học & Quy tắc giải quyết:**
  1. **Voice-Engine Smart Routing:** Ở backend, định nghĩa danh sách giọng cho từng engine (`GEMINI_VOICES = ["Kore", "Puck", ...]`, các giọng còn lại thuộc `VIENEU_VOICES`). Khi `model === "auto"`, tự động định tuyến giọng Gemini sang Gemini TTS và giọng VieNeu sang VieNeu-TTS local server (port 8000).
  2. **Quyền phát âm thanh thuộc về người dùng (User-Initiated Preview):**
     - Tuyệt đối không tự ý phát âm thanh khi mở phòng nghe thử hoặc khi người dùng thay đổi lựa chọn Voice ID / Model.
     - Khi mở phòng nghe thử hoặc đổi giọng đọc, chỉ cập nhật trạng thái UI và hiển thị nút hành động "Nghe thử giọng [Voice ID]".
     - Chỉ khi người dùng chủ động click nút "Nghe thử" / "Phát âm thanh" thì hệ thống mới kích hoạt phát audio.
     - Thiết kế UI Phòng Nghe Thử thành một Studio độc lập, thoáng đãng với câu mẫu gợi ý, bộ đếm ký tự và thanh nghe nhạc riêng biệt thay vì chia đôi màn hình gây chật hẹp kịch bản chính.

---

## 23. Chuẩn Hóa Voice ID & Tránh Hallucinate Nhãn Giọng Đọc (Canonical Voice ID Presets vs. Fictional Aliases)

- **Sai lầm đã mắc:**
  - Frontend tự đặt các nhãn hiển thị giả định ("Nhật Phong", "Hoàng Nam", "Huyền My", "Kim Chi") và gán vào các ID thật của VieNeu (`Thiện Minh`, `Minh Đức`, `Ngọc Huyền`, `Trúc Ly`), khiến người dùng chọn một đằng nhưng hệ thống chạy một nẻo, gây sai lệch trải nghiệm.
  - Tầng server gửi `voice: "default"` xuống VieNeu OpenAI API (`http://127.0.0.1:8000/v1/audio/speech`), dẫn đến lỗi `400 Bad Request: unknown voice 'default'` do VieNeu chỉ nhận danh sách ID giọng chính xác trong file `voices_v3_turbo.json`.
- **Bài học & Quy tắc giải quyết:**
  1. **Canonical Voice Mapping:** 100% Voice ID và nhãn hiển thị trong UI phải lấy trực tiếp từ nguồn chuẩn của VieNeu (`apps/vieneu-tts/src/vieneu/assets/voices_v3_turbo.json` và API `GET /v1/voices`). Tuyệt đối không tự bịa tên hay alias hiển thị.
  2. **Giọng mặc định chuẩn (Hải Đăng):** VieNeu v3 turbo quy định `default_voice: "Hải Đăng"`. Cần đặt `Hải Đăng` làm giọng mặc định thay vì các giọng khác.
  3. **Backend Fallback Normalization:** Tại `tts-helper.ts`, luôn chuẩn hóa:
     ```ts
     if (!voiceId || voiceId === "default") {
       voiceId = "Hải Đăng";
     }
     ```
     để dù client gửi `"default"` hay bỏ trống thì request tới VieNeu API vẫn luôn thành công (200 OK).
  4. **Cung cấp API `/tts/voices`:** Server backend cung cấp endpoint `GET /tts/voices` để UI và client có thể lấy danh sách giọng động kèm mô tả vùng miền (Bắc/Trung/Nam) và phong cách đọc.


---

## 24. Tách Bạch AI Agent Sáng Tạo (Text/Emotion Directing) & Chuyển Đổi Tag Động Giữa Các TTS Engine

- **Sai lầm đã mắc:**
  - Hiểu nhầm nút "AI viết lại lời (Chèn cảm xúc)" là gọi trực tiếp tới server tổng hợp âm thanh (TTS synthesis). Thực chất, đây là công đoạn sáng tạo văn bản của **AI Agent Kịch Bản/Diễn Xuất (Voiceover Director)**, hoàn toàn tương tự như các stage Agent tự động suy ra JSON (`outline`, `script`, `direct`).
  - Để lộ việc trộn lẫn thẻ cảm xúc: VieNeu Local chỉ hỗ trợ 3 thẻ tiếng Việt (`[cười]`, `[thở dài]`, `[hắng giọng]`), trong khi Gemini TTS dùng cú pháp thẻ tiếng Anh (`[enthusiasm]`, `<laugh>`, `<sigh>`, `<breath>`). Nếu gửi tag của Gemini sang VieNeu, VieNeu sẽ đọc to cả cụm chữ tiếng Anh hoặc bỏ qua sai lệch.
- **Bài học & Quy tắc giải quyết:**
  1. **Tách biệt Text Director và Audio Synthesis:**
     - Nút "Agent Sáng Tạo: Chèn Tag Cảm Xúc Bằng AI" chỉ gửi prompt tới AI Agent để tối ưu lời thoại và chèn thẻ cảm xúc phù hợp ngữ cảnh, KHÔNG tổng hợp file âm thanh tại bước này.
  2. **Ràng buộc cú pháp nghiêm ngặt theo từng Engine:**
     - Nếu user đang chọn giọng VieNeu: Prompt chỉ định AI tuyệt đối chỉ được dùng 3 thẻ `[cười]`, `[thở dài]`, `[hắng giọng]`.
     - Nếu user chọn giọng Gemini: Prompt chỉ định dùng thẻ `[enthusiasm]`, `[sadness]`, `<laugh>`, `<sigh>`, `<breath>`.
  3. **Lắng nghe sự kiện chuyển giọng (On-the-fly Tag Migration):**
     - Khi user chuyển `voiceId` hoặc `model` giữa VieNeu và Gemini, component tự động phát hiện đổi engine (`prevEngine !== nextEngine`) và chạy hàm chuyển đổi tag hai chiều (`convertEmotionTags`) trên cả văn bản kịch bản chính và văn bản phòng nghe thử, đồng thời hiển thị thông báo hỗ trợ cho người dùng.

---

## 25. Quản Lý Gemini Model Lifecycle, DNS IPv4 First & Cơ Chế Dự Phòng Fail-Safe

- **Sai lầm đã mắc:**
  - Hardcode endpoint `gemini-1.5-flash` trong code backend khiến server nhận lỗi `404 Not Found` do Google đã ngừng hỗ trợ model cũ trên API v1beta.
  - Trên hệ điều hành Windows, thư viện fetch (Undici) mặc định phân giải địa chỉ IPv6 trước, dẫn tới lỗi `UND_ERR_CONNECT_TIMEOUT` treo 10 giây khi router hoặc mạng nội bộ không định tuyến IPv6 tới máy chủ Google.
  - Khi API ngoài lỗi hoặc chưa cấu hình API Key, server trả về mã lỗi 500 khiến UI hiển thị banner đỏ và block toàn bộ thao tác của người dùng.
- **Bài học & Quy tắc giải quyết:**
  1. **Cấu hình `dns.setDefaultResultOrder('ipv4first')`:**
     - Luôn gọi thiết lập này tại điểm khởi động server (`apps/server/src/index.ts`) để đảm bảo mọi lệnh `fetch` đi qua IPv4 nhanh chóng, loại bỏ hoàn toàn nguy cơ timeout IPv6 trên Windows.
  2. **Chuỗi mô hình dự phòng (Candidate Fallback Cascade):**
     - Luôn chuẩn bị danh sách mô hình hiện đại có khả năng thay thế nhau: `["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"]` thông qua SDK `@google/genai`.
  3. **Cơ chế Fail-Safe Thông Minh (Smart Rule-Based Enhancer):**
     - Nếu không có API Key hoặc tất cả các model đều gặp sự cố, server không được văng lỗi 500. Thay vào đó, tự động kích hoạt bộ phân tích cấu trúc câu tiếng Việt để chèn các thẻ cảm xúc tự nhiên theo đúng chuẩn engine đang chọn, bảo toàn tính liên tục của trải nghiệm người dùng.


---

## 26. Phân Rã Lời Thoại Thành Từng Chunk Nhỏ Cho TTS, Chuẩn Hóa MP3 & Tránh Chuyển Màn Hình Quá Sớm

- **Sai lầm đã mắc:**
  - Khi người dùng bấm "Tạo Audio (TTS)", hệ thống gọi hàm `onComplete()` ngay lập tức sau khi nhận kết quả thành công, khiến `PipelineInboxView` tự động chuyển `activeTask` sang stage kế tiếp (`spec`). Hậu quả là giao diện phát âm thanh biến mất ngay, người dùng không kịp nghe thử file MP3 vừa tạo hay kiểm tra chất lượng giọng đọc.
  - Gửi toàn bộ khối văn bản dài trong một lượt gọi TTS duy nhất có thể gây nghẽn bộ nhớ, trễ timeout hoặc lỗi ngữ điệu trên các mô hình TTS địa phương (local ONNX).
- **Bài học & Quy tắc giải quyết:**
  1. **Chia nhỏ văn bản thành từng chunk (Sentence/Clause Chunking):**
     - Viết hàm `splitTextIntoChunks` chia kịch bản theo đoạn (`\n`), kết thúc câu (`.!?…`) và các vế câu dài (`,;:`) với giới hạn ~20 từ/chunk.
     - Giữ nguyên các tag cảm xúc đi kèm trong chunk.
     - Thực thi tuần tự/song song từng chunk ngắn (mỗi chunk VieNeu chỉ mất ~35ms) rồi ghép nối PCM buffer theo đúng chuẩn cấu trúc WAV.
  2. **Chuẩn hóa xuất file MP3 qua FFmpeg:**
     - Sử dụng `ffmpeg` để tự động nén `narration.wav` sang `narration.mp3` (192kbps).
     - Lưu trữ cả hai định dạng: `.mp3` để phát mượt mà trên mọi trình duyệt web và người dùng tải về; `.wav` để Remotion dựng video và căn chỉnh word alignment chính xác.
  3. **Quyền kiểm soát xem xét của người dùng (User-Verified Review Before Progression):**
     - Tuyệt đối không gọi `onComplete()` tự động đóng màn hình TTS.
     - Giữ người dùng ở lại giao diện TTS, hiển thị Card Player MP3 hoàn chỉnh với thông số thời lượng, số lượng chunks, giọng đọc, nút Tải file MP3 và nút rõ ràng: "Chấp nhận Audio & Tiếp tục sang Stage SPEC".
  4. **Hiển thị lỗi rõ ràng (Clear Error Alert Box):**
     - Nếu có lỗi trong quá trình tạo audio (400, 500, lỗi kết nối port 8000), hiển thị khung cảnh báo màu đỏ với nội dung lỗi cụ thể, hướng dẫn khắc phục và nút "Thử lại" ngay tại chỗ.


---

## 27. Quản Lý Rate Limit Gemini TTS (429 RESOURCE_EXHAUSTED) & Cơ Chế Phục Hồi 1-Click Sang VieNeu Local

- **Sai lầm đã mắc:**
  - Mô hình Gemini TTS Cloud (`gemini-3.8-flash-tts`) trên gói Google Cloud Free Tier bị giới hạn nghiêm ngặt chỉ **10 yêu cầu/ngày**. Khi vượt quá, Google trả về lỗi `429 RESOURCE_EXHAUSTED` yêu cầu chờ nhiều giờ (`retry in 9h`).
  - Ban đầu, code backend bắt lỗi này và rethrow trực tiếp (`if (model === "gemini") throw err;`), đồng thời nếu rơi vào fallback thì lại truyền Voice ID của Gemini (`Kore`, `Puck`...) vào VieNeu, khiến VieNeu văng lỗi `400: unknown voice 'Kore'` và văng cả khối JSON thô 50 dòng ra giao diện người dùng.
- **Bài học & Quy tắc giải quyết:**
  1. **Tự động Fallback sang VieNeu Local khi Gemini chạm 429 Quota:**
     - Khi `generateGeminiFlashTTS` gặp lỗi `429` / `RESOURCE_EXHAUSTED`, backend không được dừng tiến trình.
     - Tự động bắt lỗi quota, chuẩn hóa Voice ID sang giọng mặc định của VieNeu (`Hải Đăng`) và gọi `generateVieNeuTTS` chạy cục bộ.
     - Trả về kết quả âm thanh thành công (`200 OK`) kèm `warning` thông báo đã tự động chuyển sang VieNeu Local để người dùng nắm rõ.
  2. **Giao diện tự phục hồi 1-Click (Self-Healing Quota Recovery UI):**
     - Ở frontend, phát hiện các chuỗi lỗi chứa `429`, `quota`, `RESOURCE_EXHAUSTED`.
     - Thay thế khung lỗi đỏ đáng sợ bằng **Amber Card thân thiện** giải thích rõ giới hạn 10 lượt/ngày của Gemini.
     - Cung cấp nút bấm phục hồi 1-click: **"👉 Chuyển sang VieNeu (Hải Đăng) & Tạo ngay"** để tự động đổi model, chuyển voice, đồng bộ lại thẻ cảm xúc và kích hoạt tạo audio ngay lập tức.

---

## 28. Xử Lý Tag Cảm Xúc Khi Fallback (Tránh Đọc "Dấu Nhỏ Hơn, Dấu Lớn Hơn") & Đồng Bộ Giao Diện Toàn Diện

- **Sai lầm đã mắc:**
  - Khi hệ thống tự động fallback từ Gemini sang VieNeu Local (do lỗi 429 Quota Exceeded), kịch bản gốc vẫn còn chứa các thẻ cảm xúc của Gemini dạng XML/HTML (`<sigh>`, `<laugh>`, `<breath>`).
  - Bộ âm tiết hóa / tokenizer tiếng Việt của VieNeu khi gặp ký tự `<` và `>` sẽ đọc to thành chữ: *"dấu nhỏ hơn sigh dấu lớn hơn"* (hoặc *"dấu bé hơn..."*), làm hỏng hoàn toàn trải nghiệm lồng tiếng.
  - Đồng thời, UI không được đồng bộ: ô chọn giọng (Voice ID) vẫn hiển thị giọng Gemini (`Kore`), ô Model vẫn hiển thị `gemini`, và khung kịch bản (textarea) vẫn giữ các thẻ `<sigh>`, khiến người dùng hoang mang không biết thực chất hệ thống đang đọc bằng giọng gì và tại sao kết quả lại khác biệt.
- **Bài học & Quy tắc giải quyết:**
  1. **Làm sạch triệt để thẻ cảm xúc khi Fallback (Sanitize Emotion Tags on Fallback):**
     - Viết hàm `stripAllEmotionTags(text)` sử dụng regex loại bỏ toàn bộ các thẻ `<[^>]+>` và các thẻ đóng mở ngoặc `\[[^\]]*\]`.
     - Dọn dẹp dấu cách thừa trước các dấu câu (`,.!?;…`) và khoảng trắng đôi.
     - Tại `tts-helper.ts`, khi kích hoạt fallback sang VieNeu, bắt buộc gán `textForVieNeu = stripAllEmotionTags(text)`, đảm bảo file âm thanh tạo ra hoàn toàn không chứa bất kỳ từ phát âm dấu nào.
     - Sử dụng `cleanedText` này cho cả việc sinh phụ đề SRT và word timing để đồng bộ với âm thanh.
  2. **Đồng bộ hóa 100% trạng thái giao diện người dùng (Full UI State Synchronization):**
     - Endpoint trả về cờ `isFallback: true`, `fallbackVoice`, `fallbackModel`, `cleanedText`, và `warning`.
     - Tại Frontend (`handleGenerateTts` và `handlePreviewTts`), khi nhận `isFallback`:
       - Cập nhật dropdown Voice ID: `setVoiceId(data.fallbackVoice)`.
       - Cập nhật dropdown Model: `setTtsModel(data.fallbackModel)`.
       - Cập nhật textarea kịch bản: `setTtsText(data.cleanedText)` (hoặc `setPreviewText(data.cleanedText)`).
       - Cập nhật metadata hiển thị đúng giọng đọc thực tế (`fallbackVoice`).
  3. **Hiển thị Banner Cảnh Báo Rõ Ràng ở Cuối Giao Diện (Prominent Fallback Reason Banner):**
     - Đặt một Amber Warning Banner ở cuối trang giải thích chi tiết:
       - Lý do chuyển hướng: Gemini Cloud hết hạn mức miễn phí trong ngày (429 Quota Exceeded).
       - Hành động hệ thống: Đã tự động đổi sang VieNeu Local và làm sạch thẻ cảm xúc để tránh phát âm lỗi.
       - Trạng thái đồng bộ: Thông báo rõ cho người dùng biết các ô nhập liệu phía trên đã được tự động cập nhật phản ánh đúng thực tế.

---

## 29. Khắc Phục Mất File Video Sau Render (EXDEV Cross-Device Move), An Toàn Thay Thế Tệp & Hỗ Trợ HTTP Range Streaming

- **Sai lầm đã mắc:**
  - Sau khi Remotion kết xuất video hoàn tất (`100%`), người dùng vào màn hình QA & Render thì không xem được video, thông báo *"Rendered MP4 file not found"*, file trên đĩa hoàn toàn biến mất.
  - **Gốc rễ 1 — Lỗi `EXDEV: cross-device link not permitted`:**
    Trong `LoudnessProcessor.processVideo`, các file tạm (`tempMuxVideo`) được đặt tại `os.tmpdir()` (thường nằm ở ổ `C:\Users\...\AppData\Local\Temp`), trong khi thư mục dự án nằm ở ổ đĩa khác (`E:\faceless-studio`). Trên hệ điều hành Windows, lệnh `fs.promises.rename` giữa hai ổ đĩa khác nhau **luôn ném lỗi `EXDEV`**.
  - **Gốc rễ 2 — Xóa file gốc trước khi file đích sẵn sàng:**
    Code thực hiện `await unlink(videoPath)` trước khi gọi `await rename(tempMuxVideo, finalOut)`. Khi `rename` văng lỗi `EXDEV`, khối `finally` dọn dẹp và xóa luôn cả file `tempMuxVideo` ở ổ `C:`. Khối `catch` ở `RemotionRendererAdapter` bắt lỗi ngầm. Hậu quả là cả 2 bản sao video đều bị xóa sạch, biến mất khỏi ổ đĩa!
  - **Gốc rễ 3 — Thiếu Range Request cho thẻ `<video>`:**
    Endpoint `/projects/:slug/files/*` trước đây đọc toàn bộ file bằng `readFileSync`, không hỗ trợ `Accept-Ranges: bytes` và mã `206 Partial Content`. Trình duyệt web (Chrome/Safari) khi phát video HTML5 gửi header `Range: bytes=0-` để tua hoặc đệm dữ liệu; nếu server trả về mã 200 trơn hoặc không có Range, trình phát sẽ không tua được hoặc báo lỗi hỏng file.
  - **Gốc rễ 4 — Lỗi kiểu dữ liệu duration từ `ffprobe`:**
    `ffprobe` trả về chuỗi `"3.033333"` trong JSON format, hàm `getDuration` không gọi `parseFloat`, dẫn tới `actualDuration.toFixed is not a function` khi kiểm tra QA Gate.
- **Bài học & Quy tắc giải quyết:**
  1. **Tạo file tạm cùng thư mục với file đích (Same-Directory Temp Files):**
     - Luôn sử dụng `workDir = dirname(finalOut)` để tạo các file mux tạm `.temp-video-mux-${nonce}.mp4`. Điều này đảm bảo 100% file tạm và file kết quả nằm trên cùng một ổ đĩa / phân vùng, triệt tiêu hoàn toàn lỗi `EXDEV`.
  2. **An toàn thay thế tệp (Safe In-Place Overwrite with `copyFile`):**
     - Tuyệt đối KHÔNG xóa file gốc (`unlink(videoPath)`) trước khi file mới được ghi thành công.
     - Sử dụng `await copyFile(tempMuxVideo, finalOut)` để ghi đè an toàn lên đích đến, sau đó mới xóa file tạm `tempMuxVideo`. Nếu có bất kỳ sự cố nào xảy ra trong quá trình xử lý âm thanh, file video render gốc vẫn được bảo toàn nguyên vẹn.
  3. **Chuẩn hóa HTTP 206 Partial Content & HEAD Request cho Video Streaming:**
     - Tại `apps/server/src/app.ts`, cấu hình endpoint `app.on(["GET", "HEAD"], "/projects/:slug/files/*")`.
     - Bắt header `range`, phân rã `start` và `end`, trả về mã `206 Partial Content`, header `Content-Range: bytes ${start}-${end}/${fileSize}`, `Accept-Ranges: bytes` và stream nội dung bằng `createReadStream(fullPath, { start, end })`.
     - Hỗ trợ đầy đủ phương thức `HEAD` với `Content-Length` và `Accept-Ranges` để frontend kiểm tra tệp tồn tại nhanh chóng mà không tốn băng thông.
  4. **Chống Cache Stale trên Frontend:**
     - Khi gán `renderedVideoUrl`, luôn gắn query timestamp `?t=${Date.now()}` và gán thuộc tính `key={renderedVideoUrl}` cùng `playsInline` trên thẻ `<video>`. Điều này buộc React và trình duyệt nạp lại bitstream mới nhất thay vì giữ cache của lần render cũ.
  5. **Ép kiểu số thực từ FFprobe:**
     - Trong `ffmpeg.ts`, luôn gọi `parseFloat(result.format.duration)` để đảm bảo giá trị trả về là kiểu `number` chuẩn, ngăn chặn lỗi `toFixed is not a function`.




---

## 30. Khắc Phục Lệch Khớp Âm Thanh - Video (Audio-Video Desync) & Hiển Thị Visual Assets Trong Remotion Layouts

- **Sai lầm đã mắc:**
  - **Lệch thời lượng nghiêm trọng giữa Audio và Video:**
    - Kịch bản âm thanh được tạo ở bước TTS có độ dài thực tế **20.96 giây** (95 từ). Tuy nhiên, `spec.json` lại chứa `durationSec: 31` và word timestamps giả định (0.3s/từ) do bước tạo spec trước đó sinh ra một cách độc lập mà không đồng bộ ngược lại với `results/tts.json`.
    - Hậu quả: Video dài 31 giây trong khi audio đã dứt ở 20.96 giây, dẫn tới hơn 10 giây im lặng chết chóc ở cuối video, đồng thời phụ đề karaoke chạy lệch hoàn toàn so với giọng nói phát ra.
  - **Video trống trơn, không có hình ảnh minh họa (Missing Visual Assets):**
    - Mặc dù ảnh minh họa đã được sinh và lưu trữ đầy đủ trong `assets/processed/b1.png`..`b4.png` và đăng ký trong `assets/manifest.json`, nhưng các beat trong `spec.json` vẫn có `assets: []`.
    - `RemotionRendererAdapter` chỉ giải quyết đường dẫn âm thanh thành Data URI (`audioSources`), nhưng hoàn toàn không giải quyết các tệp ảnh (`imageSources`). Do Remotion chạy trong headless Chromium sandbox, Chromium không thể tự truy cập trực tiếp các đường dẫn tệp tương đối trên ổ đĩa.
    - Các Remotion layout (`BaroqueMonoLayout`, `CleanSplitLayout`, `MinimalLayout`) ở Phase 1 chỉ vẽ khung chữ tĩnh hoặc placeholder giả lập (`"Visual Showcase"`), chưa tính toán `activeBeat` theo thời gian hiện tại (`frame / fps`) và chưa nhúng `<Img />`.
- **Bài học & Quy tắc giải quyết:**
  1. **Đồng bộ tuyệt đối giữa TTS Audio và VideoSpec (Luật vàng #1 & #3):**
     - Tại `POST /projects/:slug/tts/generate`: Khi sinh xong `results/tts.json`, tự động đồng bộ ngay vào `spec.json.narration` (`durationSec`, `audioPath`, `words`) và tự động chia lại dải từ (`range: { startWordId, endWordId }`) cùng `captions` của các beats.
     - Tại `POST /projects/:slug/render`: Trước khi dựng video, tự động kiểm tra đối chiếu `spec.json` với `results/tts.json`. Nếu phát hiện lệch thời lượng hoặc danh sách từ, tự động đồng bộ lại ngay lập tức.
     - Tại `ai-helper.ts` (case `"spec"`): Ưu tiên đọc trực tiếp từ `results/tts.json` và `assets/manifest.json` trên đĩa thay vì tính toán giả định.
  2. **Nạp ảnh Asset thành Base64 Data URIs (`resolveImageSources`):**
     - Tại `RemotionRendererAdapter`, hiện thực `imageFileToDataUri` và `resolveImageSources`. Tự động quét từ `assets/manifest.json`, `beat.assets` và thư mục `assets/processed/`, chuyển đổi tất cả hình ảnh thành Base64 Data URI (`data:image/png;base64,...`) và truyền vào `inputProps.imageSources`.
     - Giải pháp Data URI hoạt động 100% tất định và độc lập trên mọi nền tảng (Windows / Linux) mà không phụ thuộc vào web server tĩnh ngoài.
  3. **Tính toán Active Beat & Chuyển động Camera Tất định trong Remotion (Luật vàng #4):**
     - Xây dựng helper `getActiveBeatInfo(spec, currentTime, imageSources)`:
       - Tính `currentTime = frame / fps`.
       - Dựa vào `startSec` của `startWordId` và `endSec` của `endWordId` để xác định beat đang phát.
       - Tính toán `cameraScale` bằng `interpolate(beatProgress, [0, 1], [1.0, 1.08], { extrapolateRight: "clamp" })` phục vụ hiệu ứng Ken Burns zoom chậm điện ảnh chuẩn Caravaggio chiaroscuro.
  4. **Cập nhật Toàn diện Các Template Layout:**
     - `BaroqueMonoLayout`: Vẽ ảnh beat nền toàn màn hình với hiệu ứng Ken Burns, lớp phủ gradient chiaroscuro huyền bí, tương phản cao, làm nổi bật viền hoa văn vàng kim cổ điển và phụ đề karaoke từ-theo-từ.
     - `CleanSplitLayout`: Nhúng ảnh beat với Ken Burns và ghi chú đạo diễn vào thẻ visual card thay thế placeholder cũ.
     - `MinimalLayout`: Nhúng ảnh beat nền mờ tối tinh tế giúp chữ nổi bật.
  5. **Đạt Chuẩn 100% QA Gates (Pre & Post Render):**
     - `runPreRenderQA`: Schema hợp lệ, asset file tồn tại trên đĩa, đăng ký đầy đủ license (`CC0`) trong manifest, audio và word confidence >= 0.8 (0 lỗi, 0 cảnh báo).
     - `runPostRenderQA`: Thời lượng MP4 khớp 100% thời lượng audio TTS (`20.96s`), độ lệch = 0s (< 2.0s tolerance), chuẩn loudness -14 LUFS YouTube (0 lỗi, 0 cảnh báo).


---

## 31. Loại Bỏ Triệt Để Các Phần Tử Demo/Debug Trên Video & Chuẩn Hóa Phụ Đề Ngắt 1 Câu Ngắn Gọn

- **Sai lầm đã mắc:**
  - **Dính các phần tử demo/debug giữa khung hình video:**
    - Trong giai đoạn Phase 1 thử nghiệm, các template layout (`BaroqueMonoLayout`, `CleanSplitLayout`, `MinimalLayout`) được gắn các trường văn bản phục vụ test: tiêu đề stage (`"Tổng hợp thành spec hoàn chỉnh"`), số frame (`FRAME 183`), mã beat (`BEAT B2`), số giây (`6.1s`), và trích dẫn ghi chú đạo diễn (`directorNote`) ngay chính giữa màn hình.
    - Khi render video sản phẩm thực tế, các chữ demo này che lấp toàn bộ trung tâm bức tranh minh họa nghệ thuật, gây rối mắt và làm video giống bản demo kỹ thuật thay vì tác phẩm video faceless chuyên nghiệp cho người xem thật.
  - **Phụ đề hiển thị quá dài, tràn 2 dòng nhiều câu:**
    - Phụ đề ban đầu gộp toàn bộ 24 từ của một beat vào một khối, khiến trên màn hình cùng lúc hiển thị cả 2 câu khác nhau (ví dụ: *"đến mức ám ảnh chúng ta đến vậy? Trong thực tế, hầu hết chúng ta đều từng trải qua..."*), trải dài trên 2 dòng gây mỏi mắt người xem.
- **Bài học & Quy tắc giải quyết:**
  1. **Loại bỏ 100% các phần tử Demo / Debug / Stage Title trên video thành phẩm:**
     - Xóa hoàn toàn các thẻ tiêu đề stage, chapter header, số frame, mã beat, số giây, và ghi chú đạo diễn khỏi các layout component (`BaroqueMonoLayout`, `CleanSplitLayout`, `MinimalLayout`).
     - Video chỉ giữ lại: tranh minh họa nghệ thuật toàn màn hình với hiệu ứng Ken Burns zoom chậm điện ảnh, viền hoa văn phong cách template (nếu có), và phụ đề karaoke thanh lịch ở đáy màn hình.
  2. **Phân rã phụ đề tự nhiên theo dấu câu (1 câu / 1 vế trên 1 dòng duy nhất):**
     - Tại `groupWordsIntoChunks` trong `Subtitle.tsx`:
       - Tự động ngắt câu ngay lập tức khi từ kết thúc bằng các dấu câu ngắt câu (`.`, `?`, `!`, `;`, `…`, `:`).
       - Ngắt vế tại dấu phẩy `,` nếu cụm từ đã tích lũy từ 4 từ trở lên.
       - Giới hạn tối đa 6-7 từ mỗi dòng, ngăn chặn triệt để hiện tượng tràn thành 2 dòng bằng `flexWrap: "nowrap"`.
       - Giữ hiển thị phụ đề mượt mà cho đến khi câu tiếp theo bắt đầu, tránh hiện tượng chữ biến mất giật cục trong các khoảng dừng thở ngắn.
