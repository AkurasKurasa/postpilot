import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { config, SERVER_ROOT } from "./config.js";
import { corsOptions } from "./cors.js";
import { runs } from "./routes/runs.js";
import { posts } from "./routes/posts.js";

// The Express app without listening or connecting, so tests can drive it directly.
export const app = express();
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

app.use((err, req, res, _next) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(500).json({ error: "Something went wrong on the server." });
});
