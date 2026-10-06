import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header.js";
import { Dashboard } from "./components/Dashboard.js";
import { CreateProjectModal } from "./components/CreateProjectModal.js";
import { api } from "./api/client.js";
import type { ProjectSummary } from "./types/index.js";
import { CheckCircle, AlertTriangle, X } from "lucide-react";

interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
}

export const App: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const checkServerStatus = useCallback(async () => {
    try {
      await api.checkHealth();
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    }
  }, []);

  const loadProjects = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await api.getProjects();
      setProjects(data);
      setServerOnline(true);
    } catch (err: any) {
      setServerOnline(false);
      if (!quiet) {
        addToast("error", `Không thể tải danh sách dự án: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    checkServerStatus();

    // Check health every 30s
    const interval = setInterval(() => {
      checkServerStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadProjects, checkServerStatus]);

  const handleProjectCreated = (slug: string) => {
    addToast("success", `Dự án "${slug}" đã được tạo thành công!`);
    loadProjects(true);
  };

  const handleSelectProject = (slug: string) => {
    addToast("success", `Đã chọn dự án: ${slug}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <Header
        serverOnline={serverOnline}
        onNewProject={() => setIsCreateModalOpen(true)}
        onRefresh={() => loadProjects(true)}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard
          projects={projects}
          isLoading={isLoading}
          onSelectProject={handleSelectProject}
          onNewProject={() => setIsCreateModalOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>Faceless Studio © 2026 — Architecture Phase 4 (Thin Client Web UI)</p>
      </footer>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleProjectCreated}
      />

      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-medium transition-all animate-slideUp ${
              t.type === "success"
                ? "bg-emerald-950/90 text-emerald-200 border-emerald-800/80 shadow-emerald-950/40"
                : "bg-rose-950/90 text-rose-200 border-rose-800/80 shadow-rose-950/40"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white ml-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
