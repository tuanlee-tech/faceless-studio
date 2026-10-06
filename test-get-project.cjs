const fs = require('fs');
const { resolve } = require('path');
const baseDir = resolve(__dirname, 'projects');

const projDir = resolve(baseDir, 'bi-an-tam-giac-quy-bermuda');
const configPath = resolve(projDir, 'project.json');
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log("config parsed");
} catch (e) {
  console.error("config error", e);
}

try {
  const state = require('./projects/bi-an-tam-giac-quy-bermuda/state.json');
  console.log("state read");
} catch(e) {
  console.error("state error", e);
}
