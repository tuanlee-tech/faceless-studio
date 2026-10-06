import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { GoogleGenAI } from "@google/genai";

/**
 * Downloads audio from Gemini 3.8 Flash TTS.
 */
async function generateGeminiFlashTTS(text: string, outputPath: string, voiceId: string = "Kore"): Promise<number> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash-tts",
    contents: text,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceId,
          }
        }
      }
    }
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio returned from Gemini TTS");
  }
  
  const audioBuffer = Buffer.from(base64Audio, "base64");
  writeFileSync(outputPath, audioBuffer);
  
  // Estimate duration (Vietnamese speech rate ~130 wpm)
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, wordCount / (130 / 60));
}

/**
 * Downloads audio from Google Translate TTS (used as Gemini/Google API fallback).
 * Splits text into chunks of < 200 chars to avoid limits.
 */
async function generateGoogleTTS(text: string, outputPath: string): Promise<number> {
  const chunks = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+\s*/g)?.map(s => s.trim()).filter(Boolean) || [text];
  
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
  
  // Estimate duration
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, wordCount / (130 / 60));
}

/**
 * Uses VieNeu-TTS local server (OpenAI compatible endpoint).
 */
async function generateVieNeuTTS(text: string, outputPath: string, voiceId: string = "Thiện Minh"): Promise<number> {
  const url = process.env.VIENEU_TTS_URL || "http://127.0.0.1:8000/v1/audio/speech";
  
  // Split into chunks by sentence/newline
  const chunks = text.match(/[^.!?\n]+[.!?\n]+|\s*[^.!?\n]+\s*/g)?.map(s => s.trim()).filter(Boolean) || [text];
  
  const buffers: Buffer[] = [];
  let totalDataLen = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "vieneu-tts",
        input: chunk,
        voice: voiceId,
        response_format: "wav"
      })
    });

    if (!res.ok) {
      throw new Error(`VieNeu-TTS chunk failed: ${res.statusText}`);
    }

    let buf = Buffer.from(await res.arrayBuffer());
    if (i === 0) {
      buffers.push(buf);
      totalDataLen += (buf.length - 44);
    } else {
      buffers.push(buf.subarray(44));
      totalDataLen += (buf.length - 44);
    }
  }

  if (buffers.length === 0) return 0;

  const finalBuffer = Buffer.concat(buffers);
  // Fix WAV header sizes
  finalBuffer.writeUInt32LE(36 + totalDataLen, 4);
  finalBuffer.writeUInt32LE(totalDataLen, 40);

  writeFileSync(outputPath, finalBuffer);

  // Estimate duration (Vietnamese speech rate ~130 wpm)
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, wordCount / (130 / 60));
}

export async function generateTTS(text: string, outputPath: string, voiceId: string = "Thiện Minh", model: string = "auto"): Promise<{ durationSec: number, ext: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (model === "gemini" || (model === "auto" && apiKey)) {
    console.log("Using Gemini 3.8 Flash TTS via API Key...");
    try {
      const duration = await generateGeminiFlashTTS(text, outputPath.replace(".wav", ".mp3"), voiceId);
      return { durationSec: duration, ext: "mp3" };
    } catch (err) {
      if (model === "gemini") throw err;
      console.error("Gemini TTS failed, falling back to VieNeu-TTS:", err);
    }
  }
  
  console.log(`Using VieNeu-TTS local server with voice: ${voiceId}...`);
  try {
    const duration = await generateVieNeuTTS(text, outputPath.replace(".mp3", ".wav"), voiceId);
    return { durationSec: duration, ext: "wav" };
  } catch (err) {
    console.error("VieNeu-TTS failed, falling back to Google TTS if possible:", err);
    if (apiKey) {
      const duration = await generateGoogleTTS(text, outputPath.replace(".wav", ".mp3"));
      return { durationSec: duration, ext: "mp3" };
    }
    throw err;
  }
}

export function generateSrtAndWords(text: string, durationSec: number): { srt: string, words: any[] } {
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
      confidence: 0.99
    };
  });
  
  // Group words into SRT captions (e.g., 5 words per caption)
  let captionIndex = 1;
  for (let i = 0; i < wordTimings.length; i += 5) {
    const chunk = wordTimings.slice(i, i + 5);
    const start = chunk[0].startSec;
    const end = chunk[chunk.length - 1].endSec;
    const textChunk = chunk.map(w => w.text).join(" ");
    
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
