import React, { useState, useEffect } from "react";
import { Radio, Loader2, Volume2, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../api/client.js";

interface TTSGeneratorProps {
  slug: string;
  onRefreshProject: () => void;
  onNotify: (type: "success" | "error", msg: string) => void;
  onComplete: () => void;
}

export const TTSGenerator: React.FC<TTSGeneratorProps> = ({ slug, onRefreshProject, onNotify, onComplete }) => {
  const [ttsModel, setTtsModel] = useState("auto");
  const [voiceId, setVoiceId] = useState("Thiện Minh");
  const [ttsText, setTtsText] = useState("");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [previewText, setPreviewText] = useState("Chào các bạn, hôm nay chúng ta sẽ tìm hiểu một chủ đề rất thú vị.");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState("");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState("");

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

  const activeTags = ttsModel === "gemini" ? geminiTags : vieneuTags;

  useEffect(() => {
    api.getTaskResult(slug, "002", "script")
      .then((res) => {
        if (res.hasResult && res.result && res.result.content) {
          setTtsText(res.result.content);
        } else {
          setTtsText("");
        }
      })
      .catch(() => {});

    const audioUrl = `http://localhost:3005/projects/${slug}/audio/narration.wav`;
    fetch(audioUrl, { method: "HEAD" })
      .then((res) => {
        if (res.ok) setGeneratedAudioUrl(`${audioUrl}?t=${Date.now()}`);
      })
      .catch(() => {});
  }, [slug]);

  const handleGenerateDraft = async () => {
    setIsGeneratingDraft(true);
    try {
      const res = await fetch(`http://localhost:3005/projects/${slug}/tts/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ttsModel })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setTtsText(data.text);
        onNotify("success", "✅ Đã viết lại lời thoại có cảm xúc bằng AI.");
      } else {
        onNotify("error", `Lỗi: ${data.error || "Không thể tạo draft"}`);
      }
    } catch (err: any) {
      onNotify("error", `Lỗi: ${err.message}`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handlePreviewTts = async () => {
    if (!previewText.trim() || previewText.length > 100) return;
    setIsPreviewing(true);
    setPreviewAudioUrl("");
    try {
      const res = await fetch(`http://localhost:3005/projects/${slug}/tts/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: previewText, voiceId, model: ttsModel }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewAudioUrl(data.audioUrl);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      onNotify("error", `Lỗi preview TTS: ${err.message}`);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerateTts = async () => {
    setIsGeneratingTts(true);
    try {
      const res = await fetch(`http://localhost:3005/projects/${slug}/tts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voiceId, model: ttsModel }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedAudioUrl(`http://localhost:3005/projects/${slug}/audio/narration.wav?t=${Date.now()}`);
        onNotify("success", `✅ Đã tạo Voiceover (TTS) thành công! Thời lượng: ${data.durationSec.toFixed(1)}s`);
        onRefreshProject();
        onComplete();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      onNotify("error", `Lỗi tạo TTS: ${err.message}`);
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      
      const res = await fetch(`http://localhost:3005/projects/${slug}/audio/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        setGeneratedAudioUrl(`http://localhost:3005/projects/${slug}/audio/narration.wav?t=${Date.now()}`);
        onNotify("success", "✅ Đã tải lên file Audio thành công!");
        onRefreshProject();
        onComplete();
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
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
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={isGeneratingDraft}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium border border-indigo-500/30 transition-colors disabled:opacity-50"
        >
          {isGeneratingDraft ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span>🪄</span>
          )}
          <span>AI Viết Lại (Chèn Cảm Xúc)</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Giọng đọc (Voice ID)</label>
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 appearance-none"
          >
            <optgroup label="VieNeu-TTS (Local) - Nam">
              <option value="Thiện Minh">Nhật Phong (Mặc định - Trìu mến, dễ gần)</option>
              <option value="Hải Đăng">Hải Đăng (Thuyết trình, rõ ràng)</option>
              <option value="Adam bựa">Adam Tốp Tốp (Tấu hề, cảm xúc)</option>
              <option value="Minh Đức">Hoàng Nam (Minh Đức - Tin tức)</option>
            </optgroup>
            <optgroup label="VieNeu-TTS (Local) - Nữ">
              <option value="Ngọc Huyền">Huyền My (Ngọc Huyền - Tự nhiên)</option>
              <option value="Trúc Ly">Kim Chi (Trúc Ly - Tự nhiên)</option>
            </optgroup>
            <optgroup label="Gemini 3.8 Flash TTS (Cloud)">
              <option value="Kore">Kore (Bình tĩnh, tự nhiên)</option>
              <option value="Puck">Puck (Năng động, tươi sáng)</option>
              <option value="Charon">Charon (Trầm ấm, nghiêm túc)</option>
              <option value="Aoede">Aoede (Sâu lắng, kể chuyện)</option>
              <option value="Fenrir">Fenrir (Mạnh mẽ, hùng hồn)</option>
            </optgroup>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Mô hình hoạt động (Model)</label>
          <select
            value={ttsModel}
            onChange={(e) => {
              const model = e.target.value;
              setTtsModel(model);
              if (model === "gemini") {
                setVoiceId("Kore");
              } else if (model === "vieneu") {
                setVoiceId("Thiện Minh");
              }
            }}
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 appearance-none"
          >
            <option value="auto">Tự động ưu tiên (Auto Fallback)</option>
            <option value="vieneu">VieNeu-TTS v3 Turbo (Local)</option>
            <option value="gemini">Gemini 3.8 Flash TTS (Cloud)</option>
          </select>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showPreview ? "lg:grid-cols-2" : ""} gap-4`}>
        {/* Editor Area */}
        <div className="space-y-4">
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            className="w-full h-[200px] bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 placeholder-slate-700 focus:outline-none focus:border-brand-500/50 leading-relaxed resize-none"
            placeholder="Nhập nội dung lời thoại..."
          />
          
          <div className="flex flex-wrap items-center justify-between gap-2 -mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 py-1">Chèn nhanh:</span>
              {activeTags.map(({tag, desc}) => (
                <button
                  key={tag}
                  type="button"
                  title={desc}
                  onClick={() => setTtsText(prev => prev + " " + tag)}
                  className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded border border-slate-700 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-brand-400 bg-brand-900/20 hover:bg-brand-900/40 rounded-lg transition-colors border border-brand-800/30"
            >
              <Volume2 className="w-3.5 h-3.5" />
              {showPreview ? "Ẩn Nghe thử" : "Mở Nghe thử (Preview)"}
              {showPreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Preview Area */}
        {showPreview && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl h-[200px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-slate-500" />
                    Nghe thử giọng (Preview)
                  </h4>
                </div>
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  maxLength={100}
                  className="w-full h-16 bg-transparent border-none p-0 text-sm text-slate-400 focus:outline-none focus:ring-0 resize-none"
                  placeholder="Nhập câu ngắn (dưới 100 ký tự) để nghe thử..."
                />
              </div>
              
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handlePreviewTts}
                  disabled={isPreviewing || previewText.length === 0 || previewText.length > 100}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Nghe thử</span>}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-slate-500 py-1">Chèn cảm xúc:</span>
                {activeTags.map(({tag, desc}) => (
                  <button
                    key={tag}
                    type="button"
                    title={desc}
                    onClick={() => setPreviewText(prev => (prev + " " + tag).substring(0, 100))}
                    className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-brand-500/20 hover:text-brand-300 text-slate-300 rounded border border-slate-700 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/50">
                <span className="text-xs text-slate-500">{previewText.length}/100</span>
                {previewAudioUrl && (
                  <audio controls src={previewAudioUrl} className="h-8 outline-none" autoPlay />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {generatedAudioUrl && (
        <div className="p-3 bg-brand-950/20 border border-brand-500/30 rounded-xl flex items-center gap-4">
          <audio controls src={generatedAudioUrl} className="flex-1 h-10 outline-none" />
          <span className="text-xs text-brand-400 font-medium whitespace-nowrap">✅ Audio đã sẵn sàng</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
            disabled={isUploadingAudio}
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

        <button
          type="button"
          onClick={handleGenerateTts}
          disabled={isGeneratingTts || !ttsText.trim()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-medium transition-all shadow-md shadow-brand-600/20 active:scale-95 disabled:opacity-50"
        >
          {isGeneratingTts ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tạo Audio...</span>
            </>
          ) : (
            <span>🪄 Tạo Audio (TTS)</span>
          )}
        </button>
      </div>
    </div>
  );
};
