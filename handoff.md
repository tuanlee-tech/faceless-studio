# Báo cáo Bàn giao (Handoff Report)

## 1. Công việc đã hoàn thành
- **Tách và di chuyển UI của TTS (Sinh Audio):** Đưa giao diện chọn Voice, AI Viết lại (chèn thẻ cảm xúc `[enthusiasm]`, `<laugh>`, `[cười]`), và tạo Audio từ Tab 3 (Render & QA) sang **Tab 1 (Pipeline Inbox)**.
- **Tích hợp nhạc nền (BGM):** Bổ sung UI upload/tùy chọn nhạc nền (`bgm.mp3`) riêng biệt cho từng Project vào **Tab 2 (Storyboard & Assets)**. Hệ thống sẽ tự dùng nhạc nền này thay thế nhạc gốc của template.
- **Làm sạch Tab 3:** Lược bỏ các phần không liên quan, Tab 3 nay chỉ còn đúng nhiệm vụ Kiểm duyệt Pre-Render QA và Xuất bản Render Queue chia chunk.
- **Fix lỗi UX nghiêm trọng của TTS:**
  - Lỗi tự động chạy ngầm `tts` bằng API gây crash Backend đã được xử lý (trả về lỗi HTTP 400 rõ ràng và điều hướng về Tab 1).
  - Lỗi không thể hiển thị lại giao diện TTS sau khi đã sinh Audio xong (vì bị ẩn đi khi state là `done`). Đã fix bằng cách **inject `Task #tts-ui`** thẳng vào danh sách Task Inbox để người dùng click lại và chỉnh sửa Audio bất cứ lúc nào.
  - Fix khung **Preview Nghe thử TTS** thành giao diện có thể đóng/mở (collapsible) để trả lại không gian gõ text rộng rãi cho Editor.
- **Fix lỗi Backend trắng Project:** Đã ghi nhận và khắc phục lỗi sập API `GET /projects` do `process.cwd()` sai thư mục gốc khi khởi động lại tiến trình server trong lúc phát triển.

## 2. Kế hoạch tiếp theo (Next Steps) cho Tester (User)
- Pull code mới nhất về và chạy `pnpm dev` từ thư mục gốc.
- Tạo Project mới hoặc tiếp tục với Project **"Bí ẩn tam giác quỷ Bermuda"**.
- Trải nghiệm tính năng chèn thẻ cảm xúc và tạo Audio, kiểm tra luồng tự động nhảy sang Tab 2 và tự động chia `spec`.
- Kéo xuống dưới phần Nhạc nền ở Tab 2 để thử đổi một bản nhạc MP3 khác.
- Di chuyển sang Tab 3 và xuất bản Video hoàn chỉnh. Kiểm tra xem Audio cảm xúc và nhạc nền mới có khớp với Remotion không.

## 3. Chú ý Kỹ thuật
- File `apps/web/src/components/TTSGenerator.tsx` nay đóng vai trò độc lập cho UI Sinh giọng đọc.
- File `apps/server/src/app.ts` được tinh chỉnh luồng `validateTasks` để tự động đánh dấu `done` nếu pass QA, đồng thời cập nhật chính xác timestamp cho `updatedAt`.
