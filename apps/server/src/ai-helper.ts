import { existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AssetManager, type AssetManifestItem } from "@faceless/core";

const execFileAsync = promisify(execFile);

export interface GenerateJsonOptions {
  stage: string;
  prompt: string;
  topic?: string;
  template?: string;
  previousResults?: Record<string, any>;
}

export async function generateStageJsonFromPrompt(
  options: GenerateJsonOptions
): Promise<any> {
  const { stage, prompt, topic = "psychology", template = "baroque-mono", previousResults = {} } = options;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const result = await callGeminiForJson(stage, prompt, apiKey, previousResults);
      if (result) return result;
    } catch (err) {
      console.warn("Gemini API call failed, falling back to smart engine:", err);
    }
  }

  // Smart Context-Aware Fallback Engine
  return smartGenerateJson(stage, prompt, topic, template, previousResults);
}

async function callGeminiForJson(
  stage: string,
  userPrompt: string,
  apiKey: string,
  previousResults: Record<string, any>
): Promise<any> {
  const schemaInstructions: Record<string, string> = {
    outline: `Output valid JSON matching: { title: string, points: string[], sections: Array<{ id: string, name: string, purpose: string, estimatedSeconds: number }> }`,
    script: `Output valid JSON matching: { title: string, content: string, sections: Array<{ id: string, heading: string, text: string }> }`,
    direct: `Output valid JSON matching: { styleLock: string, beats: Array<{ id: string, layout: string, durationHint: "long"|"medium"|"short", directorNote: string, visualPrompt: string }>, visuals: Array<{ id: string, prompt: string, aspectRatio: string }> }. You MUST generate at least one beat for each section in the script (usually 3-5 beats total) to cover the entire story. The "styleLock" field is a short reusable art-style string (e.g. "Baroque monochrome chiaroscuro, Caravaggio lighting, black-and-white, film grain") that MUST be prepended to EVERY beat's visualPrompt. Each beat's visualPrompt MUST describe a UNIQUE scene specific to THAT beat's content — never copy the same description across beats. durationHint indicates scene importance: "long" for key scenes, "short" for transitions.`,
    spec: `Output valid VideoSpec JSON matching: { specVersion: "0.1.0", projectSlug: string, topicId: string, templateId: string, fps: 30, narration: { audioPath: string, durationSec: number, words: Array<{ id: string, text: string, startSec: number, endSec: number, confidence: number }> }, chapters: Array<{ id: string, title: string, beats: Array<{ id: string, range: { startWordId: string, endWordId: string }, layout: string, directorNote: string, visualPrompt: string, captions: Array<{ id: string, wordIds: string[] }> }> }>, music: [] }. IMPORTANT: Keep ALL beats, directorNotes, and visualPrompts from the previous 'direct' stage. You must map the narration words across ALL of these beats.`,
  };

  const instruction = schemaInstructions[stage] || "Output valid structured JSON object.";
  const rules = `
CRITICAL RULES FOR SCENES AND VISUAL PROMPTS:
- 1 scene = 1 main visual concept. Do not literally illustrate every single word.
- Prioritize visuals with action, contrast, expression, or state changes.
- Keep important scenes longer; transition scenes can be shorter.
- If characters recur, use a consistent Character ID in your description.
- DO NOT change the art style between scenes. Lock the visual style into the prompt (e.g. consistently add "baroque monochrome styling" or whatever style is requested).
- DO NOT add text, fonts, or typography into the images unless strictly required.
- Do not use too many characters in a single frame unless necessary.
`;
  const promptBody = `You are an expert video director. Based on user prompt: "${userPrompt}", generate video ${stage} configuration in Vietnamese.\n\n${rules}\n\n${instruction}\nContext from previous steps: ${JSON.stringify(previousResults)}\nReturn ONLY pure JSON, no markdown backticks, no comments.`;

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const CANDIDATE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"];
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: promptBody,
        config: {
          responseMimeType: "application/json",
        },
      });

      const rawText = response.text;
      if (rawText) {
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
        return JSON.parse(cleaned);
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI-Helper] Gemini model ${model} failed, trying next fallback:`, err.message);
    }
  }

  throw lastError || new Error("Failed to generate content with Gemini models");
}

function smartGenerateJson(
  stage: string,
  userPrompt: string,
  topic: string,
  template: string,
  previousResults: Record<string, any>
): any {
  const cleanPrompt = userPrompt.trim();
  const title = cleanPrompt.length > 5 && cleanPrompt.length < 80
    ? cleanPrompt
    : cleanPrompt.split(/[.,;\n]/)[0]?.trim() || "Chủ đề Video Faceless";

  switch (stage) {
    case "outline": {
      return {
        title,
        points: [
          `Mở đầu gây tò mò: ${title}`,
          `Phân tích cốt lõi & cơ chế hoạt động`,
          `Ví dụ minh họa thực tế dễ hiểu`,
          `Bài học sâu sắc & đúc kết hành động`,
        ],
        sections: [
          {
            id: "s1",
            name: "Mở đầu hấp dẫn",
            purpose: "Gây chú ý ngay trong 3 giây đầu tiên với câu hỏi hoặc nghịch lý",
            estimatedSeconds: 15,
          },
          {
            id: "s2",
            name: "Phân tích chuyên sâu",
            purpose: "Làm rõ bản chất và nguyên nhân vì sao hiện tượng xảy ra",
            estimatedSeconds: 25,
          },
          {
            id: "s3",
            name: "Ví dụ trực quan",
            purpose: "Dẫn chứng sinh động giúp người xem liên hệ bản thân",
            estimatedSeconds: 25,
          },
          {
            id: "s4",
            name: "Đúc kết & Hành động",
            purpose: "Lời khuyên thực tiễn và thông điệp truyền cảm hứng",
            estimatedSeconds: 15,
          },
        ],
      };
    }

    case "script": {
      const outline = previousResults.outline;
      const scriptTitle = outline?.title || title;
      const content = `Bạn có bao giờ tự hỏi: vì sao ${scriptTitle.toLowerCase()} lại có sức ảnh hưởng mạnh mẽ đến cuộc sống của chúng ta? Trong thực tế, hầu hết chúng ta đều từng trải qua cảm giác này mà không hề nhận ra. Khi hiểu được bản chất của vấn đề, bạn sẽ có một góc nhìn hoàn toàn mới. Hãy nhớ rằng, sự thông tuệ bắt đầu từ việc thấu hiểu chính mình và không ngừng học hỏi mỗi ngày.`;

      return {
        title: scriptTitle,
        content,
        sections: [
          {
            id: "s1",
            heading: "Mở đầu",
            text: `Bạn có bao giờ tự hỏi: vì sao ${scriptTitle.toLowerCase()} lại có sức ảnh hưởng mạnh mẽ đến chúng ta?`,
          },
          {
            id: "s2",
            heading: "Bản chất vấn đề",
            text: "Trong thực tế, hầu hết chúng ta đều từng trải qua điều này mà không hề nhận ra.",
          },
          {
            id: "s3",
            heading: "Góc nhìn sâu sắc",
            text: "Khi hiểu được quy luật ẩn giấu phía sau, bạn sẽ có một lăng kính hoàn toàn khác biệt.",
          },
          {
            id: "s4",
            heading: "Đúc kết",
            text: "Sự thông tuệ bắt đầu từ việc thấu hiểu chính mình và không ngừng học hỏi mỗi ngày.",
          },
        ],
      };
    }

    case "direct": {
      const script = previousResults.script;
      const sections = script?.sections || [];
      const templateId = template || "baroque-mono";
      const isMono = templateId.includes("mono") || templateId.includes("baroque");

      const styleLock = isMono
        ? "Baroque monochrome chiaroscuro, dramatic Caravaggio lighting, high-contrast black-and-white, rich deep blacks, crisp ivory highlights, atmospheric volumetric fog, subtle film grain"
        : "Contemporary cinematic realism, minimalist composition, clean negative space, soft ambient studio lighting, premium editorial color grading";

      // Map each script section to a unique beat with a specific visual
      const sectionVisuals: Array<{ id: string; layout: string; durationHint: string; directorNote: string; visualSubject: string }> = [];

      if (sections.length > 0) {
        sections.forEach((sec: any, idx: number) => {
          const beatId = `b${idx + 1}`;
          const layouts = ["title-card", "split-left", "center-text", "split-right"];
          const durations = idx === 0 ? "medium" : idx === sections.length - 1 ? "medium" : "long";
          
          // Generate a conceptual visual based on the heading/index rather than raw script text
          let conceptVisual = "";
          if (idx === 0) conceptVisual = `A cinematic hook moment establishing the concept of ${sec.heading || title}, mysterious atmosphere, single subject in thought`;
          else if (idx === sections.length - 1) conceptVisual = `A serene resolution scene representing ${sec.heading || "conclusion"}, dawn light illuminating a path forward, feeling of clarity`;
          else conceptVisual = `A revealing close-up showing the internal mechanisms and abstract patterns related to ${sec.heading || "analysis"}, scholarly and analytical atmosphere`;

          sectionVisuals.push({
            id: beatId,
            layout: layouts[idx % layouts.length],
            durationHint: durations,
            directorNote: sec.heading ? `${sec.heading}: ${sec.text?.slice(0, 60) || ""}` : `Beat ${beatId} — ${title}`,
            visualSubject: conceptVisual,
          });
        });
      } else {
        // Fallback: generate 3 default beats from title
        sectionVisuals.push(
          { id: "b1", layout: "title-card", durationHint: "medium", directorNote: `Mở đầu ấn tượng: ${title}`, visualSubject: `A hook moment capturing the core question of ${title}, a single figure facing a vast symbolic environment` },
          { id: "b2", layout: "split-left", durationHint: "long", directorNote: `Phân tích chuyên sâu: ${title}`, visualSubject: `A revealing close-up showing the internal mechanisms and hidden patterns behind ${title}, scholarly analytical atmosphere` },
          { id: "b3", layout: "center-text", durationHint: "medium", directorNote: `Đúc kết & Bài học: ${title}`, visualSubject: `A serene resolution scene — dawn light illuminating a path forward, symbolizing clarity and newfound wisdom after understanding ${title}` },
        );
      }

      const beats = sectionVisuals.map((sv) => ({
        id: sv.id,
        layout: sv.layout,
        durationHint: sv.durationHint,
        cameraMotion: sv.layout === "title-card" ? "slow-zoom-in" : sv.layout === "split-left" ? "pan-right" : "subtle-drift",
        directorNote: sv.directorNote,
        visualPrompt: `${sv.visualSubject}. ${styleLock}. cinematic wide shot, 35mm anamorphic lens, f/1.8, shallow depth of field, hyper-detailed texture, 8k resolution`,
      }));

      const visuals = beats.map((b) => ({
        id: b.id,
        prompt: b.visualPrompt,
        aspectRatio: "16:9",
      }));

      return { styleLock, beats, visuals };
    }

    case "spec": {
      const script = previousResults.script;
      const direct = previousResults.direct;
      const slug = previousResults.slug || "demo-project";
      const projDir = resolve(process.cwd(), "projects", slug);

      let wordList: any[] = [];
      let totalDuration = 0;
      let audioPath = "audio/narration.mp3";

      // 1. Try from previousResults.tts or disk results/tts.json
      let ttsSource = previousResults.tts;
      if (!ttsSource && existsSync(resolve(projDir, "results/tts.json"))) {
        try {
          ttsSource = JSON.parse(readFileSync(resolve(projDir, "results/tts.json"), "utf-8"));
        } catch {}
      }

      if (ttsSource && ttsSource.words && ttsSource.words.length > 0) {
        wordList = ttsSource.words;
        totalDuration = ttsSource.durationSec || wordList[wordList.length - 1].endSec;
        audioPath = ttsSource.audioPath || (existsSync(resolve(projDir, "audio/narration.mp3")) ? "audio/narration.mp3" : "audio/narration.wav");
      } else {
        const wordsText = script?.content || `Khám phá bí mật về ${title} và những bài học đắt giá cho cuộc sống`;
        const tokens = wordsText.split(/\s+/).filter(Boolean);
        let currentTime = 0;
        wordList = tokens.map((tok: string, idx: number) => {
          const start = Math.round(currentTime * 100) / 100;
          const dur = Math.max(0.3, Math.min(0.7, tok.length * 0.08));
          currentTime += dur;
          const end = Math.round(currentTime * 100) / 100;
          return {
            id: `w${idx + 1}`,
            text: tok,
            startSec: start,
            endSec: end,
            confidence: 0.98,
          };
        });
        totalDuration = Math.ceil(currentTime) + 1;
      }

      // Check manifest for assets
      const manifestMap = new Map<string, any>();
      const manifestPath = resolve(projDir, "assets/manifest.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          for (const a of manifest.assets || []) {
            manifestMap.set(a.beatId || a.id, a);
          }
        } catch {}
      }

      const directBeats = direct?.beats || [];
      const numBeats = directBeats.length > 0 ? directBeats.length : 1;
      const wordsPerBeat = Math.ceil(wordList.length / numBeats);

      const specBeats = directBeats.map((db: any, index: number) => {
        const startIdx = index * wordsPerBeat;
        const endIdx = Math.min((index + 1) * wordsPerBeat - 1, wordList.length - 1);
        const beatAsset = manifestMap.get(db.id);
        const assets = beatAsset
          ? [
              {
                assetId: beatAsset.id,
                filePath: beatAsset.filePath,
                kind: beatAsset.kind || "image",
                license: beatAsset.license || "CC0",
              },
            ]
          : [];

        return {
          id: db.id,
          range: {
            startWordId: wordList[startIdx]?.id || "w1",
            endWordId: wordList[endIdx]?.id || "w1",
          },
          layout: db.layout,
          directorNote: db.directorNote,
          visualPrompt: db.visualPrompt,
          assets,
          captions: [
            {
              id: `cap${index + 1}`,
              wordIds: wordList.slice(startIdx, endIdx + 1).map((w: any) => w.id),
            },
          ],
        };
      });

      return {
        specVersion: "0.1.0",
        projectSlug: slug,
        topicId: topic,
        templateId: template,
        fps: 30,
        narration: {
          audioPath,
          durationSec: totalDuration,
          words: wordList,
        },
        chapters: [
          {
            id: "c1",
            title,
            short_candidate: true,
            beats: specBeats,
          },
        ],
        music: [],
        meta: {
          title,
          description: `Video tạo tự động bởi Faceless Studio cho chủ đề ${title}`,
        },
      };
    }

    default:
      return { stage, prompt: userPrompt };
  }
}

export async function generateAiAssetImage(options: {
  slug: string;
  beatId: string;
  promptText: string;
  templateId?: string;
  baseDir?: string;
}): Promise<{
  success: boolean;
  beatId: string;
  fileName: string;
  source: string;
  hasApiKey: boolean;
}> {
  const { slug, beatId, promptText, templateId = "baroque-mono", baseDir = "projects" } = options;
  const am = new AssetManager(baseDir);
  const { processedDir } = am.initAssetDirs(slug);
  const outFileName = `${beatId}.png`;
  const outFilePath = resolve(processedDir, outFileName);

  const apiKey = process.env.IMAGE_GENERATION_API_KEY || process.env.GEMINI_API_KEY;
  let source = "";

  if (!apiKey) {
    throw new Error("Vui lòng cấu hình IMAGE_GENERATION_API_KEY (hoặc GEMINI_API_KEY) trong file .env để sử dụng tính năng tạo ảnh AI.");
  }

  try {
    // Try Imagen generation via Gemini API if supported
    const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
    const res = await fetch(imagenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: promptText }],
        parameters: { sampleCount: 1, aspectRatio: "16:9", outputMimeType: "image/png" },
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
      if (b64) {
        writeFileSync(outFilePath, Buffer.from(b64, "base64"));
        source = "gemini-imagen";
      } else {
        throw new Error("API trả về thành công nhưng không có dữ liệu ảnh hợp lệ.");
      }
    } else {
      const errorData = await res.text();
      throw new Error(`Lỗi từ API tạo ảnh: ${res.status} - ${errorData}`);
    }
  } catch (err: any) {
    throw new Error(`Không thể tạo ảnh AI: ${err.message}`);
  }

  // Update Manifest
  const manifest = am.loadManifest(slug);
  const existingIdx = manifest.assets.findIndex(
    (a) => a.id === beatId || a.fileName === outFileName
  );

  const assetEntry: AssetManifestItem = {
    id: beatId,
    beatId,
    kind: "image",
    fileName: outFileName,
    filePath: `assets/processed/${outFileName}`,
    source: "ai",
    license: "custom-ai",
    prompt: promptText,
    importedAt: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    manifest.assets[existingIdx] = assetEntry;
  } else {
    manifest.assets.push(assetEntry);
  }

  am.saveManifest(slug, manifest);

  return {
    success: true,
    beatId,
    fileName: outFileName,
    source,
    hasApiKey: Boolean(apiKey),
  };
}
