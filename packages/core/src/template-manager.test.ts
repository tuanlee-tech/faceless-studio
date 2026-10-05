import { describe, it, expect } from "vitest";
import { TemplateManager, BUILTIN_TEMPLATES } from "./template-manager.js";
import { resolve } from "node:path";

describe("TemplateManager", () => {
  const tm = new TemplateManager(resolve(process.cwd(), "templates"));

  it("resolves built-in template minimal", () => {
    const config = tm.resolveTemplate("minimal");
    expect(config.id).toBe("minimal");
    expect(config.colors.background).toBe("#000000");
  });

  it("resolves template baroque-mono from disk", () => {
    const config = tm.resolveTemplate("baroque-mono");
    expect(config.id).toBe("baroque-mono");
    expect(config.colors.background).toBe("#0c0a09");
    expect(config.subtitles.highlightColor).toBe("#fbbf24");
    expect(config.fonts.length).toBeGreaterThan(0);
  });

  it("resolves template clean-split from disk", () => {
    const config = tm.resolveTemplate("clean-split");
    expect(config.id).toBe("clean-split");
    expect(config.colors.background).toBe("#0f172a");
    expect(config.subtitles.highlightColor).toBe("#38bdf8");
  });

  it("falls back to minimal on unknown template", () => {
    const config = tm.resolveTemplate("unknown-template");
    expect(config.id).toBe("minimal");
  });
});
