import React, { useState, useEffect } from "react";
import { Radio, Loader2, Volume2, Wand2, Headphones, Play, X, Download, ArrowRight, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { api } from "../api/client.js";

const GEMINI_VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir"];

const SAMPLE_PRESETS = [
  { label: "Chào mừng", text: "Chào mừng các bạn đã quay trở lại với kênh Faceless Studio!" },
  { label: "Kể chuyện", text: "Trong màn đêm tĩnh mịch [thở dài], một điều bí ẩn bất ngờ xuất hiện..." },
  { label: "Hài hước", text: "Thật không thể tin được [cười], chuyện này quá hài hước luôn!" },
];

function getEstimatedChunksCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const sents = text.split(/(?<=[.!?…\n])\s+/).map((s) => s.trim()).filter(Boolean);
  return Math.max(1, sents.length);
}

function convertEmotionTags(text: string, toEngine: "vieneu" | "gemini"): string {
  if (!text) return text;
  if (toEngine === "vieneu") {
    return text
      .replace(/<\s*laugh\s*>/gi, "[cười]")
      .replace(/<\s*sigh\s*>/gi, "[thở dài]")
      .replace(/<\s*breath\s*>/gi, "[hắng giọng]")
      .replace(/<\s*short pause\s*>/gi, "[hắng giọng]")
      .replace(/\[\s*enthusiasm\s*\]/gi, "[cười]")
      .replace(/\[\s*sadness\s*\]/gi, "[thở dài]")
      .replace(/\[\s*anger\s*\]/gi, "")
      .replace(/\[\s*neutral\s*\]/gi, "")
      .replace(/[ ]{2,}/g, " ")
      .trim();
  } else {
    return text
      .replace(/\[\s*cười\s*\]/gi, "<laugh>")
      .replace(/\[\s*thở dài\s*\]/gi, "<sigh>")
      .replace(/\[\s*hắng giọng\s*\]/gi, "<breath>")
      .replace(/[ ]{2,}/g, " ")
      .trim();
  }
}

interface TTSGeneratorProps {
  slug: string;
  onRefreshProject: () => void;
  onNotify: (type: "success" | "error", msg: string) => void;
  onComplete: () => void;
}

