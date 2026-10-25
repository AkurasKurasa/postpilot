import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, "..");

const apiKey = process.env.ANTHROPIC_API_KEY || "";

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/postpilot",
  dbMode: process.env.DB_MODE === "memory" ? "memory" : "mongo",
  apiKey,
  model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
  llmMode: process.env.LLM_MODE === "mock" || !apiKey ? "mock" : "anthropic",
  mockDelay: Number(process.env.MOCK_STEP_DELAY_MS ?? 600),
  maxRevisions: 2,
  maxPosts: 7,
};
