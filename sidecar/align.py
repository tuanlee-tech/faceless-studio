"""
Faceless Studio — Alignment Sidecar (stub).

Giao thức:
- Input: JSON qua argv[1]:
  {"audioPath": "audio/narration.wav", "text": "Xin chào thế giới", "lang": "vi"}
- Output: JSON trên stdout:
  {"words": [{"id": "w001", "text": "Xin", "startSec": 0.0, "endSec": 0.3, "confidence": 0.95}, ...]}

Hiện tại: stub — phân bổ đều từng từ.
Thay bằng WhisperX/stable-ts sau spike.
"""
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python align.py <input.json>"}), file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(json.dumps({"error": f"File not found: {input_path}"}), file=sys.stderr)
        sys.exit(1)

    data = json.loads(input_path.read_text(encoding="utf-8"))
    text = data["text"]
    raw_words = text.split()

    avg_dur = 0.3  # 300ms per word
    words = []
    for i, w in enumerate(raw_words):
        words.append({
            "id": f"w{i + 1:03d}",
            "text": w,
            "startSec": round(i * avg_dur, 3),
            "endSec": round((i + 1) * avg_dur, 3),
            "confidence": 0.95,
        })

    result = {"words": words}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()