export const TTSGenerator: React.FC<TTSGeneratorProps> = ({ slug, onRefreshProject, onNotify, onComplete }) => {
  const [ttsModel, setTtsModel] = useState("auto");
  const [voiceId, setVoiceId] = useState("Hải Đăng");
  const [ttsText, setTtsText] = useState("");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [previewText, setPreviewText] = useState("Chào các bạn, hôm nay chúng ta sẽ tìm hiểu một chủ đề rất thú vị.");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState("");
  const [previewVoiceId, setPreviewVoiceId] = useState("");
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState("");
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsMetadata, setTtsMetadata] = useState<{
    durationSec: number;
    chunksCount: number;
    format: string;
    voiceId: string;
  } | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<{
    active: boolean;
    originalVoice: string;
    fallbackVoice: string;
    reason: string;
    details: string;
  } | null>(null);

  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  const vieneuTags = [
    { tag: "[cười]", desc: "Vui vẻ, tươi tắn" },
    { tag: "[thở dài]", desc: "Mệt mỏi, chán nản, luyến tiếc" },
    { tag: "[hắng giọng]", desc: "Ngắt quãng tự nhiên (e hèm)" }
  ];

  const geminiTags = [
    { tag: "[enthusiasm]", desc: "Hào hứng, nhiệt huyết" },
    { tag: "[sadness]", desc: "Buồn bã" },
    { tag: "[anger]", desc: "Tức giận" },
    { tag: "<laugh>", desc: "Cười thành tiếng" },
    { tag: "<sigh>", desc: "Thở dài" },
    { tag: "<breath>", desc: "Lấy hơi" }
  ];

  const isGemini = GEMINI_VOICES.includes(voiceId) || ttsModel === "gemini";
  const activeTags = isGemini ? geminiTags : vieneuTags;

  useEffect(() => {
    api.getProject(slug)
      .then((res) => {
        const projVoice = res.project?.config?.voice;
        if (projVoice && projVoice !== "default") {
          setVoiceId(projVoice);
        }
      })
      .catch(() => { });

    api.getTaskResult(slug, "002", "script")
      .then((res) => {
        if (res.hasResult && res.result && res.result.content) {
          setTtsText(res.result.content);
        } else {
          setTtsText("");
        }
      })
      .catch(() => { });

    const audioMp3Url = `http://localhost:3005/projects/${slug}/audio/narration.mp3`;
    const audioWavUrl = `http://localhost:3005/projects/${slug}/audio/narration.wav`;
    fetch(audioMp3Url, { method: "HEAD" })
      .then((res) => {
        if (res.ok) {
          setGeneratedAudioUrl(`${audioMp3Url}?t=${Date.now()}`);
          setTtsMetadata((prev) => prev || { durationSec: 0, chunksCount: 1, format: "MP3", voiceId });
        } else {
          fetch(audioWavUrl, { method: "HEAD" })
            .then((r2) => {
              if (r2.ok) {
                setGeneratedAudioUrl(`${audioWavUrl}?t=${Date.now()}`);
                setTtsMetadata((prev) => prev || { durationSec: 0, chunksCount: 1, format: "WAV", voiceId });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [slug]);

  const handleGenerateDraft = async () => {
    setIsGeneratingDraft(true);
    try {
      const res = await fetch(`http://localhost:3005/projects/${slug}/tts/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ttsModel,
          voiceId: voiceId,
          currentText: ttsText
        })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setTtsText(data.text);
        onNotify(
          "success",
          `✨ Agent Sáng Tạo: Đã tự động chèn tag cảm xúc chuẩn ${isGemini ? "Gemini Cloud" : "VieNeu Local"} vào kịch bản!`
        );
      } else {
        onNotify("error", `Lỗi: ${data.error || "Không thể tạo draft"}`);
      }
    } catch (err: any) {
      onNotify("error", `Lỗi: ${err.message}`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handlePreviewTts = async (customVoiceId?: string, customModel?: string) => {
    if (!previewText.trim() || previewText.length > 100) return;
    const targetVoice = customVoiceId || voiceId;
    const targetModel = customModel || ttsModel;

    setIsPreviewing(true);
    setPreviewAudioUrl("");
    try {
      const res = await fetch(`http://localhost:3005/projects/${slug}/tts/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: previewText, voiceId: targetVoice, model: targetModel }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewAudioUrl(data.audioUrl);
        setPreviewVoiceId(targetVoice);

        if (data.isFallback) {
          if (data.fallbackVoice) {
            setVoiceId(data.fallbackVoice);
            setPreviewVoiceId(data.fallbackVoice);
          }
          if (data.fallbackModel) {
            setTtsModel(data.fallbackModel);
          }
          if (data.cleanedText) {
            setPreviewText(data.cleanedText);
          }
          setFallbackInfo({
            active: true,
            originalVoice: targetVoice,
            fallbackVoice: data.fallbackVoice || "Hải Đăng",
            reason: "Google Gemini TTS đã vượt quá hạn mức sử dụng (429 Quota Exceeded: tối đa 10 lượt/ngày).",
            details: "Hệ thống đã tự động chuyển sang giọng VieNeu Local (" + (data.fallbackVoice || "Hải Đăng") + "), đồng thời loại bỏ các tag <sigh>, <laugh>... để VieNeu không đọc thành 'dấu nhỏ hơn, dấu bé hơn'."
          });
          onNotify("success", `⚠️ ${data.warning || "Đã tự động chuyển sang VieNeu Local do Gemini hết quota!"}`);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      onNotify("error", `Lỗi preview TTS: ${err.message}`);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleTriggerPreview = async () => {
    setShouldAutoPlay(true);
    await handlePreviewTts(voiceId, ttsModel);
  };

  const handleVoiceChange = (newVoice: string) => {
    const prevEngine = (GEMINI_VOICES.includes(voiceId) || ttsModel === "gemini") ? "gemini" : "vieneu";
    const nextIsGemini = GEMINI_VOICES.includes(newVoice);
    const nextEngine = nextIsGemini ? "gemini" : "vieneu";

    setVoiceId(newVoice);
    setShouldAutoPlay(false);

    if (nextIsGemini) {
      if (ttsModel === "vieneu") {
        setTtsModel("gemini");
      }
    } else {
      if (ttsModel === "gemini") {
        setTtsModel("vieneu");
      }
    }

    // Tự động chuyển đổi tag cảm xúc nếu chuyển đổi giữa VieNeu và Gemini
    if (prevEngine !== nextEngine) {
      setTtsText((prev) => {
        const converted = convertEmotionTags(prev, nextEngine);
        if (converted !== prev) {
          onNotify(
            "success",
            `✨ Đã tự động cập nhật tag cảm xúc sang chuẩn ${nextEngine === "vieneu" ? "VieNeu Local" : "Gemini Cloud"} để tránh lỗi lệch cú pháp!`
          );
        }
        return converted;
      });

      setPreviewText((prev) => convertEmotionTags(prev, nextEngine));
    }
  };

  const handleModelChange = (newModel: string) => {
    const prevEngine = (GEMINI_VOICES.includes(voiceId) || ttsModel === "gemini") ? "gemini" : "vieneu";
    setTtsModel(newModel);
    setShouldAutoPlay(false);

    let nextVoice = voiceId;
    if (newModel === "gemini" && !GEMINI_VOICES.includes(voiceId)) {
      nextVoice = "Kore";
      setVoiceId("Kore");
    } else if (newModel === "vieneu" && GEMINI_VOICES.includes(voiceId)) {
      nextVoice = "Hải Đăng";
      setVoiceId("Hải Đăng");
    }

    const nextIsGemini = newModel === "gemini" || (newModel === "auto" && GEMINI_VOICES.includes(nextVoice));
    const nextEngine = nextIsGemini ? "gemini" : "vieneu";

    if (prevEngine !== nextEngine) {
      setTtsText((prev) => {
        const converted = convertEmotionTags(prev, nextEngine);
        if (converted !== prev) {
          onNotify(
            "success",
            `✨ Đã tự động cập nhật tag cảm xúc sang chuẩn ${nextEngine === "vieneu" ? "VieNeu Local" : "Gemini Cloud"}!`
          );
        }
        return converted;
      });

      setPreviewText((prev) => convertEmotionTags(prev, nextEngine));
    }
  };

  const handleGenerateTts = async () => {
    setTtsError(null);
    setIsGeneratingTts(true);
    try {
      const res = await fetch(`http://localhost:3005/projects/${slug}/tts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voiceId, model: ttsModel }),
      });
      const data = await res.json();
      if (data.success) {
        const audioUrl = data.audioUrl || `http://localhost:3005/projects/${slug}/audio/narration.mp3?t=${Date.now()}`;
        setGeneratedAudioUrl(audioUrl);
        const actualVoice = data.isFallback ? (data.fallbackVoice || "Hải Đăng") : voiceId;
        setTtsMetadata({
          durationSec: data.durationSec,
          chunksCount: data.chunksCount || getEstimatedChunksCount(ttsText),
          format: (data.format || "mp3").toUpperCase(),
          voiceId: actualVoice,
        });

        if (data.isFallback) {
          if (data.fallbackVoice) setVoiceId(data.fallbackVoice);
          if (data.fallbackModel) setTtsModel(data.fallbackModel);
          if (data.cleanedText) setTtsText(data.cleanedText);
          setFallbackInfo({
            active: true,
            originalVoice: voiceId,
            fallbackVoice: data.fallbackVoice || "Hải Đăng",
            reason: "Google Gemini TTS đã vượt quá hạn mức miễn phí (429 Quota Exceeded: tối đa 10 lượt/ngày).",
            details: "Hệ thống đã tự động chuyển ô Giọng đọc sang VieNeu Local (" + (data.fallbackVoice || "Hải Đăng") + "), đồng thời loại bỏ các tag <sigh>, <laugh>... để bộ đọc VieNeu không phát âm thành 'dấu nhỏ hơn, dấu bé hơn'."
          });
          onNotify("success", `⚠️ ${data.warning || "Đã tự động chuyển sang VieNeu Local do Gemini hết quota!"}`);
        } else {
          setFallbackInfo(null);
          onNotify(
            "success",
            `✅ Đã tạo Voiceover (${(data.format || "mp3").toUpperCase()}) thành công qua ${data.chunksCount || 1} đoạn! Thời lượng: ${data.durationSec.toFixed(1)}s`
          );
        }
        onRefreshProject();
      } else {
        throw new Error(data.error || "Không thể tạo Audio TTS");
      }
    } catch (err: any) {
      setTtsError(err.message);
      onNotify("error", `Lỗi tạo TTS: ${err.message}`);
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const handleSwitchToVieNeu = (targetVoice: string = "Hải Đăng") => {
    setTtsModel("vieneu");
    setVoiceId(targetVoice);
    const convertedText = convertEmotionTags(ttsText, "vieneu");
    setTtsText(convertedText);
    setPreviewText((prev) => convertEmotionTags(prev, "vieneu"));
    setTtsError(null);
    onNotify("success", `Đã chuyển sang giọng VieNeu-TTS Local (${targetVoice})! Đang tạo lại Audio...`);

    setIsGeneratingTts(true);
    fetch(`http://localhost:3005/projects/${slug}/tts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: convertedText,
        voiceId: targetVoice,
        model: "vieneu",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const audioUrl = data.audioUrl || `http://localhost:3005/projects/${slug}/audio/narration.mp3?t=${Date.now()}`;
          setGeneratedAudioUrl(audioUrl);
          setTtsMetadata({
            durationSec: data.durationSec,
            chunksCount: data.chunksCount || getEstimatedChunksCount(ttsText),
            format: (data.format || "mp3").toUpperCase(),
            voiceId: targetVoice,
          });
          onNotify(
            "success",
            `✅ Đã tạo Voiceover VieNeu-TTS (${targetVoice}) thành công! Thời lượng: ${data.durationSec.toFixed(1)}s`
          );
          onRefreshProject();
        } else {
          setTtsError(data.error);
        }
      })
      .catch((err) => {
        setTtsError(err.message);
      })
      .finally(() => {
        setIsGeneratingTts(false);
      });
  };

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAudio(true);
    setTtsError(null);
    try {
      const formData = new FormData();
      formData.append("audio", file);

      const res = await fetch(`http://localhost:3005/projects/${slug}/audio/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        const audioUrl = `http://localhost:3005/projects/${slug}/audio/narration.wav?t=${Date.now()}`;
        setGeneratedAudioUrl(audioUrl);
        setTtsMetadata({
          durationSec: 0,
          chunksCount: 1,
          format: file.name.split(".").pop()?.toUpperCase() || "AUDIO",
          voiceId: "Tệp tải lên",
        });
        onNotify("success", "✅ Đã tải lên file Audio thành công!");
        onRefreshProject();
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      setTtsError(err.message);
      onNotify("error", `Lỗi tải audio: ${err.message}`);
    } finally {
      setIsUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand-400" />
            <span>Sinh Audio Lời Thoại (TTS)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Mặc định sử dụng VieNeu-TTS (Local). Nếu có API Key sẽ ưu tiên dùng Gemini-TTS. Bạn có thể sửa kịch bản và chèn tag cảm xúc.
          </p>
        </div>

      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Giọng đọc (Voice ID)</label>
          <select
            value={voiceId}
            onChange={(e) => handleVoiceChange(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 appearance-none"
          >
            <optgroup label="VieNeu-TTS (Local) - Nam Miền Bắc">
              <option value="Hải Đăng">Hải Đăng (Mặc định · Tự nhiên, trầm ấm)</option>
              <option value="Thiện Minh">Thiện Minh (Kể chuyện, truyền cảm)</option>
              <option value="Adam bựa">Adam bựa (Tấu hề, cảm xúc tự nhiên)</option>
              <option value="Minh Đức">Minh Đức (Tin tức, thuyết trình)</option>
              <option value="Thiền Tâm Đức">Thiền Tâm Đức (Kể chuyện, sâu lắng)</option>
              <option value="Quốc Tuấn">Quốc Tuấn (Tự nhiên, rõ ràng)</option>
              <option value="Phạm Tuyên">Phạm Tuyên (Tự nhiên, mộc mạc)</option>
              <option value="Xuân Vĩnh">Xuân Vĩnh (Tự nhiên, chân thật)</option>
              <option value="Thanh Bình">Thanh Bình (Kể chuyện)</option>
            </optgroup>
            <optgroup label="VieNeu-TTS (Local) - Nữ Miền Bắc">
              <option value="Trúc Ly">Trúc Ly (Tự nhiên, trong trẻo)</option>
              <option value="Mai Anh">Mai Anh (Tin tức, chuẩn xác)</option>
              <option value="Ngọc Huyền">Ngọc Huyền (Tự nhiên, nhẹ nhàng)</option>
              <option value="Đoan Trang">Đoan Trang (Tự nhiên)</option>
              <option value="Quỳnh Anh">Quỳnh Anh (Đọc truyện, truyền cảm)</option>
              <option value="Ngọc Linh">Ngọc Linh (Kể chuyện)</option>
            </optgroup>
            <optgroup label="VieNeu-TTS (Local) - Miền Nam & Miền Trung">
              <option value="Thùy Dung">Thùy Dung (Nữ · Tin tức miền Nam)</option>
              <option value="Thái Sơn">Thái Sơn (Nam · Kể chuyện miền Nam)</option>
              <option value="Thục Đoan">Thục Đoan (Nữ · Kể chuyện miền Nam)</option>
              <option value="Minh Triết">Minh Triết (Nam · Tin tức miền Nam)</option>
              <option value="Mỹ Duyên">Mỹ Duyên (Nữ · Đọc truyện miền Nam)</option>
              <option value="Đức Trí">Đức Trí (Nam · Đọc truyện miền Nam)</option>
              <option value="Kim Thanh">Kim Thanh (Nữ · Đọc truyện miền Nam)</option>
              <option value="Adam">Adam (Nam · Tự nhiên miền Nam)</option>
              <option value="Quang Sơn">Quang Sơn (Nam · Tự nhiên miền Trung)</option>
              <option value="Ngọc Trân">Ngọc Trân (Nữ · Tự nhiên miền Trung)</option>
            </optgroup>
            <optgroup label="Gemini 3.8 Flash TTS (Cloud)">
              <option value="Kore">Kore (Nữ · Bình tĩnh, tự nhiên)</option>
              <option value="Puck">Puck (Nam · Năng động, vui tươi)</option>
              <option value="Charon">Charon (Nam · Trầm ấm, nghiêm túc)</option>
              <option value="Aoede">Aoede (Nữ · Sâu lắng, kể chuyện)</option>
              <option value="Fenrir">Fenrir (Nam · Mạnh mẽ, hùng hồn)</option>
            </optgroup>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Mô hình hoạt động (Model)</label>
          <select
            value={ttsModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 appearance-none"
          >
            <option value="auto">Tự động ưu tiên (Auto Fallback)</option>
            <option value="vieneu">VieNeu-TTS v3 Turbo (Local)</option>
            <option value="gemini">Gemini 3.8 Flash TTS (Cloud)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setShowPreview(prev => !prev);
              setShouldAutoPlay(false);
            }}
            className={`h-[42px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${showPreview
              ? "bg-brand-500/20 text-brand-300 border-brand-500/40 shadow-sm shadow-brand-500/10"
              : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700"
              }`}
          >
            <Headphones className="w-4 h-4 text-brand-400" />
            <span>{showPreview ? "Ẩn Nghe Thử" : "Mở Nghe Thử (Preview)"}</span>
          </button>
        </div>
      </div>

      {/* Redesigned Voice Preview Studio Card */}
      {showPreview && (
        <div className="p-5 bg-gradient-to-br from-slate-950 via-slate-900/90 to-brand-950/20 border border-brand-500/30 rounded-2xl space-y-4 shadow-xl shadow-brand-950/30 animate-fadeIn">
          {/* Top Bar of Studio */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Phòng Thử Giọng Đọc (Voice Studio)</h4>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-brand-500/15 text-brand-300 border border-brand-500/25 rounded-md">
                    {ttsModel === "gemini" ? "Gemini Cloud" : "VieNeu Local"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Thử trước ngữ điệu và phát âm của từng giọng mà không ảnh hưởng kịch bản chính</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setShouldAutoPlay(false);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
                title="Đóng phòng nghe thử"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Sample Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Câu mẫu thử giọng:</span>
            {SAMPLE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPreviewText(p.text)}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Textarea for Sample Text */}
          <div className="space-y-1.5">
            <div className="relative">
              <textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                maxLength={100}
                rows={2}
                placeholder="Nhập nội dung ngắn (dưới 100 ký tự) để nghe thử giọng..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 leading-relaxed resize-none pr-16"
              />
              <span className="absolute bottom-2.5 right-3 text-xs font-mono text-slate-500">
                {previewText.length}/100
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Chèn nhanh cảm xúc:</span>
              {activeTags.map(({ tag, desc }) => (
                <button
                  key={tag}
                  type="button"
                  title={desc}
                  onClick={() => setPreviewText((prev) => (prev + " " + tag).substring(0, 100))}
                  className="text-[10px] px-2 py-0.5 bg-slate-800/70 hover:bg-brand-500/20 hover:text-brand-300 text-slate-400 rounded border border-slate-700/60 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Player & Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerPreview}
                disabled={isPreviewing || !previewText.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/25 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isPreviewing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tạo âm thanh...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>{previewAudioUrl && previewVoiceId === voiceId ? `Nghe lại giọng "${voiceId}"` : `Nghe thử giọng "${voiceId}"`}</span>
                  </>
                )}
              </button>

              {previewAudioUrl && previewVoiceId !== voiceId && (
                <span className="text-xs text-amber-400 font-medium animate-fadeIn">
                  (Đã đổi giọng sang "{voiceId}", bấm để nghe thử)
                </span>
              )}
            </div>

            {/* Audio Player */}
            {previewAudioUrl ? (
              <div className="flex-1 max-w-md flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 shadow-inner animate-fadeIn">
                <Volume2 className="w-4 h-4 text-brand-400 shrink-0" />
                <audio
                  key={previewAudioUrl}
                  controls
                  src={previewAudioUrl}
                  autoPlay={shouldAutoPlay}
                  className="w-full h-8 outline-none"
                />
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">
                Chưa có âm thanh thử. Bấm "Nghe thử" để phát.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Narration Script Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-400">
            Kịch bản lời thoại chính (Narration Script)
          </label>

        </div>

        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          className="w-full h-[220px] bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 placeholder-slate-700 focus:outline-none focus:border-brand-500/50 leading-relaxed resize-none"
          placeholder="Nhập nội dung lời thoại..."
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 py-1">Chèn nhanh cảm xúc:</span>
            {activeTags.map(({ tag, desc }) => (
              <button
                key={tag}
                type="button"
                title={desc}
                onClick={() => setTtsText((prev) => prev + " " + tag)}
                className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded border border-slate-700 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-mono">
            {ttsText.trim() ? `${ttsText.trim().split(/\s+/).length} từ` : "0 từ"}
          </div>
        </div>
      </div>

      {/* Chunking & Generation Progress Card */}
      {isGeneratingTts && (
        <div className="p-4 bg-brand-950/40 border border-brand-500/40 rounded-xl space-y-2.5 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-300 text-sm font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
              <span>Đang phân tách kịch bản thành từng chunk & tổng hợp Audio...</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-mono">
              Ước tính: {getEstimatedChunksCount(ttsText)} chunks
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            ⚡ Hệ thống đang phân rã lời thoại thành từng câu nhỏ để thực thi tốc độ cao trên engine{" "}
            <strong>{isGemini ? "Gemini Flash TTS" : "VieNeu-TTS (Local)"}</strong>, sau đó tự động ghép nối và xuất ra định dạng MP3.
          </p>
        </div>
      )}

      {/* Error Alert Card */}
      {ttsError && !isGeneratingTts && (
        <div
          className={`p-4 rounded-xl space-y-3 ${
            ttsError.includes("429") ||
            ttsError.includes("quota") ||
            ttsError.includes("RESOURCE_EXHAUSTED") ||
            ttsError.includes("Google Gemini")
              ? "bg-amber-950/40 border border-amber-600/60"
              : "bg-rose-950/50 border border-rose-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <AlertCircle
                className={`w-4 h-4 shrink-0 ${
                  ttsError.includes("429") ||
                  ttsError.includes("quota") ||
                  ttsError.includes("RESOURCE_EXHAUSTED") ||
                  ttsError.includes("Google Gemini")
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              />
              <span>
                {ttsError.includes("429") ||
                ttsError.includes("quota") ||
                ttsError.includes("RESOURCE_EXHAUSTED") ||
                ttsError.includes("Google Gemini")
                  ? "Google Gemini TTS Đã Hết Quota Miễn Phí (429)"
                  : "Lỗi Tạo Audio (TTS)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTtsError(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs font-mono p-2.5 rounded-lg border bg-slate-950/70 border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed">
            {ttsError}
          </div>

          {ttsError.includes("429") ||
          ttsError.includes("quota") ||
          ttsError.includes("RESOURCE_EXHAUSTED") ||
          ttsError.includes("Google Gemini") ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-amber-800/40">
              <span className="text-xs text-amber-200/90">
                💡 <strong>Khuyên dùng:</strong> VieNeu-TTS chạy cục bộ trên máy tính của bạn (Local ONNX) hoàn toàn miễn phí, không giới hạn số lượt tạo.
              </span>
              <button
                type="button"
                onClick={() => handleSwitchToVieNeu("Hải Đăng")}
                className="shrink-0 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95"
              >
                👉 Chuyển sang VieNeu (Hải Đăng) & Tạo ngay
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>💡 Hãy kiểm tra xem VieNeu-TTS (port 8000) có đang mở không hoặc thử đổi Giọng đọc / Model.</span>
              <button
                type="button"
                onClick={handleGenerateTts}
                className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg transition-colors font-medium text-xs"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      )}

      {/* Completed Audio Player Card (MP3) */}
      {generatedAudioUrl && !isGeneratingTts && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-500/40 rounded-2xl space-y-3.5 shadow-lg shadow-emerald-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Audio Lời Thoại Hoàn Thành ({ttsMetadata?.format || "MP3"})</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {ttsMetadata?.chunksCount ? (
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
                  {ttsMetadata.chunksCount} chunks
                </span>
              ) : null}
              {ttsMetadata?.durationSec ? (
                <span className="px-2.5 py-1 bg-slate-800 text-emerald-300 rounded-lg border border-slate-700 font-mono">
                  ⏱ {ttsMetadata.durationSec.toFixed(1)}s
                </span>
              ) : null}
              <span className="px-2.5 py-1 bg-brand-950/60 text-brand-300 rounded-lg border border-brand-800/80 font-medium">
                Giọng: {ttsMetadata?.voiceId || voiceId}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 shadow-inner">
            <audio
              key={generatedAudioUrl}
              controls
              src={generatedAudioUrl}
              className="w-full h-10 outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <a
              href={generatedAudioUrl}
              download={`narration_${slug}.mp3`}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file MP3</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onNotify("success", "✅ Đã xác nhận Audio Lời thoại! Chuyển tiếp sang Stage SPEC...");
                onComplete();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
            >
              <span>Chấp nhận Audio & Tiếp tục sang Stage SPEC</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            ref={audioInputRef}
            onChange={handleUploadAudio}
          />
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            disabled={isUploadingAudio || isGeneratingTts}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isUploadingAudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span>Tải file có sẵn</span>
            )}
          </button>
          <span className="text-xs text-slate-500 hidden sm:inline">(.wav, .mp3)</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleGenerateDraft}
            disabled={isGeneratingDraft || isGeneratingTts}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-xs font-medium border border-indigo-500/30 transition-colors disabled:opacity-50"
          >
            {isGeneratingDraft ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>AI Viết Lại (Chèn Cảm Xúc)</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateTts}
            disabled={isGeneratingTts || !ttsText.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-brand-600/20 active:scale-95 disabled:opacity-50"
          >
            {isGeneratingTts ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý từng chunk...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Tạo Audio (TTS)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Fallback Warning Alert Banner */}
      {fallbackInfo?.active && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/60 rounded-2xl space-y-2.5 shadow-lg shadow-amber-950/30 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Cảnh Báo: Đã Tự Động Fallback Sang VieNeu-TTS Local</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                Giọng đang dùng: {fallbackInfo.fallbackVoice}
              </span>
              <button
                type="button"
                onClick={() => setFallbackInfo(null)}
                className="text-xs text-amber-400 hover:text-amber-200"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-xs text-amber-200/90 leading-relaxed space-y-1.5 pt-1">
            <p>
              • <strong>Lý do Fallback:</strong> {fallbackInfo.reason}
            </p>
            <p>
              • <strong>Làm sạch tag cảm xúc:</strong> {fallbackInfo.details}
            </p>
            <p>
              • <strong>Đồng bộ giao diện:</strong> Ô Giọng đọc (Voice ID), Model và khung kịch bản (textarea) phía trên đã được tự động cập nhật đồng bộ sang <em>{fallbackInfo.fallbackVoice}</em> và làm sạch các tag không tương thích để đảm bảo tính nhất quán.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
