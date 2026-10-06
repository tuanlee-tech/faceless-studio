import React, { useState, useEffect } from "react";
import {
  Download,
  Upload,
  Image as ImageIcon,
  Play,
  Pause,
  Film,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Eye,
  Sparkles,
  Copy,
  Check,
  Wand2,
  Palette,
  Sliders,
  Volume2,
} from "lucide-react";
import { api } from "../api/client.js";

interface StoryboardAssetViewProps {
  slug: string;
  onNotify: (type: "success" | "error", message: string) => void;
}

export const StoryboardAssetView: React.FC<StoryboardAssetViewProps> = ({
  slug,
  onNotify,
}) => {
  const [spec, setSpec] = useState<any | null>(null);
  const [manifest, setManifest] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAiAll, setIsGeneratingAiAll] = useState(false);
  const [generatingBeatId, setGeneratingBeatId] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [assetTab, setAssetTab] = useState<"ai" | "manual">("ai");

  // BGM state
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [isUploadingBgm, setIsUploadingBgm] = useState(false);
  const bgmInputRef = React.useRef<HTMLInputElement>(null);

  // Player preview state
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [specData, manifestData] = await Promise.all([
        api.getSpec(slug).catch(() => null),
        api.getAssetManifest(slug).catch(() => null),
      ]);
      setSpec(specData?.spec || null);
      setManifest(manifestData?.manifest || null);

      // Check if custom bgm exists
      const bgmTestUrl = `http://localhost:3005/projects/${slug}/audio/bgm.mp3`;
      try {
        const res = await fetch(bgmTestUrl, { method: "HEAD" });
        if (res.ok) {
          setBgmUrl(`${bgmTestUrl}?t=${Date.now()}`);
        } else {
          setBgmUrl(null);
        }
      } catch (e) {
        setBgmUrl(null);
      }
    } catch (err: any) {
      onNotify("error", `Lỗi tải Storyboard: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug]);

  // Flatten beats from chapters
  const allBeats = React.useMemo(() => {
    if (!spec?.chapters) return [];
    const list: any[] = [];
    spec.chapters.forEach((ch: any) => {
      (ch.beats || []).forEach((b: any) => {
        list.push({ ...b, chapterTitle: ch.title });
      });
    });
    return list;
  }, [spec]);

  // Auto playback simulation
  useEffect(() => {
    if (!isPlaying || allBeats.length === 0) return;
    const interval = setInterval(() => {
      setActiveBeatIndex((prev) => (prev + 1) % allBeats.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isPlaying, allBeats.length]);

  const getBeatAsset = (beatId: string) => {
    if (!manifest?.assets) return null;
    return manifest.assets.find(
      (a: any) => a.beatId === beatId || a.id === beatId || a.fileName?.startsWith(`${beatId}.`)
    );
  };

  // Generate detailed prompt for image LLMs (Midjourney / DALL-E / Recraft / Flux)
  const getDetailedPromptInfo = (beat: any) => {
    if (!beat) return null;
    const templateId = spec?.templateId || "baroque-mono";
    const isMono = templateId.includes("mono") || templateId.includes("baroque");

    // Use spec-level styleLock if available (set during direct stage), else derive from template
    const styleLock = spec?.styleLock || (isMono
      ? "Baroque monochrome chiaroscuro, dramatic Caravaggio lighting, high-contrast black-and-white, rich deep blacks, crisp ivory highlights, atmospheric volumetric fog, subtle film grain"
      : "Contemporary cinematic realism, minimalist composition, clean negative space, soft ambient studio lighting, premium editorial color grading");

    // Per-beat unique visual description — the core of what makes each scene different
    const beatVisual = beat.visualPrompt || beat.directorNote || `Visual scene for beat ${beat.id}`;

    const cameraSpecs = "cinematic wide shot, shot on 35mm anamorphic lens, f/1.8, shallow depth of field, sharp subject focus, hyper-detailed texture";
    const negativePrompt = "text, watermark, logo, blurry, cartoon, 3d render, distorted faces, oversaturated, low quality, deformed anatomy";
    const arParam = aspectRatio === "16:9" ? "--ar 16:9" : "--ar 9:16";

    // Check if visualPrompt already contains the style lock (e.g. from AI generation)
    const alreadyHasStyle = beatVisual.toLowerCase().includes("chiaroscuro") || beatVisual.toLowerCase().includes("cinematic realism") || beatVisual.length > 200;

    const fullPrompt = alreadyHasStyle
      ? `${beatVisual}. Masterpiece, award-winning cinematography ${arParam} --v 6.0 --no ${negativePrompt}`
      : `${beatVisual}. Style: ${styleLock}. Camera: ${cameraSpecs}. Masterpiece, award-winning cinematography ${arParam} --v 6.0 --no ${negativePrompt}`;

    return {
      fullPrompt,
      baseVisual: beatVisual,
      styleKeywords: styleLock,
      cameraSpecs,
      negativePrompt,
      arParam,
    };
  };

  // 1. Generate Single AI Asset
  const handleGenerateAiAsset = async (beatId: string, customPrompt?: string) => {
    setGeneratingBeatId(beatId);
    try {
      const beat = allBeats.find((b) => b.id === beatId);
      const promptToUse =
        customPrompt ||
        beat?.visualPrompt ||
        beat?.directorNote ||
        `Visual illustration for beat ${beatId}`;

      const res = await api.generateAiAsset(slug, beatId, promptToUse);
      if (res.success) {
        onNotify(
          "success",
          `✨ Đã tạo xong ảnh AI cho Beat [${beatId}] (${res.source === "imagen" ? "Gemini Imagen" : "Creative Synth"})!`
        );
        await loadData();
      } else {
        throw new Error("Không thể tạo ảnh AI");
      }
    } catch (err: any) {
      onNotify("error", `Lỗi tạo ảnh AI cho Beat ${beatId}: ${err.message}`);
    } finally {
      setGeneratingBeatId(null);
    }
  };

  const handleUploadBgm = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBgm(true);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      
      const res = await fetch(`http://localhost:3005/projects/${slug}/audio/bgm`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        setBgmUrl(`http://localhost:3005/projects/${slug}/${data.path}?t=${Date.now()}`);
        onNotify("success", "✅ Đã tải lên file Nhạc nền (BGM) thành công!");
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      onNotify("error", `Lỗi tải BGM: ${err.message}`);
    } finally {
      setIsUploadingBgm(false);
      if (bgmInputRef.current) bgmInputRef.current.value = "";
    }
  };

  // 2. Generate All AI Assets in Batch
  const handleGenerateAllAiAssets = async () => {
    if (allBeats.length === 0) {
      onNotify("error", "Chưa có beats nào trong spec.json để tạo ảnh!");
      return;
    }

    setIsGeneratingAiAll(true);
    try {
      const res = await api.generateAllAiAssets(slug);
      if (res.success) {
        onNotify(
          "success",
          `✨ Hoàn tất! Đã tự động tạo và liên kết ${res.generatedCount}/${res.totalBeats} ảnh AI vào sổ cái manifest!`
        );
        await loadData();
      } else {
        throw new Error("Tạo hàng loạt ảnh AI thất bại");
      }
    } catch (err: any) {
      onNotify("error", `Lỗi sinh tất cả ảnh AI: ${err.message}`);
    } finally {
      setIsGeneratingAiAll(false);
    }
  };

  // 3. Export Prompt Pack
  const handleExportPromptPack = async () => {
    setIsExporting(true);
    try {
      const res = await api.exportPromptPack(slug);
      const blob = new Blob([res.promptPack], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prompt-pack-${slug}.md`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify("success", `Đã xuất Prompt Pack (${res.count} visual prompts) thành công!`);
    } catch (err: any) {
      onNotify("error", `Xuất Prompt Pack thất bại: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Upload Asset File (General or Specific Beat)
  const handleFileUpload = async (files: FileList | null, targetBeatId?: string) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = targetBeatId ? `${targetBeatId}.png` : file.name;

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            resolve(res.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await api.uploadAsset(slug, filename, base64);
        successCount++;
      } catch (err: any) {
        onNotify("error", `Lỗi upload file ${file.name}: ${err.message}`);
      }
    }

    if (successCount > 0) {
      onNotify(
        "success",
        `Đã import thành công ${successCount} asset vào sổ cái manifest!`
      );
      await loadData();
    }
    setIsUploading(false);
  };

  // Copy prompt helper
  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    onNotify("success", "Đã sao chép prompt chi tiết vào Clipboard!");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
        <span className="text-sm">Đang nạp Storyboard và Asset...</span>
      </div>
    );
  }

  const activeBeat = allBeats[activeBeatIndex];
  const activeAsset = activeBeat ? getBeatAsset(activeBeat.id) : null;
  const promptInfo = getDetailedPromptInfo(activeBeat);

  const totalBeats = allBeats.length;
  const beatsWithAssets = allBeats.filter((b) => getBeatAsset(b.id)).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Action Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Storyboard & Quản Lý Assets</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              {beatsWithAssets}/{totalBeats} Beats có ảnh
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tạo ảnh tự động bằng AI hoặc lấy prompt chi tiết của đạo diễn để tự vẽ thủ công.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* AI Generator Batch Button */}
          <button
            onClick={handleGenerateAllAiAssets}
            disabled={isGeneratingAiAll || allBeats.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 transition-all disabled:opacity-50 active:scale-95"
          >
            {isGeneratingAiAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tạo ảnh AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Sinh Tất Cả Ảnh Bằng AI</span>
              </>
            )}
          </button>

        </div>
      </div>

      {/* BGM Upload Section */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-brand-400" />
            Nhạc nền (Background Music)
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Mặc định video sẽ dùng nhạc nền của Template. Bạn có thể ghi đè (overwrite) bằng file MP3 của riêng mình.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {bgmUrl && (
            <audio controls src={bgmUrl} className="h-8 w-48 outline-none" />
          )}
          <input
            type="file"
            accept="audio/mpeg, audio/mp3"
            className="hidden"
            ref={bgmInputRef}
            onChange={handleUploadBgm}
          />
          <button
            onClick={() => bgmInputRef.current?.click()}
            disabled={isUploadingBgm}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isUploadingBgm ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>Đổi nhạc nền</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Storyboard Beats (Left 2 cols) & Inspector / Remotion Preview (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Beats Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-brand-400" />
              <span>Phân cảnh Storyboard ({totalBeats} cảnh)</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono">Bấm chọn cảnh để xem chi tiết & prompt</span>
          </div>

          {allBeats.length === 0 ? (
            <div className="p-10 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl text-slate-400 text-xs">
              <Film className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p>Chưa tìm thấy beats trong spec.json.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Hãy hoàn thành giai đoạn <strong>direct</strong> và <strong>spec</strong> ở tab Pipeline.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allBeats.map((beat, idx) => {
                const asset = getBeatAsset(beat.id);
                const isCurrent = activeBeatIndex === idx;
                const isGeneratingThis = generatingBeatId === beat.id;

                return (
                  <div
                    key={beat.id}
                    onClick={() => setActiveBeatIndex(idx)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${isCurrent
                        ? "bg-brand-950/40 border-brand-500 shadow-md shadow-brand-500/10 ring-1 ring-brand-500/40"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                  >
                    <div>
                      {/* Beat header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-semibold text-brand-300">
                          #{idx + 1} • Beat [{beat.id}]
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {beat.layout || "title-card"}
                        </span>
                      </div>

                      {/* Image Thumbnail / Slot */}
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-800 mb-3 flex items-center justify-center group">
                        {asset ? (
                          <img
                            src={api.getFileUrl(slug, asset.filePath)}
                            alt={beat.id}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-3 text-slate-600 text-[11px]">
                            <ImageIcon className="w-5 h-5 mx-auto mb-1 opacity-40" />
                            <span>Chưa có ảnh</span>
                          </div>
                        )}

                        {asset && (
                          <div className="absolute top-1.5 right-1.5 bg-emerald-500/90 text-white p-1 rounded-md text-[9px] flex items-center gap-1 shadow">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                        )}

                        {/* Quick Hover Action */}
                        <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity p-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateAiAsset(beat.id);
                            }}
                            disabled={isGeneratingThis}
                            className="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[11px] rounded-lg font-medium flex items-center gap-1 shadow disabled:opacity-50"
                          >
                            {isGeneratingThis ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )}
                            <span>Tạo ảnh AI</span>
                          </button>
                        </div>
                      </div>

                      {/* Prompt / Notes */}
                      <p className="text-xs text-slate-300 line-clamp-2">
                        {beat.directorNote || beat.visualPrompt || "Không có ghi chú đạo diễn"}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{beat.chapterTitle || "Chương"}</span>
                      <span>
                        Words: {beat.range?.startWordId || "w1"} → {beat.range?.endWordId || "w2"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Inspector Player & Asset Creator Hub */}
        <div className="space-y-6">
          {/* Remotion Preview Player Widget */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-400" />
                <span>Xem Trước Video</span>
              </h4>
              <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAspectRatio("16:9")}
                  className={`px-2 py-0.5 text-[10px] rounded font-mono transition-colors ${aspectRatio === "16:9" ? "bg-brand-600 text-white" : "text-slate-400"
                    }`}
                >
                  16:9
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio("9:16")}
                  className={`px-2 py-0.5 text-[10px] rounded font-mono transition-colors ${aspectRatio === "9:16" ? "bg-brand-600 text-white" : "text-slate-400"
                    }`}
                >
                  9:16
                </button>
              </div>
            </div>

            {/* Virtual Screen Display */}
            <div
              className={`relative mx-auto rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col items-center justify-center transition-all ${aspectRatio === "16:9" ? "w-full aspect-video" : "w-44 aspect-[9/16]"
                }`}
            >
              {activeAsset ? (
                <img
                  src={api.getFileUrl(slug, activeAsset.filePath)}
                  alt="active-beat"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-brand-950/40 flex items-center justify-center text-slate-500 text-xs p-4 text-center">
                  <span>Chưa có hình nền cho {activeBeat ? activeBeat.id : "cảnh này"}</span>
                </div>
              )}

              {/* Subtitle / Caption Overlay */}
              <div className="relative z-10 w-full p-4 mt-auto bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent text-center">
                <span className="inline-block px-3 py-1 rounded bg-black/60 backdrop-blur-sm text-yellow-300 font-bold text-xs shadow">
                  {activeBeat ? `Beat [${activeBeat.id}] — ${activeBeat.layout}` : "Faceless Studio"}
                </span>
                <p className="text-[11px] text-slate-200 mt-1 line-clamp-2">
                  {activeBeat?.directorNote || "Nội dung phân cảnh phụ đề tự động..."}
                </p>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? "Dừng" : "Phát Thử"}</span>
              </button>

              <span className="text-slate-400 font-mono">
                Cảnh {allBeats.length > 0 ? activeBeatIndex + 1 : 0} / {allBeats.length}
              </span>
            </div>
          </div>

          {/* Asset Creation & Manual Prompt Inspector */}
          {activeBeat && (
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-brand-400" />
                  <span className="font-semibold text-sm text-white">
                    Asset cho Beat [{activeBeat.id}]
                  </span>
                </div>


              </div>
              {/* Tab Switcher */}
              <div className="flex items-center justify-center w-max mx-auto gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssetTab("ai")}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 ${assetTab === "ai"
                      ? "bg-brand-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Assets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssetTab("manual")}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 ${assetTab === "manual"
                      ? "bg-brand-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>Tự Tạo Thủ Công</span>
                </button>
              </div>

              {/* Tab 1: AI Assets Mode */}
              {assetTab === "ai" && (
                <div className="space-y-3.5">
                  <p className="text-xs text-slate-300">
                    Hệ thống sẽ gọi trực tiếp <strong>AI</strong> để tạo hình ảnh tức thì.<br/>(Nếu có <strong><code>IMAGE_GENERATION_API_KEY</code></strong> trong <strong>.env</strong>) 
                  </p>

                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                    <span className="text-[11px] text-slate-400 font-medium block">
                      Ghi chú đạo diễn phân cảnh:
                    </span>
                    <p className="text-xs text-slate-200">
                      {activeBeat.directorNote || activeBeat.visualPrompt || "Tạo hình ảnh minh họa phù hợp với phân cảnh"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerateAiAsset(activeBeat.id)}
                    disabled={generatingBeatId === activeBeat.id}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {generatingBeatId === activeBeat.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang tạo ảnh AI cho Beat [{activeBeat.id}]...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>Tạo Ảnh AI Cho Beat Này</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Tab 2: Manual Prompt Guide (Tự tạo thủ công) */}
              {assetTab === "manual" && promptInfo && (
                <div key={activeBeat.id} className="space-y-3.5 animate-fadeIn">
                  {/* Export Prompt Pack Action */}
                  <div className="flex items-center justify-end">
                    
                    <button
                      type="button"
                      onClick={handleExportPromptPack}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium shadow transition-colors disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Xuất Prompt Pack (.md)</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-300">
                        Prompt Chi Tiết Cho Beat [{activeBeat.id}]:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(promptInfo.fullPrompt)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium border border-slate-700 transition-colors"
                      >
                        {copiedPrompt ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Đã copy!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 leading-relaxed max-h-36 overflow-y-auto selection:bg-brand-500 selection:text-white">
                      {promptInfo.fullPrompt}
                    </div>
                  </div>

                  {/* Dropzone for this beat */}
                  <div className="pt-2">
                    <span className="block text-[11px] font-medium text-slate-400 mb-1.5">
                      Sau khi tạo xong trên Midjourney / DALL-E, nạp ảnh vào đây:
                    </span>
                    <div className="relative border border-dashed border-slate-700 hover:border-brand-500 bg-slate-950/50 rounded-xl p-4 text-center cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleFileUpload(e.target.files, activeBeat.id)}
                        className="hidden"
                        id={`upload-beat-${activeBeat.id}`}
                      />
                      <label htmlFor={`upload-beat-${activeBeat.id}`} className="cursor-pointer">
                        <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                        <span className="text-xs text-slate-200 font-medium block">
                          Tải ảnh lên cho Beat [{activeBeat.id}]
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Tự động lưu thành {activeBeat.id}.png và gán vào manifest
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General Drag & Drop Upload Zone */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-400" />
              <span>Nạp Asset Hàng Loạt (Auto Import)</span>
            </h4>
            <p className="text-xs text-slate-400">
              Kéo thả các file ảnh (đổi tên theo beat id như <code>b1.png</code>) để tự động import vào sổ cái.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`p-6 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer ${dragOver
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
                }`}
            >
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                id="asset-file-input"
              />
              <label htmlFor="asset-file-input" className="cursor-pointer">
                {isUploading ? (
                  <Loader2 className="w-8 h-8 mx-auto text-brand-500 animate-spin mb-2" />
                ) : (
                  <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                )}
                <span className="block text-xs font-medium text-slate-200">
                  {isUploading ? "Đang xử lý nạp ảnh..." : "Kéo thả nhiều ảnh hoặc Bấm để chọn"}
                </span>
                <span className="block text-[10px] text-slate-500 mt-1">PNG, JPG, WEBP</span>
              </label>
            </div>

            {/* Manifest Count */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Đã lưu vào manifest.json:</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {manifest?.assets?.length || 0} assets
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
