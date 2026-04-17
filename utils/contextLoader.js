import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function readJson(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  return JSON.parse(raw);
}

function readJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
  return files.map((f) => ({ name: f, data: readJson(path.join(dirPath, f)) }));
}

let cache = null;

export function loadContext() {
  if (cache && process.env.CONTEXT_CACHE !== "false") return cache;

  const systemPromptPath = path.join(ROOT, "system_prompt.md");
  const policiesDir = path.join(ROOT, "policies");
  const worflowsDir = path.join(ROOT, "worflows");

  const systemPrompt = fs.existsSync(systemPromptPath)
    ? fs.readFileSync(systemPromptPath, "utf8")
    : "";

  const policies = readJsonFiles(policiesDir);
  const workflows = readJsonFiles(worflowsDir);

  cache = {
    system_prompt: systemPrompt,
    policies,
    workflows
  };

  return cache;
}
