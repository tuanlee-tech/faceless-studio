import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";

const execFileAsync = promisify(execFile);

/**
 * Splits text into small, natural spoken chunks based on sentence boundaries,
 * punctuation pauses, and word count to ensure rapid TTS inference.
 */
export function splitTextIntoChunks(text: string, maxWords: number = 22): string[] {
  if (!text || !text.trim()) return [];

  // Split into paragraphs by newlines
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const rawSentences: string[] = [];
  for (const para of paragraphs) {
    const sents = para.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sents.length > 0) {
      rawSentences.push(...sents);
    } else {
      rawSentences.push(para);
    }
  }

  const chunks: string[] = [];
  let currentGroup = "";

  for (const sentence of rawSentences) {
    const testGroup = currentGroup ? `${currentGroup} ${sentence}` : sentence;
    const wordCount = testGroup.split(/\s+/).filter(Boolean).length;

    if (wordCount <= maxWords) {
      currentGroup = testGroup;
    } else {
      if (currentGroup) chunks.push(currentGroup);
      
      // If a single sentence is still larger than maxWords, split it by commas
      const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
      if (sentenceWords > maxWords) {
        const subClauses = sentence.split(/(?<=[,;:—–-])\s+/).map((c) => c.trim()).filter(Boolean);
        let subGroup = "";
        for (const clause of subClauses) {
          const testSub = subGroup ? `${subGroup} ${clause}` : clause;
          if (testSub.split(/\s+/).filter(Boolean).length <= maxWords) {
            subGroup = testSub;
          } else {
            if (subGroup) chunks.push(subGroup);
            subGroup = clause;
          }
        }
        currentGroup = subGroup;
      } else {
        currentGroup = sentence;
      }
    }
  }
  
  if (currentGroup) chunks.push(currentGroup);

  return chunks.filter((c) => Boolean(c.trim()));
}

/**
 * Ensures both .mp3 and .wav versions exist using ffmpeg.
 */
async function ensureMp3AndWav(audioPath: string): Promise<{ mp3Path: string; wavPath: string }> {
  const baseName = audioPath.replace(/\.(wav|mp3)$/i, "");
  const wavPath = `${baseName}.wav`;
  const mp3Path = `${baseName}.mp3`;

  try {
    if (audioPath.endsWith(".wav") && existsSync(wavPath)) {
      await execFileAsync("ffmpeg", ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-qscale:a", "2", mp3Path]);
    } else if (audioPath.endsWith(".mp3") && existsSync(mp3Path)) {
      await execFileAsync("ffmpeg", ["-y", "-i", mp3Path, wavPath]);
    }
  } catch (err: any) {
    console.warn("[TTS Helper] FFmpeg conversion notice:", err.message);
  }

  return { mp3Path, wavPath };
}

/**
 * Downloads audio from Gemini 3.8 Flash TTS.
 */
async function generateGeminiFlashTTS(
  text: string,
  outputPath: string,
  voiceId: string = "Kore"
): Promise<{ durationSec: number; chunksCount: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });
  const chunks = splitTextIntoChunks(text, 300);
  if (chunks.length === 0) chunks.push(text);

  console.log(`[Gemini-TTS] Generating TTS with ${chunks.length} chunks for voice "${voiceId}"...`);

  if (chunks.length === 1) {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-tts",
      contents: chunks[0],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceId,
            },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio returned from Gemini TTS");
    }

    const audioBuffer = Buffer.from(base64Audio, "base64");
    writeFileSync(outputPath, audioBuffer);

    const wordCount = text.split(/\s+/).length;
    return { durationSec: Math.max(1, wordCount / (130 / 60)), chunksCount: 1 };
  } else {
    // Multi-chunk Gemini TTS with concatenation
    const tempFiles: string[] = [];
    const dir = outputPath.substring(0, Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\")));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let res;
      let retries = 3;
      while (retries > 0) {
        try {
          res = await ai.models.generateContent({
            model: "gemini-3.8-flash-tts",
            contents: chunk,
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceId,
                  },
                },
              },
            },
          });
          break; // Success!
        } catch (err: any) {
          const msg = err.message || "";
          if ((msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) && retries > 1) {
            console.warn(`[Gemini-TTS] Rate limit hit on chunk ${i + 1}. Waiting 5 seconds before retrying...`);
            await new Promise((r) => setTimeout(r, 5000));
            retries--;
          } else {
            throw err; // Out of retries or other error
          }
        }
      }

      const base64Audio = res?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error(`Gemini TTS returned no audio for chunk ${i + 1}`);

      const partPath = resolve(dir, `temp_gemini_part_${i}.mp3`);
      writeFileSync(partPath, Buffer.from(base64Audio, "base64"));
      tempFiles.push(partPath);
      
      // Delay slightly between valid chunks to avoid hitting 15 RPM burst limit
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const listFile = resolve(dir, "temp_concat_list.txt");
    writeFileSync(listFile, tempFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"), "utf-8");
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outputPath]);

    try {
      tempFiles.forEach((f) => unlinkSync(f));
      unlinkSync(listFile);
    } catch {}

    const wordCount = text.split(/\s+/).length;
    return { durationSec: Math.max(1, wordCount / (130 / 60)), chunksCount: chunks.length };
  }
}
/**
 * Downloads audio from Google Translate TTS (used as Gemini/Google API fallback).
 */
