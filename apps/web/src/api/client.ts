import type {
  ProjectSummary,
  ProjectConfig,
  ProjectState,
  TemplateInfo,
  TopicInfo,
  CreateProjectPayload,
} from "../types/index.js";

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:3005";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  getEventsUrl(slug: string): string {
    return `${API_BASE}/projects/${slug}/events`;
  },

  async checkHealth(): Promise<{ status: string; uptime: number }> {
    return request<{ status: string; uptime: number }>("/health");
  },

  async getTemplates(): Promise<TemplateInfo[]> {
    const res = await request<{ success: boolean; templates: TemplateInfo[] }>("/templates");
    return res.templates || [];
  },

  async getTopics(): Promise<TopicInfo[]> {
    const res = await request<{ success: boolean; topics: TopicInfo[] }>("/topics");
    return res.topics || [];
  },

  async getProjects(): Promise<ProjectSummary[]> {
    const res = await request<{ success: boolean; projects: ProjectSummary[] }>("/projects");
    return res.projects || [];
  },

  async getProject(slug: string): Promise<{
    project: {
      slug: string;
      config?: ProjectConfig;
      state?: ProjectState;
      specExists: boolean;
    };
  }> {
    return request(`/projects/${slug}`);
  },

  async getStatus(slug: string): Promise<ProjectState> {
    const res = await request<{ success: boolean; state: ProjectState }>(`/projects/${slug}/status`);
    return res.state;
  },

  async createProject(payload: CreateProjectPayload): Promise<{
    success: boolean;
    project: {
      slug: string;
      config: ProjectConfig;
      state: ProjectState;
      specExists: boolean;
    };
  }> {
    return request("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteProject(slug: string): Promise<{
    success: boolean;
    message?: string;
    slug?: string;
    error?: string;
  }> {
    return request(`/projects/${slug}`, {
      method: "DELETE",
    });
  },

  async runStage(slug: string, stage?: string): Promise<{
    success: boolean;
    stage: string;
    status: string;
    taskId?: string;
    taskFile?: string;
    message?: string;
  }> {
    return request(`/projects/${slug}/run`, {
      method: "POST",
      body: JSON.stringify({ stage }),
    });
  },

  async validateTasks(slug: string, taskId?: string): Promise<{
    success: boolean;
    slug: string;
    results: Array<{ taskId: string; stage: string; status: string; error?: string }>;
  }> {
    return request(`/projects/${slug}/validate`, {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
  },

  async extractShorts(slug: string): Promise<{
    success: boolean;
    shorts: string[];
    candidates: any[];
  }> {
    return request(`/projects/${slug}/shorts`, {
      method: "POST",
    });
  },

  async render(slug: string, options: { format?: "long-16x9" | "short-9x16"; spec?: string } = {}): Promise<{
    success: boolean;
    outPath: string;
    format: string;
  }> {
    return request(`/projects/${slug}/render`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async getQA(slug: string, gate: "pre" | "post" = "pre", video?: string): Promise<any> {
    const q = video ? `&video=${encodeURIComponent(video)}` : "";
    return request(`/projects/${slug}/qa?gate=${gate}${q}`);
  },

  async getSpec(slug: string, file = "spec.json"): Promise<any> {
    return request(`/projects/${slug}/spec?file=${file}`);
  },

  async getTasks(slug: string): Promise<any[]> {
    const res = await request<{ success: boolean; tasks: any[] }>(`/projects/${slug}/tasks`);
    return res.tasks || [];
  },

  async saveTaskResult(slug: string, taskId: string, result: any, stage?: string): Promise<{ success: boolean }> {
    return request(`/projects/${slug}/tasks/${taskId}/result`, {
      method: "POST",
      body: JSON.stringify({ result, stage }),
    });
  },

  async getTaskResult(slug: string, taskId: string, stage?: string): Promise<{ success: boolean; hasResult: boolean; result: any }> {
    const q = stage ? `?stage=${encodeURIComponent(stage)}` : "";
    return request(`/projects/${slug}/tasks/${taskId}/result${q}`);
  },

  async generateStageJson(slug: string, stage: string, prompt: string): Promise<{ success: boolean; stage: string; generatedJson: any }> {
    return request(`/projects/${slug}/ai/generate-stage-json`, {
      method: "POST",
      body: JSON.stringify({ stage, prompt }),
    });
  },

  async generateAiAsset(slug: string, beatId?: string, prompt?: string, model?: string): Promise<{ success: boolean; beatId: string; imagePath: string; source: string; manifest: any }> {
    return request(`/projects/${slug}/assets/generate-ai`, {
      method: "POST",
      body: JSON.stringify({ beatId, prompt, model }),
    });
  },

  async generateAllAiAssets(slug: string, model?: string): Promise<{ success: boolean; generatedCount: number; totalBeats: number; manifest: any; results: any[] }> {
    return request(`/projects/${slug}/assets/generate-ai-all`, {
      method: "POST",
      body: JSON.stringify({ model }),
    });
  },

  async getTaskErrors(slug: string, taskId: string): Promise<{ success: boolean; hasErrors: boolean; content: string | null }> {
    return request(`/projects/${slug}/tasks/${taskId}/errors`);
  },

  async exportPromptPack(slug: string): Promise<{ success: boolean; promptPack: string; count: number; path: string }> {
    return request(`/projects/${slug}/assets/export`);
  },

  async uploadAsset(slug: string, filename: string, contentBase64: string): Promise<{ success: boolean; count: number; imported: any[] }> {
    return request(`/projects/${slug}/assets/upload`, {
      method: "POST",
      body: JSON.stringify({ filename, contentBase64 }),
    });
  },

  async getAssetManifest(slug: string): Promise<any> {
    return request(`/projects/${slug}/assets/manifest`);
  },

  getFileUrl(slug: string, relativePath: string): string {
    return `${API_BASE}/projects/${slug}/files/${relativePath.replace(/^\/+/, "")}`;
  },
};
