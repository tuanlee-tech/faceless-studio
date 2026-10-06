export interface StageEntry {
  stage: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  inputHash?: string;
  outputHash?: string;
  completedAt?: string;
  error?: string;
}

export interface ProjectState {
  projectSlug: string;
  stages: StageEntry[];
  updatedAt: string;
}

export interface ProjectConfig {
  slug: string;
  title?: string;
  topicId: string;
  templateId: string;
  targetMinutes: number;
  formats: ("long-16x9" | "short-9x16")[];
  assetBudget?: number;
  qaThreshold?: number;
  voice?: string;
  speed?: number;
  createdAt: string;
}

export interface ProjectSummary {
  slug: string;
  config?: ProjectConfig;
  state?: ProjectState;
  specExists: boolean;
  updatedAt?: string;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description?: string;
  category?: string;
  aspectRatios?: string[];
  fonts?: Array<{ family: string; file: string; weight?: string }>;
}

export interface TopicInfo {
  id: string;
  name: string;
  description?: string;
}

export interface CreateProjectPayload {
  slug: string;
  title?: string;
  topic?: string;
  template?: string;
  minutes?: number;
  formats?: ("long-16x9" | "short-9x16")[];
  assetBudget?: number;
  qaThreshold?: number;
  voice?: string;
  speed?: number;
}
