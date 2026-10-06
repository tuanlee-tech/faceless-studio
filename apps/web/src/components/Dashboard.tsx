import React, { useState, useMemo } from "react";
import { Search, Filter, FolderPlus, Film, CheckCircle2, Clock, Trash2, AlertTriangle } from "lucide-react";
import { ProjectCard } from "./ProjectCard.js";
import type { ProjectSummary } from "../types/index.js";

interface DashboardProps {
  projects: ProjectSummary[];
  isLoading: boolean;
  onSelectProject: (slug: string) => void;
  onNewProject: () => void;
  onDeleteProject?: (slug: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  isLoading,
  onSelectProject,
  onNewProject,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = projects.length;
    let completed = 0;
    let running = 0;

    for (const p of projects) {
      const stages = p.state?.stages || [];
      const isDone = stages.length > 0 && stages.every((s) => s.status === "done");
      const isRunning = stages.some((s) => s.status === "running");

      if (isDone) completed++;
      else if (isRunning) running++;
    }

    return { total, completed, running };
  }, [projects]);

  // Extract unique topics for filtering
  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>();
    for (const p of projects) {
      if (p.config?.topicId) topicSet.add(p.config.topicId);
    }
    return Array.from(topicSet);
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch = p.slug.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesTopic = selectedTopic === "all" || p.config?.topicId === selectedTopic;
      return matchesSearch && matchesTopic;
    });
  }, [projects, searchQuery, selectedTopic]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Projects */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Tổng số dự án</p>
            <h4 className="text-2xl font-bold text-white mt-1">{metrics.total}</h4>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-300">
            <Film className="w-6 h-6" />
          </div>
        </div>

        {/* In Progress */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-400">Đang thực thi</p>
            <h4 className="text-2xl font-bold text-white mt-1">{metrics.running}</h4>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Completed */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-400">Hoàn thành</p>
            <h4 className="text-2xl font-bold text-white mt-1">{metrics.completed}</h4>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm dự án theo slug..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          {availableTopics.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:border-brand-500 transition-colors"
              >
                <option value="all">Tất cả chủ đề</option>
                {availableTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Projects Grid / States */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-48 rounded-2xl bg-slate-900/30 border border-slate-800/50 animate-pulse p-5 space-y-4"
            >
              <div className="h-5 bg-slate-800/60 rounded w-1/2" />
              <div className="h-4 bg-slate-800/40 rounded w-1/3" />
              <div className="h-2 bg-slate-800/40 rounded w-full mt-6" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <ProjectCard
              key={p.slug}
              project={p}
              onSelect={onSelectProject}
              onDelete={onDeleteProject ? (slug) => setProjectToDelete(slug) : undefined}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mb-4">
            <FolderPlus className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">
            {searchQuery ? "Không tìm thấy dự án phù hợp" : "Chưa có dự án nào"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            {searchQuery
              ? "Hãy thử tìm bằng từ khóa khác hoặc xóa bộ lọc."
              : "Bắt đầu khởi tạo kịch bản video AI đầu tiên của bạn chỉ trong vài cú click."}
          </p>
          {!searchQuery && (
            <button
              onClick={onNewProject}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-brand-600/20"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Tạo dự án mới ngay</span>
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
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
              Bạn có chắc chắn muốn xóa vĩnh viễn dự án <strong className="text-white font-mono">{projectToDelete}</strong>?
              Toàn bộ kịch bản, âm thanh TTS, tài nguyên và video đã render sẽ bị xóa sạch khỏi hệ thống.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const slug = projectToDelete;
                  setProjectToDelete(null);
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
