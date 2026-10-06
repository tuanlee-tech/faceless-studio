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
  Wand2,
  ArrowRight,
  FileText,
} from "lucide-react";
import { api } from "../api/client.js";
import type { ProjectState } from "../types/index.js";
import { TTSGenerator } from "./TTSGenerator.js";

interface PipelineInboxViewProps {
  slug: string;
  onRefreshProject: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
  onPipelineComplete?: () => void;
}

const PIPELINE_STAGES = ["outline", "script", "direct", "tts", "spec"];

const PROMPT_SUGGESTIONS: Record<string, string[]> = {
  outline: [
    "Hiệu ứng Dunning-Kruger trong tâm lý học với 3 phần: Giới thiệu, Thung lũng tuyệt vọng, Con đường khai sáng",
    "Nghệ thuật giao tiếp thấu cảm: Vì sao lắng nghe quan trọng hơn nói",
    "Thiên kiến xác nhận (Confirmation Bias) và cách não bộ đánh lừa chúng ta",
  ],
  script: [
    "Viết kịch bản sâu sắc, giọng điệu điềm đạm, câu mở đầu gây tò mò, giải thích mạch lạc",
    "Kịch bản kể chuyện dẫn dắt từ tình huống đời thường sang đúc kết tâm lý sâu sắc",
    "Kịch bản súc tích, ngắt nhịp rõ ràng để dễ khớp với phụ đề từng từ",
  ],
  direct: [
    "Chỉ đạo 4 phân cảnh điện ảnh tối màu, phong cách Baroque Mono, ánh sáng Rembrandt",
    "Bố cục title-card mở đầu, cận cảnh biểu cảm và đồ thị trực quan chuyển động chậm",
    "Chỉ đạo nhịp phim cinematic, chuyển cảnh mượt mà, ghi chú đạo diễn chi tiết",
  ],
  spec: [
    "Tổng hợp toàn bộ kịch bản và đạo diễn thành VideoSpec 30fps hoàn chỉnh",
    "Đồng bộ audio narration, danh sách từ vựng và visual beats chuẩn Remotion",
  ],
};

const SAMPLE_TEMPLATES: Record<string, any> = {
  outline: {
    title: "Nhập tiêu đề dự án của bạn...",
    points: [
      "Luận điểm chính 1...",
      "Luận điểm chính 2...",
      "Luận điểm chính 3...",
    ],
    sections: [
      { id: "s1", name: "Mở đầu", purpose: "Thu hút sự chú ý của người xem...", estimatedSeconds: 30 },
      { id: "s2", name: "Phần thân", purpose: "Giải quyết vấn đề chính...", estimatedSeconds: 60 },
      { id: "s3", name: "Kết luận", purpose: "Tổng kết và kêu gọi hành động...", estimatedSeconds: 30 },
    ],
  },
  script: {
    title: "Tiêu đề video...",
    content: "Viết toàn bộ nội dung kịch bản chi tiết tại đây...",
    dialogue: [
      "Câu thoại hoặc dòng phụ đề 1...",
      "Câu thoại hoặc dòng phụ đề 2...",
      "Câu thoại hoặc dòng phụ đề 3...",
    ],
  },
  direct: {
    beats: [
      {
        id: "b1",
        layout: "title-card",
        directorNote: "Ghi chú chi tiết cho phân cảnh mở đầu...",
        visualPrompt: "Mô tả cụ thể hình ảnh cần sinh ra (bằng tiếng Anh, tập trung vào chi tiết hình ảnh)...",
      },
      {
        id: "b2",
        layout: "quote",
        directorNote: "Ghi chú cho phân cảnh tiếp theo...",
        visualPrompt: "Mô tả hình ảnh 2...",
      },
    ],
    visuals: ["Mô tả tổng quan hình ảnh 1...", "Mô tả tổng quan hình ảnh 2..."],
  },
  spec: {
    specVersion: "0.1.0",
    projectSlug: "slug-here",
    topicId: "psychology",
    templateId: "baroque-mono",
    fps: 30,
    narration: {
      audioPath: "audio/narration.wav",
      durationSec: 5,
      words: [
        { id: "w1", text: "Ví", startSec: 0.0, endSec: 0.5, confidence: 0.95 },
        { id: "w2", text: "dụ", startSec: 0.5, endSec: 1.0, confidence: 0.95 },
      ],
    },
    chapters: [
      {
        id: "c1",
        title: "Phần 1",
        range: { startWordId: "w1", endWordId: "w2" },
        beats: [
          {
            id: "b1",
            layout: "title-card",
            directorNote: "Ghi chú đạo diễn",
            visualPrompt: "Visual prompt",
            range: { startWordId: "w1", endWordId: "w2" },
          },
        ],
      },
    ],
    music: [],
    meta: { title: "Tiêu đề video" },
  },
};

