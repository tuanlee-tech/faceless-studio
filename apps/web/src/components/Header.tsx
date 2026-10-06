import React from "react";
import { Video, Plus, RefreshCw, Radio } from "lucide-react";

interface HeaderProps {
  serverOnline: boolean;
  onNewProject: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  serverOnline,
  onNewProject,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">Faceless Studio</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Phase 4 UI
              </span>
            </div>
            <p className="text-xs text-slate-400">Hệ thống sản xuất Video Faceless AI</p>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center gap-4">
          {/* Server Connection Status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              serverOnline
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${serverOnline ? "animate-pulse" : ""}`} />
            <span>{serverOnline ? "API Server Online" : "Mất kết nối Server"}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Create Project Button */}
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium shadow-md shadow-brand-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo dự án</span>
          </button>
        </div>
      </div>
    </header>
  );
};
