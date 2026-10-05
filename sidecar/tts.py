"""
Faceless Studio — TTS Sidecar (stub).

Giao thức:
- Input: JSON file path qua argv[1], chứa list jobs:
  [{"id": "j1", "text": "Xin chào", "voice": "default", "speed": 1.0}, ...]
- Output: JSONL trên stdout, mỗi dòng:
  {"jobId": "j1", "audioPath": "audio/chunks/j1.wav", "durationSec": 1.5}
  hoặc {"jobId": "j1", "error": "..."}
- Exit code: 0 nếu tất cả thành công, 1 nếu có lỗi.

Hiện tại: stub — sinh file WAV silence (sử dụng wave module).
Thay bằng VieNeu-TTS khi có model.
"""
import json
import sys
import wave
import struct
from pathlib import Path


def generate_silence_wav(path: Path, duration_sec: float, sample_rate: int = 16000) -> None:
    """Sinh file WAV chứa silence."""
    n_frames = int(sample_rate * duration_sec)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{n_frames}h", *([0] * n_frames)))


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python tts.py <jobs.json>"}), file=sys.stderr)
        sys.exit(1)

    jobs_path = Path(sys.argv[1])
    if not jobs_path.exists():
        print(json.dumps({"error": f"File not found: {jobs_path}"}), file=sys.stderr)
        sys.exit(1)

    jobs = json.loads(jobs_path.read_text(encoding="utf-8"))
    has_error = False

    for job in jobs:
        try:
            job_id = job["id"]
            text = job["text"]
            duration = len(text) * 0.08  # ~80ms per character estimate
            out_path = Path(job.get("outputDir", "audio/chunks")) / f"{job_id}.wav"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            generate_silence_wav(out_path, duration)
            result = {"jobId": job_id, "audioPath": str(out_path), "durationSec": round(duration, 3)}
            print(json.dumps(result, ensure_ascii=False), flush=True)
        except Exception as e:
            has_error = True
            print(json.dumps({"jobId": job.get("id", "?"), "error": str(e)}, ensure_ascii=False), flush=True)

    sys.exit(1 if has_error else 0)


if __name__ == "__main__":
    main()