export const PipelineInboxView: React.FC<PipelineInboxViewProps> = ({
  slug,
  onRefreshProject,
  onNotify,
  onPipelineComplete,
}) => {
  const [state, setState] = useState<ProjectState | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<any | null>(null);

  // Editor & AI Prompt state
  const [resultJson, setResultJson] = useState("");
  const [isSavedResult, setIsSavedResult] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const promptInputRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (promptInputRef.current) {
      promptInputRef.current.style.height = "auto";
      promptInputRef.current.style.height = `${Math.max(promptInputRef.current.scrollHeight, 60)}px`;
    }
  }, [chatPrompt]);

  const [isGeneratingAiJson, setIsGeneratingAiJson] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunningStage, setIsRunningStage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const nextPendingStage = state?.stages?.find(s => s.status === "pending" || s.status === "running")?.stage;
  
  const canRunNextStage = () => {
    if (!state || !state.stages || state.stages.length === 0) return true;
    return !!nextPendingStage; // We now ALLOW running TTS from the button
  };

  const selectTask = async (task: any) => {
    setActiveTask(task);
    setValidationError(null);
    
    // Khôi phục prompt đã nhập từ localStorage
    const savedPrompt = localStorage.getItem(`faceless_prompt_${slug}_${task.stage}`) || "";
    setChatPrompt(savedPrompt);

    try {
      const res = await api.getTaskResult(slug, task.id, task.stage);
      if (res.hasResult && res.result) {
        setResultJson(JSON.stringify(res.result, null, 2));
        setIsSavedResult(true);
      } else {
        const sample = SAMPLE_TEMPLATES[task.stage] || { stage: task.stage };
        if (task.stage === "spec") {
          sample.projectSlug = slug;
        }
        setResultJson(JSON.stringify(sample, null, 2));
        setIsSavedResult(false);
      }
    } catch {
      const sample = SAMPLE_TEMPLATES[task.stage] || { stage: task.stage };
      setResultJson(JSON.stringify(sample, null, 2));
      setIsSavedResult(false);
    }
  };

  const loadData = async (preferredTaskId?: string) => {
    setIsLoading(true);
    try {
      const [st, tList] = await Promise.all([api.getStatus(slug), api.getTasks(slug)]);
      
      const directTaskIdx = tList.findIndex((t: any) => t.stage === "direct");
      if (directTaskIdx !== -1) {
        tList.splice(directTaskIdx + 1, 0, {
          id: "tts-ui",
          stage: "tts",
          prompt: "Sử dụng giao diện để cấu hình Giọng đọc, chèn cảm xúc và sinh Audio (TTS)."
        });
      }

      setState(st);
      setTasks(tList);

      if (tList.length > 0) {
        let target = tList[tList.length - 1];
        if (preferredTaskId) {
          const found = tList.find((t: any) => t.id === preferredTaskId);
          if (found) target = found;
        }
        await selectTask(target);
      } else {
        setActiveTask(null);
        setResultJson("");
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
      const targetStage = stage || nextPendingStage;
      if (targetStage === "tts") {
        const ttsTask = tasks.find((t) => t.stage === "tts");
        if (ttsTask) selectTask(ttsTask);
        return;
      }
      
      const res = await api.runStage(slug, stage);
      onNotify("success", res.message || `Đã khởi tạo stage ${res.stage}`);
      await loadData(res.taskId);
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
    setIsSavedResult(false);
    setValidationError(null);
  };

  // AI Prompt to JSON Generation
  const handleGenerateAiJson = async (customPrompt?: string) => {
    if (!activeTask) return;
    const promptToUse = (customPrompt || chatPrompt).trim();
    if (!promptToUse) {
      onNotify("error", "Vui lòng nhập mô tả ý tưởng hoặc bấm chọn gợi ý prompt bên dưới!");
      return;
    }

    setIsGeneratingAiJson(true);
    setValidationError(null);
    try {
      const res = await api.generateStageJson(slug, activeTask.stage, promptToUse);
      if (res.success && res.generatedJson) {
        setResultJson(JSON.stringify(res.generatedJson, null, 2));
        setIsSavedResult(false);
        onNotify(
          "success",
          `✨ Agent đã tự động suy luận ra JSON cho stage "${activeTask.stage}"! Hãy kiểm duyệt lại trước khi bấm Thẩm định.`
        );
      } else {
        throw new Error("Không nhận được dữ liệu JSON từ AI");
      }
    } catch (err: any) {
      onNotify("error", `Lỗi sinh JSON từ AI: ${err.message}`);
    } finally {
      setIsGeneratingAiJson(false);
    }
  };

  // Save and Validate with Auto Next Stage
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
        setIsSavedResult(true);

        // Check if there is a next stage to auto-run
        const currIdx = PIPELINE_STAGES.indexOf(activeTask.stage);
        if (currIdx !== -1 && currIdx < PIPELINE_STAGES.length - 1) {
          const nextStage = PIPELINE_STAGES[currIdx + 1];
          onNotify(
            "success",
            `✅ Stage ${activeTask.stage.toUpperCase()} đạt chuẩn! 🚀 Đang tự động kích hoạt Stage tiếp theo: "${nextStage.toUpperCase()}"...`
          );

          try {
            if (nextStage !== "tts") {
              const nextRes = await api.runStage(slug, nextStage);
              await loadData(nextRes.taskId);
            } else {
              // TTS is UI-driven, no background runStage needed. Just refresh to show TTS tab.
              await loadData("tts-ui");
            }
            onRefreshProject();
          } catch (nextErr: any) {
            onNotify("error", `Lỗi khởi tạo stage ${nextStage}: ${nextErr.message}`);
            await loadData(activeTask.id);
            onRefreshProject();
          }
        } else {
          // Spec completed
          onNotify(
            "success",
            `🎉 Toàn bộ 4 giai đoạn Sáng tạo (Outline ➔ Script ➔ Direct ➔ Spec) đã hoàn tất 100%! Bạn có thể chuyển sang tab Storyboard & Assets hoặc TTS & Render để xuất video.`
          );
          await loadData(activeTask.id);
          onRefreshProject();
          if (onPipelineComplete) onPipelineComplete();
        }
      } else {
        const errorDetail = taskVal?.error || "Dữ liệu không đúng cấu trúc schema yêu cầu";
        setValidationError(errorDetail);

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

  const suggestions = activeTask ? PROMPT_SUGGESTIONS[activeTask.stage] || [] : [];


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
            disabled={isRunningStage || !canRunNextStage()}
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
              onClick={() => loadData()}
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
                    onClick={() => selectTask(t)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-brand-950/40 border-brand-500/50 shadow-md shadow-brand-500/5 ring-1 ring-brand-500/30"
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

        {/* Right: AI Chat Assistant + JSON Editor & Validator or TTS */}
        <div className="lg:col-span-2 space-y-4">
          {activeTask?.stage === "tts" ? (
            <TTSGenerator 
              slug={slug} 
              onRefreshProject={onRefreshProject} 
              onNotify={onNotify} 
              onComplete={async () => {
                onNotify("success", "✅ Stage TTS đạt chuẩn! 🚀 Đang tự động kích hoạt Stage tiếp theo: SPEC...");
                try {
                  const nextRes = await api.runStage(slug, "spec");
                  await loadData(nextRes.taskId);
                  onRefreshProject();
                } catch (nextErr: any) {
                  onNotify("error", `Lỗi khởi tạo stage spec: ${nextErr.message}`);
                }
              }}
            />
          ) : (
            <>
              {/* AI Chat Prompt Assistant Box */}
          <div className="p-5 bg-gradient-to-br from-brand-950/30 via-slate-900/70 to-slate-900/60 border border-brand-500/30 rounded-2xl space-y-3.5 shadow-lg shadow-brand-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-brand-500/20 rounded-lg text-brand-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Agent Sáng Tạo: Tự Động Suy Ra JSON
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Nhập ý tưởng dạng văn bản đơn giản, Agent sẽ tự động chuyển hóa thành JSON chuẩn Zod.
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 font-mono">
                {activeTask?.stage ? `Stage: ${activeTask.stage}` : "Chưa chọn stage"}
              </span>
            </div>

            {/* Prompt input */}
            <div className="relative">
              <textarea
                ref={promptInputRef}
                rows={2}
                value={chatPrompt}
                onChange={(e) => {
                  const val = e.target.value;
                  setChatPrompt(val);
                  if (activeTask) {
                    localStorage.setItem(`faceless_prompt_${slug}_${activeTask.stage}`, val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerateAiJson();
                  }
                }}
                disabled={!activeTask || isGeneratingAiJson}
                placeholder={
                  activeTask
                    ? `Nhập ý tưởng cho stage ${activeTask.stage} (VD: 'Giải thích hiệu ứng Dunning-Kruger 3 phần, giọng điệu điềm đạm, sâu sắc...'). Nhấn Ctrl+Enter để sinh.`
                    : "Hãy chọn một task để bắt đầu..."
                }
                className="w-full p-3 pr-28 bg-slate-950/80 border border-slate-700/80 focus:border-brand-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 transition-colors resize-none disabled:opacity-50"
              />

              <button
                type="button"
                onClick={() => handleGenerateAiJson()}
                disabled={!activeTask || isGeneratingAiJson}
                className="absolute right-2.5 bottom-3 flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium shadow-md shadow-brand-600/20 transition-all disabled:opacity-50 active:scale-95"
              >
                {isGeneratingAiJson ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang suy luận...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>AI Sinh JSON</span>
                  </>
                )}
              </button>
            </div>

            {/* Suggestion Chips */}
            {suggestions.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                  Gợi ý nhanh cho {activeTask?.stage}:
                </span>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setChatPrompt(s);
                        if (activeTask) {
                          localStorage.setItem(`faceless_prompt_${slug}_${activeTask.stage}`, s);
                        }
                        handleGenerateAiJson(s);
                      }}
                      disabled={isGeneratingAiJson}
                      className="text-left text-[11px] px-2.5 py-1 bg-slate-800/80 hover:bg-brand-900/40 text-slate-300 hover:text-brand-200 border border-slate-700 hover:border-brand-500/40 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>💡</span>
                      <span className="max-w-xs">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* JSON Result Editor & Validation */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-400" />
                  <span>
                    Editor Kết quả cho:{" "}
                    {activeTask ? `Task ${activeTask.id} (${activeTask.stage})` : "Chưa chọn task"}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kiểm duyệt cấu trúc JSON từ Agent hoặc chỉnh sửa thủ công trước khi bấm Thẩm định.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isSavedResult && (
                  <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã lưu kết quả thực tế</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={!activeTask}
                  className="px-3 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
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
                rows={13}
                value={resultJson}
                onChange={(e) => {
                  setResultJson(e.target.value);
                  setIsSavedResult(false);
                }}
                disabled={!activeTask}
                placeholder="Nhập nội dung JSON kết quả tại đây hoặc bấm 'AI Sinh JSON' ở trên..."
                className="w-full p-3.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl font-mono text-xs text-slate-200 transition-colors leading-relaxed selection:bg-brand-500 selection:text-white disabled:opacity-50"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Thẩm định đạt ➔ Hệ thống tự động kích hoạt <strong>Stage kế tiếp</strong>.
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
                    <span>Lưu & Thẩm định (Tự Động Next Stage)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
