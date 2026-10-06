export * from "./schemas/index.js";
export * from "./types.js";
export * from "./interfaces.js";
export { ProjectManager } from "./project-manager.js";
export { TaskInbox, type TaskItem } from "./task-inbox.js";
export { TemplateManager, BUILTIN_TEMPLATES } from "./template-manager.js";
export { AssetManager } from "./asset-manager.js";
export { LicenseManager, isValidLicenseFormat } from "./license-manager.js";
export { extractShort, autoDetectShortCandidates, type ExtractShortOptions } from "./shorts-extractor.js";
export {
  QAManager,
  type QAItem,
  type QAReport,
  type QASeverity,
  type QACategory,
  type QAMediaInspector,
  type PreRenderQAOptions,
  type PostRenderQAOptions,
} from "./qa-manager.js";
export { z } from "zod";