async function generateGoogleTTS(text: string, outputPath: string): Promise<number> {
  const chunks = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+\s*/g)?.map((s) => s.trim()).filter(Boolean) || [text];
  const buffers: Buffer[] = [];

  for (let chunk of chunks) {
    while (chunk.length > 0) {
      const slice = chunk.substring(0, 200);
      chunk = chunk.substring(200);

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(slice)}&tl=vi&client=tw-ob`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) {
          const arr = await res.arrayBuffer();
          buffers.push(Buffer.from(arr));
        }
      } catch (err) {
        console.error("Google TTS chunk failed:", err);
      }
    }
  }

  const finalBuffer = Buffer.concat(buffers);
  writeFileSync(outputPath, finalBuffer);

  const wordCount = text.split(/\s+/).length;
  return Math.max(1, wordCount / (130 / 60));
}

/**
 * Uses VieNeu-TTS local server with sentence chunking for high-speed synthesis.
 */
async function generateVieNeuTTS(
  text: string,
  outputPath: string,
  voiceId: string = "Hải Đăng"
): Promise<{ durationSec: number; chunksCount: number }> {
  const url = process.env.VIENEU_TTS_URL || "http://127.0.0.1:8000/v1/audio/speech";

  if (!voiceId || voiceId === "default") {
    voiceId = "Hải Đăng";
  }

  // Split into chunks of ~20 words each
  const chunks = splitTextIntoChunks(text, 20);
  if (chunks.length === 0) chunks.push(text);

  console.log(`[VieNeu-TTS] Phân nhỏ thành ${chunks.length} chunks để tổng hợp với giọng "${voiceId}"...`);

  const buffers: Buffer[] = [];
  let totalDataLen = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.trim()) continue;

    console.log(`[VieNeu-TTS] Đang xử lý chunk ${i + 1}/${chunks.length} (${chunk.split(/\s+/).length} từ)...`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "vieneu-tts",
        input: chunk,
        voice: voiceId,
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`VieNeu-TTS chunk ${i + 1}/${chunks.length} thất bại (${res.status}): ${errText}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buffers.length === 0) {
      buffers.push(buf);
      totalDataLen += buf.length - 44;
    } else {
      buffers.push(buf.subarray(44));
      totalDataLen += buf.length - 44;
    }
  }

  if (buffers.length === 0) return { durationSec: 0, chunksCount: 0 };

  const finalBuffer = Buffer.concat(buffers);
  // Fix WAV header sizes
  finalBuffer.writeUInt32LE(36 + totalDataLen, 4);
  finalBuffer.writeUInt32LE(totalDataLen, 40);

  const wavPath = outputPath.endsWith(".wav") ? outputPath : outputPath.replace(/\.mp3$/i, ".wav");
  writeFileSync(wavPath, finalBuffer);

  // Exact duration based on 48kHz, 16bit, mono (96000 bytes/sec)
  const exactDuration = Math.max(1, totalDataLen / 96000);
  return { durationSec: exactDuration, chunksCount: chunks.length };
}

/**
 * Strips all XML/HTML tags (like <sigh>, <laugh>, <breath>) and bracket tags (like [enthusiasm], [cười])
 * to prevent VieNeu from literally pronouncing punctuation words like "dấu nhỏ hơn", "dấu lớn hơn", etc.
 */
export function stripAllEmotionTags(text: string): string {
  if (!text) return "";
  return text
    // Strip XML/HTML-like tags: <laugh>, <sigh>, <breath>, <short pause>, or any <...>
    .replace(/<[^>]+>/g, "")
    // Strip all bracket tags like [enthusiasm], [sadness], [cười], [thở dài], [hắng giọng]
    .replace(/\[[^\]]*\]/g, "")
    // Clean up excessive whitespace before punctuation
    .replace(/\s+([,.;!?…])/g, (_, p) => p)
    // Clean up multiple spaces
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

const GEMINI_VOICES = new Set(["Kore", "Puck", "Charon", "Aoede", "Fenrir"]);

