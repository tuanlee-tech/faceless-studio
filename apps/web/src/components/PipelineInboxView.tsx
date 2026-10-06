import React, { useState, useEffect } from "react";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { api } from "../api/client.js";
import type { ProjectState } from "../types/index.js";

interface PipelineInboxViewProps {
  slug: string;
  onRefreshProject: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
}

const PIPELINE_STAGES = ["outline", "script", "direct", "spec"];

const SAMPLE_TEMPLATES: Record<string, any> = {
  outline: {
    title: "Tiêu đề video mẫu",
    points: ["Giới thiệu vấn đề", "Phân tích tâm lý", "Đúc kết bài học"],
    sections: [
      { id: "s1", name: "Mở đầu", purpose: "Gây tò mò", estimatedSeconds: 30 },
      { id: "s2", name: "Thân bài", purpose: "Phân tích chuyên sâu", estimatedSeconds: 60 },
    ],
  },
  script: {
    title: "Tiêu đề video mẫu",
    content: "Nội dung kịch bản lời thoại chi tiết...",
    dialogue: ["Xin chào bạn, hôm nay chúng ta sẽ cùng khám phá bí ẩn này."],
  },
  direct: {
    beats: [
      {
        id: "b1",
        layout: "title-card",
        directorNote: "Cận cảnh mở đầu ấn tượng",
      },
    ],
    visuals: ["Hình ảnh minh họa trừu tượng ánh sáng"],
  },
  spec: {
    specVersion: "0.1.0",
    projectSlug: "slug-here",
    topicId: "sample",
    templateId: "minimal",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 10,
      words: [{ id: "w1", text: "Xin", startSec: 0, endSec: 1, confidence: 0.95 }],
    },
    chapters: [],
    music: [],
    meta: { title: "Title" },
  },
};

