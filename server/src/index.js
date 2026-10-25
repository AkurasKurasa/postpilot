import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { config, SERVER_ROOT } from "./config.js";
import { corsOptions } from "./cors.js";
import { db } from "./db/index.js";
import { runs } from "./routes/runs.js";
import { posts } from "./routes/posts.js";

const app = express();
app.use(cors(corsOptions(config.corsOrigins)));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, llm: config.llmMode, model: config.llmMode === "anthropic" ? config.model : null, db: config.dbMode })
);
app.use("/api/runs", runs);
app.use("/api/posts", posts);

// In production, serve the built React app from client/dist
const dist = path.resolve(SERVER_ROOT, "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

try {
  await db.connect();
} catch (e) {
  console.error(`\nCould not connect to MongoDB at ${config.mongoUri}\n${e.message}\n` +
    "Start MongoDB, set MONGODB_URI in server/.env, or set DB_MODE=memory to try the app without a database.\n");
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`PostPilot API on http://localhost:${config.port}`);
  console.log(`  agents: ${config.llmMode === "mock" ? "mock (no API key)" : config.model}   database: ${config.dbMode === "memory" ? "in-memory" : config.mongoUri}`);
});
