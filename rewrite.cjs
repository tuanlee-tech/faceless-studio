const fs = require('fs');

const path = 'projects/doi-quan-dat-nung/results/002-script.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.content = "[hắng giọng] Bạn có bao giờ tự hỏi: vì sao bí ẩn về đội quân đất nung của Tần Thủy Hoàng lại có sức ảnh hưởng mạnh mẽ đến lịch sử nhân loại đến vậy? [thở dài] Trong thực tế, hầu hết chúng ta đều chỉ nghe qua những câu chuyện thần thoại mà không hề nhận ra sự vĩ đại thực sự ẩn giấu bên dưới lăng mộ. Khi hiểu được bản chất của vấn đề, bạn sẽ có một góc nhìn hoàn toàn mới về kỹ thuật thời cổ đại [cười]. Hãy nhớ rằng, sự thông tuệ bắt đầu từ việc không ngừng học hỏi mỗi ngày.";

data.sections[0].text = "[hắng giọng] Bạn có bao giờ tự hỏi: vì sao bí ẩn về đội quân đất nung của Tần Thủy Hoàng lại có sức ảnh hưởng mạnh mẽ đến lịch sử nhân loại đến vậy?";
data.sections[1].text = "[thở dài] Trong thực tế, hầu hết chúng ta đều chỉ nghe qua những câu chuyện thần thoại mà không hề nhận ra sự vĩ đại thực sự ẩn giấu bên dưới lăng mộ.";
data.sections[2].text = "Khi hiểu được bản chất của vấn đề, bạn sẽ có một góc nhìn hoàn toàn mới về kỹ thuật thời cổ đại [cười].";
data.sections[3].text = "Hãy nhớ rằng, sự thông tuệ bắt đầu từ việc không ngừng học hỏi mỗi ngày.";

fs.writeFileSync(path, JSON.stringify(data, null, 2));

const path2 = 'projects/doi-quan-dat-nung/results/script.json';
if (fs.existsSync(path2)) {
  fs.writeFileSync(path2, JSON.stringify(data, null, 2));
}

console.log("Updated script!");
