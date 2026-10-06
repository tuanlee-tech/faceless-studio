import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3001;
const baseDir = process.env.STUDIO_BASE_DIR || "projects";

const app = createApp({ baseDir });

console.log(`🚀 Faceless Studio API Server running at http://localhost:${PORT}`);
console.log(`📁 Base project directory: ${baseDir}`);

serve({
  fetch: app.fetch,
  port: PORT,
});

export { app };
