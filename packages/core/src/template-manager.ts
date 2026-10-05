import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  TemplateConfigSchema,
  type TemplateConfig,
  BUILTIN_TEMPLATES,
} from "./schemas/template-config.js";

export { BUILTIN_TEMPLATES };

export class TemplateManager {
  constructor(private templatesDir?: string) {}

  resolveTemplate(templateId: string): TemplateConfig {
    const candidates = [
      this.templatesDir ? resolve(this.templatesDir, templateId, "template.json") : null,
      resolve(process.cwd(), "templates", templateId, "template.json"),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        try {
          const raw = JSON.parse(readFileSync(candidate, "utf-8"));
          return TemplateConfigSchema.parse(raw);
        } catch {
          // fall through to built-ins if parse fails
        }
      }
    }

    if (BUILTIN_TEMPLATES[templateId]) {
      return BUILTIN_TEMPLATES[templateId];
    }

    // Default fallback to minimal
    return BUILTIN_TEMPLATES.minimal;
  }
}
