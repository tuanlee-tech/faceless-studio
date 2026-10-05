import { z } from "zod";

export const TemplateFontSchema = z.object({
  family: z.string(),
  file: z.string(),
  weight: z.union([z.string(), z.number()]).optional().default("400"),
  style: z.enum(["normal", "italic"]).optional().default("normal"),
});

export const TemplateColorsSchema = z.object({
  background: z.string(),
  text: z.string(),
  primary: z.string(),
  secondary: z.string().optional(),
  accent: z.string().optional(),
  highlight: z.string().default("#ffd700"),
});

export const TemplateSubtitleStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().default(48),
  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#ffd700"),
  bottomOffset: z.number().default(80),
  maxWordsPerLine: z.number().positive().default(6),
  textTransform: z.enum(["uppercase", "lowercase", "capitalize", "none"]).default("none"),
});

export const TemplateConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default("1.0.0"),
  description: z.string().optional(),
  fonts: z.array(TemplateFontSchema).default([]),
  colors: TemplateColorsSchema,
  subtitles: TemplateSubtitleStyleSchema.default({}),
  layoutPresets: z.array(z.string()).default(["center-text"]),
  motionPresets: z.array(z.string()).default(["fade-in"]),
});

export type TemplateFont = z.infer<typeof TemplateFontSchema>;
export type TemplateColors = z.infer<typeof TemplateColorsSchema>;
export type TemplateSubtitleStyle = z.infer<typeof TemplateSubtitleStyleSchema>;
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export const BUILTIN_TEMPLATES: Record<string, TemplateConfig> = {
  minimal: {
    id: "minimal",
    name: "Minimal Dark",
    version: "1.0.0",
    description: "Template tối giản Phase 1, nền đen chữ trắng",
    fonts: [],
    colors: {
      background: "#000000",
      text: "#ffffff",
      primary: "#888888",
      secondary: "#555555",
      accent: "#aaaaaa",
      highlight: "#ffd700",
    },
    subtitles: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 44,
      color: "#ffffff",
      highlightColor: "#ffd700",
      bottomOffset: 80,
      maxWordsPerLine: 6,
      textTransform: "none",
    },
    layoutPresets: ["center-text"],
    motionPresets: ["fade-in"],
  },
  "baroque-mono": {
    id: "baroque-mono",
    name: "Baroque Monochrome",
    version: "1.0.0",
    description: "Phong cách cổ điển, trầm mặc, kể chuyện lịch sử & triết học với gam màu tối và font Serif",
    fonts: [
      {
        family: "Playfair Display",
        file: "fonts/PlayfairDisplay-Regular.ttf",
        weight: "400",
        style: "normal",
      },
      {
        family: "Playfair Display",
        file: "fonts/PlayfairDisplay-Bold.ttf",
        weight: "700",
        style: "normal",
      },
    ],
    colors: {
      background: "#0c0a09",
      text: "#f5f5f4",
      primary: "#d97706",
      secondary: "#78716c",
      accent: "#b45309",
      highlight: "#fbbf24",
    },
    subtitles: {
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: 48,
      color: "#f5f5f4",
      highlightColor: "#fbbf24",
      bottomOffset: 100,
      maxWordsPerLine: 6,
      textTransform: "none",
    },
    layoutPresets: ["center-text", "ornate-frame", "full-bleed"],
    motionPresets: ["fade-in", "slow-zoom", "cross-fade"],
  },
  "clean-split": {
    id: "clean-split",
    name: "Clean Split",
    version: "1.0.0",
    description: "Phong cách hiện đại, tin tức & tutorial, chia đôi màn hình giữa text và visual với font Sans-serif",
    fonts: [
      {
        family: "Be Vietnam Pro",
        file: "fonts/BeVietnamPro-Regular.ttf",
        weight: "400",
        style: "normal",
      },
      {
        family: "Be Vietnam Pro",
        file: "fonts/BeVietnamPro-Bold.ttf",
        weight: "700",
        style: "normal",
      },
    ],
    colors: {
      background: "#0f172a",
      text: "#f8fafc",
      primary: "#38bdf8",
      secondary: "#64748b",
      accent: "#0ea5e9",
      highlight: "#38bdf8",
    },
    subtitles: {
      fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
      fontSize: 44,
      color: "#f8fafc",
      highlightColor: "#38bdf8",
      bottomOffset: 80,
      maxWordsPerLine: 7,
      textTransform: "none",
    },
    layoutPresets: ["split-left", "split-right", "center-card", "full-bleed"],
    motionPresets: ["slide-up", "fade-in", "scale-in"],
  },
};

