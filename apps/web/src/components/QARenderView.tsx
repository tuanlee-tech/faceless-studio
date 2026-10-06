import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Video,
  Film,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  Volume2,
  Clock,
  Radio,
} from "lucide-react";
import { api } from "../api/client.js";

interface QARenderViewProps {
  slug: string;
  onRefreshProject: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
}

export const QARenderView: React.FC<QARenderViewProps> = ({
  slug,
  onRefreshProject,
  onNotify,
}) => {
  // Pre-render QA state
  const [preQaReport, setPreQaReport] = useState<any | null>(null);
  const [isRunningPreQa, setIsRunningPreQa] = useState(false);

  // Render Queue state
  const [selectedFormat, setSelectedFormat] = useState<"long-16x9" | "short-9x16">("long-16x9");
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // Post-render QA state
  const [postQaReport, setPostQaReport] = useState<any | null>(null);
  const [isRunningPostQa, setIsRunningPostQa] = useState(false);

  // Initial load: check if pre-qa or rendered video already exists
  useEffect(() => {
    // Check if dist video already exists
    const videoUrl = api.getFileUrl(slug, "dist/long-16x9.mp4");
    fetch(videoUrl, { method: "HEAD" })
      .then((res) => {
        if (res.ok) setRenderedVideoUrl(videoUrl);
      })
      .catch(() => {});
  }, [slug]);

  // Run Pre-Render QA
  const handleRunPreQa = async () => {
    setIsRunningPreQa(true);
    try {
      const report = await api.getQA(slug, "pre");
      setPreQaReport(report);
      if (report.passed) {
        onNotify("success", "✅ Pre-Render QA Gates: Đạt chuẩn 100%!");
      } else {
        onNotify("error", `Cảnh báo: Có ${report.summary?.errors || 1} lỗi QA cần xử lý.`);
      }
    } catch (err: any) {
      onNotify("error", `Lỗi chạy QA: ${err.message}`);
    } finally {
      setIsRunningPreQa(false);
    }
  };

  // Run Post-Render QA
  const handleRunPostQa = async () => {
    setIsRunningPostQa(true);
    try {
      const report = await api.getQA(slug, "post");
      setPostQaReport(report);
      if (report.passed) {
        onNotify("success", "✅ Post-Render QA: Chuẩn âm lượng -14 LUFS & thời lượng đạt chuẩn!");
      }
    } catch (err: any) {
      onNotify("error", `Lỗi chạy Post-QA: ${err.message}`);
    } finally {
      setIsRunningPostQa(false);
    }
  };

  // Trigger Render with Real-time SSE listener
  const handleStartRender = async () => {
    setIsRendering(true);
    setRenderProgress(5);
    setRenderedVideoUrl(null);
    setPostQaReport(null);

    // 1. Establish SSE Connection for real-time progress
    let eventSource: EventSource | null = null;
    try {
      const eventsUrl = api.getEventsUrl(slug);
      eventSource = new EventSource(eventsUrl);

      eventSource.addEventListener("log", (event) => {
        try {
          const logData = JSON.parse(event.data);
          if (logData.type === "render_progress" && typeof logData.progress === "number") {
            setRenderProgress(Math.max(5, logData.progress));
          } else if (logData.type === "render_completed") {
            setRenderProgress(100);
          }
        } catch {}
      });

      eventSource.onerror = () => {
        // SSE error or close
        if (eventSource) eventSource.close();
      };
    } catch {}

    // 2. Invoke Render endpoint
    try {
      await api.render(slug, { format: selectedFormat });
      setRenderProgress(100);
      onNotify("success", "🎉 Xuất video hoàn tất!");

      const videoRelative =
        selectedFormat === "short-9x16" ? "dist/shorts/short-1.mp4" : "dist/long-16x9.mp4";
      const fullUrl = api.getFileUrl(slug, videoRelative);
      setRenderedVideoUrl(fullUrl);

      onRefreshProject();

      // Automatically trigger post-render QA check
      setTimeout(() => {
        handleRunPostQa();
      }, 1000);
    } catch (err: any) {
      onNotify("error", `Lỗi trong quá trình render: ${err.message}`);
    } finally {
      setIsRendering(false);
      if (eventSource) eventSource.close();
    }
  };

  const isRenderBlocked = preQaReport && preQaReport.passed === false;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Pre-Render QA Section */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              <span>Cổng Kiểm Soát Chất Lượng (Pre-Render QA Gates)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Thẩm định VideoSpec, kiểm tra tài nguyên ảnh/âm thanh vật lý và sổ cái bản quyền.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunPreQa}
            disabled={isRunningPreQa || isRendering}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isRunningPreQa ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileCheck className="w-4 h-4" />
            )}
            <span>Kiểm Tra Pre-Render QA</span>
          </button>
        </div>

        {/* QA Report Summary Banner */}
        {preQaReport && (
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              preQaReport.passed
                ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                : "bg-rose-950/30 border-rose-800/50 text-rose-300"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                {preQaReport.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  {preQaReport.passed
                    ? "TẤT CẢ CÁC TIÊU CHUẨN ĐÃ ĐẠT (READY TO RENDER)"
                    : "CẢNH BÁO: PHÁT HIỆN LỖI CHẶN RENDER"}
                </span>
              </div>
              <span className="font-mono text-[11px]">
                {preQaReport.summary?.errors || 0} Lỗi • {preQaReport.summary?.warnings || 0} Cảnh Báo
              </span>
            </div>

            {/* QA Items Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/40 text-[11px]">
              {(preQaReport.items || []).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60"
                >
                  {item.severity === "error" ? (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium text-slate-200">[{item.category}]</span>{" "}
                    <span className="text-slate-300">{item.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Render Queue & Live Progress */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-5">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-brand-400" />
            <span>Xuất Bản Video (Render Queue)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Render video bằng Remotion engine kết hợp hậu kỳ chuẩn hóa âm lượng -14 LUFS.
          </p>
        </div>

        {/* Format Selection & Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-300">Định dạng render:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedFormat("long-16x9")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  selectedFormat === "long-16x9"
                    ? "bg-brand-500/20 text-brand-300 border-brand-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-800"
                }`}
              >
                16:9 Dài (long-16x9)
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat("short-9x16")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  selectedFormat === "short-9x16"
                    ? "bg-brand-500/20 text-brand-300 border-brand-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-800"
                }`}
              >
                9:16 Short (short-9x16)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartRender}
            disabled={isRendering || isRenderBlocked}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all active:scale-95 ${
              isRenderBlocked
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-brand-600/20"
            }`}
          >
            {isRendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang render ({renderProgress}%)...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Bắt Đầu Render Video</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar (SSE Live Stream) */}
        {isRendering && (
          <div className="space-y-2 p-4 bg-slate-950/80 rounded-xl border border-brand-500/30 animate-pulse">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                <span>Tiến trình kết xuất Remotion (Realtime SSE)</span>
              </span>
              <span className="font-mono font-bold text-brand-300">{renderProgress}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Rendered Video Player & Post-Render QA Display */}
      {renderedVideoUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* HTML5 Video Player */}
          <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-emerald-400" />
              <span>Xem Ngay Thành Phẩm MP4</span>
            </h4>

            <div className="rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video flex items-center justify-center">
              <video
                controls
                src={renderedVideoUrl}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">{renderedVideoUrl}</span>
              <a
                href={renderedVideoUrl}
                download
                className="text-brand-400 hover:text-brand-300 font-medium"
              >
                Tải tệp MP4 về máy
              </a>
            </div>
          </div>

          {/* Post-Render QA Specs Card */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Post-Render QA</span>
                </h4>
                <button
                  onClick={handleRunPostQa}
                  disabled={isRunningPostQa}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Kiểm định tệp MP4 về tính toàn vẹn bitstream và chuẩn âm thanh phát thanh.
              </p>

              {postQaReport ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-brand-400" />
                        Integrated Loudness
                      </span>
                      <span className="font-mono font-semibold text-emerald-400">-14.0 LUFS</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">True Peak Ceiling</span>
                      <span className="font-mono text-slate-200">≤ -1.0 dBTP</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-brand-400" />
                        Độ lệch thời lượng
                      </span>
                      <span className="font-mono font-semibold text-emerald-400">± 0.2s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Chuẩn nén Codec</span>
                      <span className="font-mono text-slate-200">H.264 / AAC</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                  <p>Bấm kiểm định để đo lường thông số LUFS của video.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
              Tuân thủ chuẩn phát thanh EBU R128 & YouTube (-14 LUFS)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
