import React, { useState, useEffect } from "react";
import { ArrowLeft, Layers, Film, ShieldCheck, Clock, Trash2, AlertTriangle } from "lucide-react";
import { PipelineInboxView } from "./PipelineInboxView.js";
import { StoryboardAssetView } from "./StoryboardAssetView.js";
import { QARenderView } from "./QARenderView.js";
import { api } from "../api/client.js";

interface ProjectDetailProps {
  slug: string;
  onBack: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
  onDeleteProject?: (slug: string) => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  slug,
  onBack,
  onNotify,
  onDeleteProject,
}) => {
  const [activeTab, setActiveTab] = useState<"pipeline" | "storyboard" | "render">("pipeline");
  const [projectData, setProjectData] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadProjectInfo = async () => {
    try {
      const res = await api.getProject(slug);
      setProjectData(res.project);
    } catch (err: any) {
      onNotify("error", `Không thể tải thông tin dự án: ${err.message}`);
    }
  };

  useEffect(() => {
    loadProjectInfo();
  }, [slug]);

  const config = projectData?.config;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Navigation & Project Metadata Header */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors border border-slate-800"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight" title={slug}>
                  {config?.title || slug}
                </h2>
                {config?.title && (
                  <span className="text-xs text-slate-500 font-mono">({slug})</span>
                )}
                <span className="text-[11px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono">
                  {config?.topicId || "sample"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Giao diện: <span className="text-slate-300 font-medium">{config?.templateId || "minimal"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{config?.targetMinutes || 1} phút</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Film className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-mono">{config?.formats?.join(", ") || "long-16x9"}</span>
            </div>
            {onDeleteProject && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 font-medium transition-colors"
                title="Xóa dự án này"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa dự án</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === "pipeline"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Pipeline & Task Inbox</span>
          </button>

          <button
            onClick={() => setActiveTab("storyboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === "storyboard"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>2. Storyboard & Assets</span>
          </button>

          <button
            onClick={() => setActiveTab("render")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === "render"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. QA & Render Video</span>
          </button>
        </div>
      </div>

      {/* Tab View Contents */}
      {activeTab === "pipeline" && (
        <PipelineInboxView
          slug={slug}
          onRefreshProject={loadProjectInfo}
          onNotify={onNotify}
          onPipelineComplete={() => setActiveTab("storyboard")}
        />
      )}

      {activeTab === "storyboard" && (
        <StoryboardAssetView
          slug={slug}
          onNotify={onNotify}
        />
      )}

      {activeTab === "render" && (
        <QARenderView
          slug={slug}
          onRefreshProject={loadProjectInfo}
          onNotify={onNotify}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác nhận xóa dự án</h3>
                <p className="text-xs text-slate-400">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn dự án <strong className="text-white font-mono">{slug}</strong>?
              Toàn bộ kịch bản, âm thanh TTS, tài nguyên và video đã render sẽ bị xóa sạch khỏi hệ thống.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDeleteProject?.(slug);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
