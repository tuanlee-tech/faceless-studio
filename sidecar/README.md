# Faceless Sidecar (TTS + Alignment)

## Setup
```bash
cd sidecar
uv venv
uv pip install -e .
```

## Chạy TTS (stub)
```bash
echo '[{"id":"j1","text":"Xin chào","voice":"default"}]' > /tmp/jobs.json
uv run python tts.py /tmp/jobs.json
```

## Chạy Align (stub)
```bash
echo '{"audioPath":"test.wav","text":"Xin chào thế giới","lang":"vi"}' > /tmp/align-input.json
uv run python align.py /tmp/align-input.json
```

## Trạng thái
- [ ] TTS: stub (silence WAV). Cần VieNeu-TTS v3 Turbo.
- [ ] Align: stub (phân bổ đều). Cần spike WhisperX / stable-ts.