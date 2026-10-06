import type {
  ProjectSummary,
  ProjectConfig,
  ProjectState,
  TemplateInfo,
  TopicInfo,
  CreateProjectPayload,
} from "../types/index.js";

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:3001";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok || data.success === false) {
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

  async getQA(slug: string, gate: "pre" | "post" = "pre"): Promise<any> {
    return request(`/projects/${slug}/qa?gate=${gate}`);
  },

  async getSpec(slug: string, file = "spec.json"): Promise<any> {
    return request(`/projects/${slug}/spec?file=${file}`);
  },

  async getTasks(slug: string): Promise<any[]> {
    const res = await request<{ success: boolean; tasks: any[] }>(`/projects/${slug}/tasks`);
    return res.tasks || [];
  },
};
