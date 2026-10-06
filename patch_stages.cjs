const fs = require("fs");
const path = require("path");
const baseDir = path.resolve(__dirname, "projects");

const projects = fs.readdirSync(baseDir);
for (const proj of projects) {
  const statePath = path.resolve(baseDir, proj, "state.json");
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    if (!state.stages.find(s => s.stage === "tts")) {
      const directIndex = state.stages.findIndex(s => s.stage === "direct");
      if (directIndex !== -1) {
        state.stages.splice(directIndex + 1, 0, {
          stage: "tts",
          status: state.stages[directIndex].status === "done" ? "done" : "pending"
        });
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        console.log(`Patched ${proj}`);
      }
    }
  }
}
