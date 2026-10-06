import React, { useState, useEffect } from "react";
import { X, Sparkles, ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { api } from "../api/client.js";
import type { TemplateInfo, TopicInfo, CreateProjectPayload } from "../types/index.js";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [slug, setSlug] = useState("");
  const [topic, setTopic] = useState("sample");
  const [template, setTemplate] = useState("minimal");
  const [minutes, setMinutes] = useState(1);
  const [formats, setFormats] = useState<("long-16x9" | "short-9x16")[]>(["long-16x9"]);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voice, setVoice] = useState("default");
  const [speed, setSpeed] = useState(1.0);
  const [assetBudget, setAssetBudget] = useState(50);
  const [qaThreshold, setQaThreshold] = useState(70);

  // Dynamic dropdowns
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch topics and templates on modal open
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoadingOptions(true);
    setErrorMessage(null);

    Promise.all([api.getTopics().catch(() => []), api.getTemplates().catch(() => [])])
      .then(([tList, tmplList]) => {
        if (!mounted) return;
        setTopics(tList.length > 0 ? tList : [{ id: "sample", name: "Sample Topic" }]);
        setTemplates(
          tmplList.length > 0
            ? tmplList
            : [
                { id: "minimal", name: "Minimal" },
                { id: "baroque-mono", name: "Baroque Mono" },
                { id: "clean-split", name: "Clean Split" },
              ]
        );
      })
      .finally(() => {
        if (mounted) setIsLoadingOptions(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto sanitize to kebab-case
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    setSlug(val);
  };

  const handleFormatToggle = (fmt: "long-16x9" | "short-9x16") => {
    if (formats.includes(fmt)) {
      if (formats.length === 1) return; // Must have at least 1 format
      setFormats(formats.filter((f) => f !== fmt));
    } else {
      setFormats([...formats, fmt]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanSlug = slug.trim().replace(/^-+|-+$/g, "");
    if (!cleanSlug) {
      setErrorMessage("Vui lòng nhập tên slug dự án.");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      setErrorMessage("Slug chỉ được chứa chữ thường (a-z), số (0-9) và dấu gạch nối (-).");
      return;
    }

    if (formats.length === 0) {
      setErrorMessage("Cần chọn ít nhất một định dạng video (16:9 hoặc 9:16).");
      return;
    }

    const payload: CreateProjectPayload = {
      slug: cleanSlug,
      topic,
      template,
      minutes: Number(minutes),
      formats,
      assetBudget: Number(assetBudget),
      qaThreshold: Number(qaThreshold),
      voice,
      speed: Number(speed),
    };

    setIsSubmitting(true);
    try {
      await api.createProject(payload);
      onCreated(cleanSlug);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Tạo dự án thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Tạo dự án video mới</h2>
              <p className="text-xs text-slate-400">Khởi tạo quy trình pipeline tự động (studio new)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Project Slug */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tên định danh (Slug) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={handleSlugChange}
              placeholder="vi-du: tri-tue-nhan-tao"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 transition-colors font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Dùng làm tên thư mục dự án (chữ thường, gạch ngang).</p>
          </div>

          {/* Topic & Template Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Topic Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Chủ đề (Topic)
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isLoadingOptions}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-slate-100 transition-colors"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Template Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Giao diện (Template)
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                disabled={isLoadingOptions}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-slate-100 transition-colors"
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name || tmpl.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Minutes & Formats */}
          <div className="grid grid-cols-2 gap-4">
            {/* Target Duration */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Thời lượng mục tiêu (Phút)
              </label>
              <input
                type="number"
                min="0.5"
                max="60"
                step="0.5"
                value={minutes}
                onChange={(e) => setMinutes(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-slate-100 font-mono"
              />
            </div>

            {/* Formats Checkboxes */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Định dạng xuất bản
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleFormatToggle("long-16x9")}
                  className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-medium transition-all ${
                    formats.includes("long-16x9")
                      ? "bg-brand-500/20 text-brand-300 border-brand-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  16:9 Dài
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatToggle("short-9x16")}
                  className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-medium transition-all ${
                    formats.includes("short-9x16")
                      ? "bg-brand-500/20 text-brand-300 border-brand-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  9:16 Short
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Accordion Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>Tùy chọn nâng cao (Voice, Budget, QA)</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Advanced Fields */}
          {showAdvanced && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Voice ID</label>
                  <input
                    type="text"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tốc độ đọc (Speed)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="2.0"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value) || 1.0)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Ngân sách Asset</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={assetBudget}
                    onChange={(e) => setAssetBudget(parseInt(e.target.value, 10) || 50)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Ngưỡng QA (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={qaThreshold}
                    onChange={(e) => setQaThreshold(parseInt(e.target.value, 10) || 70)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-xl text-sm font-medium shadow-md shadow-brand-600/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang khởi tạo...</span>
                </>
              ) : (
                <span>Khởi tạo dự án</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
