import React, { useState, useEffect } from "react";
import { ArrowLeft, Layers, Film, ShieldCheck, Clock } from "lucide-react";
import { PipelineInboxView } from "./PipelineInboxView.js";
import { StoryboardAssetView } from "./StoryboardAssetView.js";
import { QARenderView } from "./QARenderView.js";
import { api } from "../api/client.js";

interface ProjectDetailProps {
  slug: string;
  onBack: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  slug,
  onBack,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<"pipeline" | "storyboard" | "render">("pipeline");
  const [projectData, setProjectData] = useState<any | null>(null);

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
                <h2 className="text-xl font-bold text-white tracking-tight">{slug}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono">
                  {config?.topicId || "sample"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Giao diện: <span className="text-slate-300 font-medium">{config?.templateId || "minimal"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{config?.targetMinutes || 1} phút</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Film className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-mono">{config?.formats?.join(", ") || "long-16x9"}</span>
            </div>
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
    </div>
  );
};
