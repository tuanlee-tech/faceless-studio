const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No API key");
    return;
  }
  
  const scriptContent = fs.readFileSync('projects/bi-an-tam-giac-quy-bermuda/results/002-script.json', 'utf8');
  const directContent = fs.readFileSync('projects/bi-an-tam-giac-quy-bermuda/results/003-direct.json', 'utf8');
  
  const prompt = `Bạn là một chuyên gia kịch bản âm thanh (Voiceover Director).
Dưới đây là kịch bản (Script) và chỉ đạo nghệ thuật (Direct) của một video.
Nhiệm vụ của bạn: 
1. Lọc bỏ các tiêu đề phần (Heading), chỉ giữ lại đúng những câu thoại (Voiceover) mà người đọc (AI/người thật) sẽ phát âm.
2. Bạn có thể chèn thẻ cảm xúc vào văn bản để tăng tính chân thực. TUY NHIÊN, BẠN CHỈ ĐƯỢC PHÉP SỬ DỤNG ĐÚNG 3 THẺ SAU (không bịa thêm thẻ nào khác):
   - [cười] : Để ở cuối hoặc giữa câu để tạo sự vui vẻ, tươi tắn.
   - [thở dài] : Để ở đầu hoặc giữa câu biểu thị mệt mỏi, chán nản, luyến tiếc.
   - [hắng giọng] : Để ở đầu hoặc giữa câu để tạo ngắt quãng tự nhiên (e hèm).
   Hãy chèn các thẻ này một cách tiết chế và tự nhiên, chỉ khi ngữ cảnh thực sự phù hợp.
3. Không làm thay đổi nội dung chính của lời thoại.
4. CHỈ TRẢ VỀ nội dung text thuần tuý, KHÔNG CÓ markdown code block, KHÔNG JSON, KHÔNG BÌNH LUẬN.

--- SCRIPT ---
${scriptContent}

--- DIRECT ---
${directContent}
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    }
  );
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
