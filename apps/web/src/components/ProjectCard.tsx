import React from "react";
import { Clock, Layers, Film, CheckCircle2, AlertCircle, Loader2, CircleDot } from "lucide-react";
import type { ProjectSummary } from "../types/index.js";

interface ProjectCardProps {
  project: ProjectSummary;
  onSelect: (slug: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect }) => {
  const { slug, config, state } = project;
  const stages = state?.stages || [];

  const totalStages = stages.length;
  const completedStages = stages.filter((s) => s.status === "done").length;
  const hasError = stages.some((s) => s.status === "failed");
  const isRunning = stages.some((s) => s.status === "running");
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done":
        return <span className="inline-flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">done</span>;
      case "running":
        return <span className="inline-flex items-center text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded animate-pulse">running</span>;
      case "failed":
        return <span className="inline-flex items-center text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">failed</span>;
      default:
        return <span className="inline-flex items-center text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700/50 px-1.5 py-0.5 rounded">pending</span>;
    }
  };

  return (
    <div
      onClick={() => onSelect(slug)}
      className="group relative bg-slate-900/60 border border-slate-800 hover:border-brand-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-brand-500/5 hover:-translate-y-0.5 flex flex-col justify-between"
    >
      <div>
        {/* Header: Slug & Overall Status Icon */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-base text-slate-100 group-hover:text-brand-300 transition-colors tracking-tight line-clamp-1">
              {slug}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {config?.topicId || "Chung"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-brand-950/60 text-brand-300 border border-brand-800/40">
                {config?.templateId || "minimal"}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            {hasError ? (
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center" title="Lỗi trong quá trình xử lý">
                <AlertCircle className="w-4 h-4" />
              </span>
            ) : isRunning ? (
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center" title="Đang chạy stage">
                <Loader2 className="w-4 h-4 animate-spin" />
              </span>
            ) : progressPercent === 100 ? (
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center" title="Đã hoàn thành">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            ) : (
              <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 flex items-center" title="Đang chờ">
                <CircleDot className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>

        {/* Formats & Minutes */}
        <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{config?.targetMinutes || 1} phút</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex gap-1">
              {config?.formats?.map((fmt) => (
                <span key={fmt} className="font-mono text-[11px] text-slate-300">
                  {fmt === "long-16x9" ? "16:9" : "9:16"}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Tiến độ Pipeline
            </span>
            <span className="font-medium text-slate-200">
              {completedStages}/{totalStages} stages ({progressPercent}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                hasError
                  ? "bg-rose-500"
                  : progressPercent === 100
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-brand-500 to-indigo-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer: Stage Pills & Date */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <div className="flex flex-wrap gap-1">
          {stages.slice(0, 4).map((s) => (
            <div key={s.stage} className="flex items-center gap-1 bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800 text-[11px]">
              <span className="text-slate-400 font-mono">{s.stage}</span>
              {getStatusBadge(s.status)}
            </div>
          ))}
          {stages.length > 4 && (
            <span className="text-slate-500 text-[11px] self-center">+{stages.length - 4}</span>
          )}
        </div>
      </div>
    </div>
  );
};
