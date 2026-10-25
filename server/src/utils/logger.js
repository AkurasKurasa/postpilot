// Audit log: every agent action and human decision goes to MongoDB and to logs/audit-log.jsonl.
import fs from "node:fs";
import path from "node:path";
import { SERVER_ROOT } from "../config.js";
import { db } from "../db/index.js";

const LOG_DIR = path.join(SERVER_ROOT, "logs");

export async function log(runId, event, data = {}) {
  const entry = { time: new Date().toISOString(), run: runId, event, data };
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, "audit-log.jsonl"), JSON.stringify(entry) + "\n");
  } catch (e) {
    console.error("Could not write audit-log.jsonl:", e.message);
  }
  await db.addEvent(runId, event, data);
}
