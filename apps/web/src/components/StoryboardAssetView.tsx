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
  const [dragOver, setDragOver] = useState(false);

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

  // Export Prompt Pack
  const handleExportPromptPack = async () => {
    setIsExporting(true);
    try {
      const res = await api.exportPromptPack(slug);
      // Download as markdown file
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

  // Upload Asset (Drag & Drop or File Input)
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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

        await api.uploadAsset(slug, file.name, base64);
        successCount++;
      } catch (err: any) {
        onNotify("error", `Lỗi upload file ${file.name}: ${err.message}`);
      }
    }

    if (successCount > 0) {
      onNotify("success", `Đã import thành công ${successCount} asset vào sổ cái manifest!`);
      await loadData();
    }
    setIsUploading(false);
  };

  const getBeatAsset = (beatId: string) => {
    if (!manifest?.assets) return null;
    return manifest.assets.find(
      (a: any) => a.beatId === beatId || a.id === beatId || a.fileName?.startsWith(beatId)
    );
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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-base font-semibold text-white">Storyboard & Quản lý Asset</h3>
          <p className="text-xs text-slate-400">
            Xem trước phân cảnh, xuất prompt AI và kéo thả hình ảnh minh họa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportPromptPack}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Xuất Prompt Pack (.md)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Storyboard Beats (Left 2 cols) & Remotion Preview Player + Asset Drop (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Beats Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-brand-400" />
              <span>Danh sách Beats ({allBeats.length} cảnh)</span>
            </h4>
            <span className="text-xs text-slate-400">spec.json</span>
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

                return (
                  <div
                    key={beat.id}
                    onClick={() => setActiveBeatIndex(idx)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? "bg-brand-950/40 border-brand-500 shadow-md shadow-brand-500/10 ring-1 ring-brand-500/30"
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
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-800 mb-3 flex items-center justify-center">
                        {asset ? (
                          <img
                            src={api.getFileUrl(slug, asset.filePath)}
                            alt={beat.id}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-3 text-slate-600 text-[11px]">
                            <ImageIcon className="w-5 h-5 mx-auto mb-1 opacity-40" />
                            <span>Chưa có ảnh (kéo thả {beat.id}.png)</span>
                          </div>
                        )}
                        {asset && (
                          <div className="absolute top-1 right-1 bg-emerald-500/90 text-white p-1 rounded-md text-[9px] flex items-center gap-1 shadow">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Prompt / Notes */}
                      <p className="text-xs text-slate-300 line-clamp-2">
                        {beat.directorNote || beat.visualPrompt || "Không có ghi chú đạo diễn"}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{beat.chapterTitle || "Chương"}</span>
                      <span>
                        Words: {beat.range?.startWordId} → {beat.range?.endWordId}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Preview Player & Drag-and-Drop Uploader */}
        <div className="space-y-6">
          {/* Remotion Preview Player Widget */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-400" />
                <span>Xem Trước Video (Remotion Preview)</span>
              </h4>
              <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAspectRatio("16:9")}
                  className={`px-2 py-0.5 text-[10px] rounded font-mono transition-colors ${
                    aspectRatio === "16:9" ? "bg-brand-600 text-white" : "text-slate-400"
                  }`}
                >
                  16:9
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio("9:16")}
                  className={`px-2 py-0.5 text-[10px] rounded font-mono transition-colors ${
                    aspectRatio === "9:16" ? "bg-brand-600 text-white" : "text-slate-400"
                  }`}
                >
                  9:16
                </button>
              </div>
            </div>

            {/* Virtual Screen Display */}
            <div
              className={`relative mx-auto rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col items-center justify-center transition-all ${
                aspectRatio === "16:9" ? "w-full aspect-video" : "w-44 aspect-[9/16]"
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

          {/* Drag & Drop Upload Zone */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-400" />
              <span>Nạp Asset Hình Ảnh (Auto Import)</span>
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
              className={`p-6 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer ${
                dragOver
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
                  {isUploading ? "Đang xử lý nạp ảnh..." : "Kéo thả ảnh hoặc Bấm để chọn"}
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