export const PipelineInboxView: React.FC<PipelineInboxViewProps> = ({
  slug,
  onRefreshProject,
  onNotify,
}) => {
  const [state, setState] = useState<ProjectState | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<any | null>(null);

  // Editor state
  const [resultJson, setResultJson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunningStage, setIsRunningStage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [st, tList] = await Promise.all([api.getStatus(slug), api.getTasks(slug)]);
      setState(st);
      setTasks(tList);
      if (tList.length > 0) {
        const current = tList[tList.length - 1];
        setActiveTask(current);
        const sample = SAMPLE_TEMPLATES[current.stage] || { stage: current.stage };
        setResultJson(JSON.stringify(sample, null, 2));
      }
    } catch (err: any) {
      onNotify("error", `Lỗi tải pipeline: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug]);

  const handleRunStage = async (stage?: string) => {
    setIsRunningStage(true);
    setValidationError(null);
    try {
      const res = await api.runStage(slug, stage);
      onNotify("success", res.message || `Đã khởi tạo stage ${res.stage}`);
      await loadData();
      onRefreshProject();
    } catch (err: any) {
      onNotify("error", `Không thể chạy stage: ${err.message}`);
    } finally {
      setIsRunningStage(false);
    }
  };

  const handleLoadSample = () => {
    if (!activeTask) return;
    const sample = SAMPLE_TEMPLATES[activeTask.stage] || {};
    if (activeTask.stage === "spec") {
      sample.projectSlug = slug;
    }
    setResultJson(JSON.stringify(sample, null, 2));
    setValidationError(null);
  };

  const handleSaveAndValidate = async () => {
    if (!activeTask) return;

    let parsed: any;
    try {
      parsed = JSON.parse(resultJson);
    } catch (err: any) {
      setValidationError(`Cú pháp JSON không hợp lệ: ${err.message}`);
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      // 1. Lưu kết quả vào results/<taskId>.json
      await api.saveTaskResult(slug, activeTask.id, parsed, activeTask.stage);

      // 2. Chạy validation qua Zod schema
      const valRes = await api.validateTasks(slug, activeTask.id);
      const taskVal = valRes.results.find((r) => r.taskId === activeTask.id);

      if (taskVal?.status === "PASSED") {
        onNotify("success", `✅ Task ${activeTask.id} (${activeTask.stage}) thẩm định thành công!`);
        await loadData();
        onRefreshProject();
      } else {
        const errorDetail = taskVal?.error || "Dữ liệu không đúng cấu trúc schema yêu cầu";
        setValidationError(errorDetail);

        // Đọc thêm tệp errors.md nếu có
        try {
          const errFile = await api.getTaskErrors(slug, activeTask.id);
          if (errFile.hasErrors && errFile.content) {
            setValidationError(`${errorDetail}\n\n${errFile.content}`);
          }
        } catch {}
      }
    } catch (err: any) {
      setValidationError(err.message || "Lỗi thẩm định task");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
        <span className="text-sm">Đang tải trạng thái pipeline...</span>
      </div>
    );
  }

  const getStageStatus = (stageName: string) => {
    return state?.stages.find((s) => s.stage === stageName)?.status || "pending";
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Stepper Pipeline Header */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-white">Quy trình Pipeline Sáng tạo</h3>
            <p className="text-xs text-slate-400">Theo dõi tiến trình từ Outline đến VideoSpec</p>
          </div>
          <button
            onClick={() => handleRunStage()}
            disabled={isRunningStage}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-medium transition-all shadow-md shadow-brand-600/20 active:scale-95 disabled:opacity-50"
          >
            {isRunningStage ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>Khởi chạy Stage Kế tiếp</span>
          </button>
        </div>

        {/* Stepper Steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((st, idx) => {
            const status = getStageStatus(st);
            return (
              <div
                key={st}
                className={`relative p-4 rounded-xl border transition-all ${
                  status === "done"
                    ? "bg-emerald-950/20 border-emerald-800/40"
                    : status === "running"
                    ? "bg-amber-950/20 border-amber-800/40 shadow-lg shadow-amber-500/5"
                    : status === "failed"
                    ? "bg-rose-950/20 border-rose-800/40"
                    : "bg-slate-950/40 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Stage {idx + 1}
                  </span>
                  {status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : status === "running" ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : status === "failed" ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 text-[10px] flex items-center justify-center text-slate-500">
                      {idx + 1}
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-sm text-slate-200 capitalize">{st}</h4>
                <p className="text-[11px] text-slate-400 mt-1 capitalize font-mono">
                  Trạng thái: <span className="font-medium text-slate-300">{status}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Task Inbox & Form Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task List / Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Nhiệm vụ Task Inbox</h4>
            <button
              onClick={loadData}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Làm mới tasks"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              <FileCode className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p>Chưa có task nào được tạo.</p>
              <button
                onClick={() => handleRunStage("outline")}
                className="mt-3 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-500"
              >
                Khởi tạo Outline ngay
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((t) => {
                const isSelected = activeTask?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setActiveTask(t);
                      const sample = SAMPLE_TEMPLATES[t.stage] || {};
                      setResultJson(JSON.stringify(sample, null, 2));
                      setValidationError(null);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-brand-950/40 border-brand-500/50 shadow-md shadow-brand-500/5"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-brand-300">
                        Task #{t.id}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {t.stage}
                      </span>
                    </div>
                    {t.prompt && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1.5">{t.prompt}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Form / JSON Editor & Validator */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  <span>
                    Editor Kết quả cho: {activeTask ? `Task ${activeTask.id} (${activeTask.stage})` : "Chưa chọn task"}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Điền nội dung kịch bản hoặc gọi Agent thực thi, sau đó nhấn Thẩm định.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={!activeTask}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Nạp Mẫu Chuẩn
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {validationError && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Validation Schema Thất Bại (Zod Error)</span>
                </div>
                <pre className="text-[11px] text-rose-200/90 whitespace-pre-wrap font-mono bg-rose-950/60 p-2.5 rounded-lg border border-rose-900/40">
                  {validationError}
                </pre>
              </div>
            )}

            {/* JSON Content Editor */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Dữ liệu JSON kết quả (results/{activeTask?.id || "task"}.json):
              </label>
              <textarea
                rows={14}
                value={resultJson}
                onChange={(e) => setResultJson(e.target.value)}
                disabled={!activeTask}
                placeholder="Nhập nội dung JSON kết quả tại đây..."
                className="w-full p-3.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl font-mono text-xs text-slate-200 transition-colors leading-relaxed selection:bg-brand-500 selection:text-white disabled:opacity-50"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Khi thẩm định thành công, hệ thống tự động cập nhật stage thành <strong>done</strong>.
              </span>

              <button
                type="button"
                onClick={handleSaveAndValidate}
                disabled={!activeTask || isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 transition-all disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang thẩm định...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Lưu & Thẩm định (Validate)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
