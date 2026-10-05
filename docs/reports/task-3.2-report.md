# Báo cáo Nghiệm thu Task 3.2: Audio Mixing & Ducking (Renderer)

> **Mục tiêu:** Xử lý âm thanh đa kênh trong Remotion (`<AudioMixer />`): phát nhạc nền lặp lại (loop), định vị hiệu ứng âm thanh (SFX) neo theo word ID, và giải thuật Auto-Ducking tất định tính toán đường cong âm lượng giảm nhạc nền xuống 20–30% khi narration cất lên và phục hồi khi có khoảng nghỉ >= 0.5s.  
> **Trạng thái:** HOÀN THÀNH (PASS 100%)

---

## 1. Các hạng mục đã triển khai

1. **Giải thuật Auto-Ducking tất định (`@faceless/renderer-remotion/src/remotion/audio/ducking.ts`):**
   - **`buildSpeechSegments(words, minSilenceSec = 0.5)`:**
     - Lọc và sắp xếp các từ theo `startSec`.
     - Gom nhóm (merge) các từ liên tiếp có khoảng lặng $< 0.5$s thành các đoạn hội thoại liên tục (speech segments), tránh hiện tượng giật/pumping âm lượng giữa từng từ đơn lẻ.
     - Tách đoạn khi khoảng lặng $\ge 0.5$s để chuẩn bị hồi phục âm lượng nhạc nền.
   - **`getDuckingAlpha(timeSec, segments, fadeDurationSec = 0.2)`:**
     - Tính hệ số ducking $\alpha(t) \in [0, 1]$ tại thời điểm $t$.
     - $\alpha = 0$ khi không có giọng đọc (âm lượng nhạc tối đa).
     - $\alpha = 1$ khi đang đọc thoại (âm lượng nhạc bị giảm).
     - Ramping mượt mà (fade-in / fade-out) trong khoảng thời gian $0.2$s ở các biên chuyển tiếp.
   - **`calculateDuckedVolume(frame, fps, segments, baseVolume, duckRatio = 0.25, fadeDuration = 0.2)`:**
     - Hàm tất định theo `frame`: $\text{volume}(t) = \text{baseVolume} \times (1 - \alpha(t) \times (1 - \text{duckRatio}))$.
     - Âm lượng giảm xuống đúng 25% (nằm trong ngưỡng yêu cầu 20–30%) trong lúc đọc, và trở lại 100% `baseVolume` khi im lặng.
   - **`createDuckedVolumeEvaluator(fps, words, baseVolume, options)`:**
     - Tiền xử lý các đoạn segment và trả về hàm closure `(frame: number) => number` tối ưu hiệu năng cao để truyền trực tiếp vào prop `volume` của Remotion `<Audio />`.

2. **Component `<AudioMixer />` (`@faceless/renderer-remotion/src/remotion/AudioMixer.tsx`):**
   - Sử dụng Remotion `<Audio />` và `<Sequence layout="none">`.
   - **Narration Track:** Phát giọng đọc chính với âm lượng chuẩn `volume={1}`.
   - **Background Music Tracks:** Phát nhạc nền từ `spec.music`, hỗ trợ `loop={true}`, bắt đầu từ `track.startSec`, và áp dụng đường cong âm lượng `volume={volumeCallback}` tính toán bằng giải thuật auto-ducking.
   - **SFX Triggers (Neo theo từ - Word-anchored):**
     - Quét toàn bộ `sfx` trong các beat của các chapter.
     - Tìm từ neo `anchorWordId` trong bảng `words`, tính thời điểm kích hoạt: `triggerSec = anchorWord.startSec + sfx.offsetSec`.
     - Bọc trong `<Sequence from={triggerFrame} layout="none">` với âm lượng `sfx.volume` được chỉ định.
   - Tuân thủ nghiêm ngặt **Luật vàng #4 (Tất định)** và **Bài học #7 (Cô lập browser bundle)**: Chỉ dùng `import type` từ `@faceless/core`, không kéo `node:fs` vào Webpack client bundle.

3. **Cơ chế phân giải Audio Asset trong Node context (`adapter.ts`):**
   - Bổ sung hàm `resolveAudioSources(spec, projectDir)` trong `RemotionRendererAdapter`:
     - Tự động tìm kiếm file audio của Narration, Music, và SFX từ project directory (`assets/audio/`, `audio/`, `sfx/`, `music/`), thư mục chia sẻ `library/` và sổ cái `library/library.json`.
     - Chuyển đổi an toàn sang Data URI Base64 (`data:audio/wav;base64,...`, `data:audio/mpeg;base64,...`) để đưa vào `inputProps.audioSources`.
     - Nếu file chưa tồn tại hoặc bị thiếu (trong môi trường mock/test sơ khởi), xử lý an toàn không để Remotion bị crash do lỗi 404 mạng.

4. **Tích hợp vào Layout và Composition (`MainVideo.tsx`, `Root.tsx`):**
   - Đưa `<AudioMixer spec={spec} audioSources={audioSources} />` vào cây render của `MainVideo`.
   - Hoàn toàn tương thích ngược cho cả hai định dạng `Long16x9` (1920x1080) và `Short9x16` (1080x1920).

---

## 2. Kết quả kiểm thử & Nghiệm thu thực tế

- **Type-Check & Build (2 Cánh cổng đầu tiên):**
  - `pnpm -r run lint` (`tsc --noEmit`): ✅ **0 errors** trên toàn bộ 4 packages.
  - `pnpm -r run build` (`tsc`): ✅ Biên dịch sạch toàn bộ monorepo, sinh file `.d.ts` và `.js` hoàn chỉnh.

- **Unit & Integration Tests (Vitest):**
  - **`packages/renderer-remotion/src/__tests__/ducking.test.ts` (14/14 passed):**
    - Gom nhóm các từ có khoảng nghỉ $< 0.5$s thành 1 segment liên tục.
    - Phân tách segment khi khoảng nghỉ $\ge 0.5$s.
    - Tính toán hệ số `getDuckingAlpha` chính xác: 0 ở ngoài, 1 ở trong phân đoạn nói, ramp 0.5 ở giữa fade.
    - `calculateDuckedVolume` giảm đúng về 25% (từ 0.4 xuống 0.1) và phục hồi về 0.4 khi im lặng.
    - Xử lý mượt mà biên frame 0 và base volume bằng 0.
  - **`packages/renderer-remotion/src/__tests__/audio-mixer.test.ts` (4/4 passed):**
    - Phân giải đúng audio file thành Data URI Base64 khi file tồn tại trên đĩa.
    - Xử lý thiếu file mượt mà (undefined an toàn).
    - Giữ nguyên các Data URI truyền trực tiếp trong spec.
    - **Render thực tế MP4** video có kích hoạt đầy đủ Narration, BGM có ducking và SFX: File MP4 tạo ra hợp lệ trên đĩa với dung lượng $> 0$ byte.
  - **`packages/renderer-remotion/src/__tests__/adapter.test.ts` (3/3 passed):**
    - Render still image với template minimal.
    - Render still image với baroque-mono và clean-split.
    - Render video clip MP4.

- **Tổng kết kiểm thử Monorepo:** ✅ **95/95 tests passed (100% xanh)** trên cả 18 test suites:
  - `@faceless/core`: 37 tests (7 files)
  - `@faceless/media`: 3 tests (1 file)
  - `@faceless/renderer-remotion`: 24 tests (4 files)
  - `@faceless/cli`: 31 tests (6 files)