export async function generateTTS(
  text: string,
  outputPath: string,
  voiceId: string = "Hải Đăng",
  model: string = "auto"
): Promise<{
  durationSec: number;
  ext: string;
  chunksCount: number;
  isFallback?: boolean;
  fallbackVoice?: string;
  fallbackModel?: string;
  cleanedText?: string;
  warning?: string;
}> {
  if (!voiceId || voiceId === "default") {
    voiceId = "Hải Đăng";
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isGeminiVoice = GEMINI_VOICES.has(voiceId);
  const useGemini = model === "gemini" || (model === "auto" && isGeminiVoice && Boolean(apiKey));

  let result: { durationSec: number; chunksCount: number };
  let primaryAudioPath: string;
  let geminiQuotaExceeded = false;

  if (useGemini) {
    const geminiVoice = isGeminiVoice ? voiceId : "Kore";
    console.log(`Using Gemini 3.8 Flash TTS via API Key: ${apiKey ? apiKey.substring(0, 10) : "NO-KEY"}... with voice: ${geminiVoice}...`);
    try {
      primaryAudioPath = outputPath.replace(/\.wav$/i, ".mp3");
      result = await generateGeminiFlashTTS(text, primaryAudioPath, geminiVoice);
      await ensureMp3AndWav(primaryAudioPath);
      return { durationSec: result.durationSec, ext: "mp3", chunksCount: result.chunksCount };
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429") || errMsg.includes("quota")) {
        geminiQuotaExceeded = true;
        console.warn(`[TTS] Gemini TTS 429 Error Details: ${errMsg}`);
        console.warn(`[TTS] Gemini TTS đã hết hạn mức (429 Quota Exceeded). Tự động chuyển hướng sang VieNeu-TTS Local...`);
      } else {
        console.warn(`[TTS] Gemini TTS failed: ${errMsg}. Tự động fallback sang VieNeu-TTS...`);
      }
    }
  }

  // VieNeu-TTS Local Server
  // If voiceId is a Gemini voice (e.g. Kore) or unknown, normalize to default VieNeu voice "Hải Đăng"
  const isFallback = geminiQuotaExceeded || (isGeminiVoice && !useGemini);
  const vieneuVoice = GEMINI_VOICES.has(voiceId) ? "Hải Đăng" : voiceId;

  // CRITICAL: When falling back to VieNeu from Gemini, remove ALL emotion tags
  // so VieNeu NEVER pronounces "dấu nhỏ hơn sigh dấu lớn hơn" or other tag artifacts!
  const textForVieNeu = isFallback ? stripAllEmotionTags(text) : text;
  if (isFallback) {
    console.log(`[TTS Fallback] Đã loại bỏ toàn bộ tag cảm xúc để tránh VieNeu đọc thành 'dấu nhỏ hơn, dấu lớn hơn'.`);
  }

  console.log(`Using VieNeu-TTS local server with voice: ${vieneuVoice}...`);
  try {
    primaryAudioPath = outputPath.replace(/\.mp3$/i, ".wav");
    result = await generateVieNeuTTS(textForVieNeu, primaryAudioPath, vieneuVoice);
    await ensureMp3AndWav(primaryAudioPath);
    return { 
      durationSec: result.durationSec, 
      ext: "mp3", 
      chunksCount: result.chunksCount,
      isFallback,
      fallbackVoice: isFallback ? vieneuVoice : undefined,
      fallbackModel: isFallback ? "vieneu" : undefined,
      cleanedText: isFallback ? textForVieNeu : undefined,
      warning: isFallback 
        ? `Google Gemini TTS đã hết quota trong ngày (429 Quota Exceeded). Hệ thống đã tự động chuyển sang giọng VieNeu Local (${vieneuVoice}) và gỡ bỏ các thẻ cảm xúc để tránh phát âm thành 'dấu nhỏ hơn, dấu bé hơn'.` 
        : undefined
    };
  } catch (err: any) {
    console.error("VieNeu-TTS failed, falling back to Google TTS if possible:", err.message);
    if (apiKey && !geminiQuotaExceeded) {
      primaryAudioPath = outputPath.replace(/\.wav$/i, ".mp3");
      const duration = await generateGoogleTTS(text, primaryAudioPath);
      await ensureMp3AndWav(primaryAudioPath);
      const chunks = splitTextIntoChunks(text, 20);
      return { durationSec: duration, ext: "mp3", chunksCount: chunks.length };
    }

    if (geminiQuotaExceeded) {
      throw new Error(`Google Gemini TTS đã hết hạn mức miễn phí trong ngày (429 Quota Exceeded), và server VieNeu-TTS local (cổng 8000) gặp lỗi: ${err.message}. Vui lòng kiểm tra tiến trình VieNeu-TTS.`);
    }
    throw err;
  }
}

export function generateSrtAndWords(text: string, durationSec: number): { srt: string; words: any[] } {
  const words = text.split(/\s+/).filter(Boolean);
  const timePerWord = durationSec / words.length;

  let srtContent = "";
  let currentTime = 0;

  const wordTimings = words.map((w, idx) => {
    const startSec = currentTime;
    const endSec = currentTime + timePerWord;
    currentTime = endSec;

    return {
      id: `w${idx + 1}`,
      text: w,
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      confidence: 0.99,
    };
  });

  // Group words into SRT captions (e.g., 5 words per caption)
  let captionIndex = 1;
  for (let i = 0; i < wordTimings.length; i += 5) {
    const chunk = wordTimings.slice(i, i + 5);
    const start = chunk[0].startSec;
    const end = chunk[chunk.length - 1].endSec;
    const textChunk = chunk.map((w) => w.text).join(" ");

    srtContent += `${captionIndex}\n`;
    srtContent += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`;
    srtContent += `${textChunk}\n\n`;
    captionIndex++;
  }

  return { srt: srtContent, words: wordTimings };
}

function formatSrtTime(seconds: number): string {
  const d = new Date(seconds * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}
