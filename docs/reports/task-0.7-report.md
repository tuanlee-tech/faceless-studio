## Nghiệm thu Task 0.7

- Trạng thái: **PASS**
- `uv venv` thành công: YES
- TTS stub test: PASS
- Align stub test: PASS
- WAV file valid: YES
- Việc còn mở:
  - TTS: Cần tích hợp VieNeu-TTS v3 Turbo khi có model
  - Align: Cần spike WhisperX / stable-ts để thay thế stub

---

### Chi tiết kiểm tra

#### 1. Cài đặt môi trường Python (`uv`)
```
$ cd sidecar && uv venv && uv pip install -e .
```
→ Thành công, tạo virtual environment tại `sidecar/.venv/`

#### 2. TTS Stub (`python3 sidecar/tts.py`)
- Không đối số → exit 1, stderr có JSON error: PASS
- Với input hợp lệ `/tmp/test-jobs.json`:
  - stdout có 1 dòng JSONL parse được
  - Có `jobId`, `audioPath`, `durationSec`: PASS
  - File WAV được tạo tại `audio/chunks/j1.wav`
  - `ffprobe` xác nhận: WAV hợp lệ (PCM signed 16-bit, 16kHz, mono, 0.64s): PASS

#### 3. Align Stub (`python3 sidecar/align.py`)
- Không đối số → exit 1, stderr có JSON error: PASS
- Với input hợp lệ `/tmp/align-input.json`:
  - stdout có JSON, có `words` array
  - Mỗi word có `id`, `text`, `startSec`, `endSec`, `confidence`: PASS

#### 4. Entry points qua `uv run`
- `uv run faceless-tts /tmp/test-jobs.json`: PASS
- `uv run faceless-align /tmp/align-input.json`: PASS

#### 5. Không có file `.sh` hay `.bat`: PASS

#### 6. `pyproject.toml` đúng spec
```toml
[project.scripts]
faceless-tts = "tts:main"
faceless-align = "align:main"

[tool.setuptools]
py-modules = ["tts", "align"]
```

---

### Kết quả Phase 0 Checklist tổng hợp

Sau khi hoàn thành Task 0.7, chạy checklist từ root:

```bash
# 1. Install all dependencies
pnpm install ✅

# 2. Build all packages
pnpm build ✅

# 3. Run all tests
pnpm test ✅ (12 tests passed: core=7, cli=2, media=3)

# 4. Run doctor
node packages/cli/dist/main.js doctor --json ✅ (JSON hợp lệ, allPassed=true)

# 5. Verify no React/Remotion in core/media
grep -rn "from 'react\|from 'remotion\|from '@remotion" packages/core/src/ packages/media/src/ ✅ (trống)

# 6. Verify docs exist
ls docs/ROADMAP.md docs/VIDEO-SPEC.md docs/PIPELINE.md docs/TEMPLATES-AND-TOPICS.md docs/CINEMATIC-GRAMMAR.md docs/ASSETS-AND-AUDIO.md docs/QA-GATES.md docs/SKILLS.md ✅

# 7. Verify sidecar
python3 sidecar/tts.py 2>&1 | head -1 ✅ (JSON error)
python3 sidecar/align.py 2>&1 | head -1 ✅ (JSON error)

# 8. Verify .gitattributes
cat .gitattributes ✅ (* text=auto eol=lf)
```

**Phase 0: PASS** ✅