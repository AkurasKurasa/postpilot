import { Router } from "express";
import { db } from "../db/index.js";
import { runPipeline } from "../orchestrator.js";
import { log } from "../utils/logger.js";
import { asyncRoute } from "../utils/asyncRoute.js";
import { config } from "../config.js";

export const runs = Router();

function normalizeBrief(body = {}) {
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const prices = (Array.isArray(body.prices) ? body.prices : [])
    .map((p) => ({ item: str(p?.item), price: Number(String(p?.price ?? "").replace(/[₱,\s]/g, "")) }))
    .filter((p) => p.item && Number.isFinite(p.price) && p.price > 0);
  return {
    name: str(body.name) || "My Business",
    type: str(body.type) || "Shop",
    voice: str(body.voice) || "Friendly",
    goal: str(body.goal),
    promo: str(body.promo),
    prices,
    count: Math.min(config.maxPosts, Math.max(1, Number(body.count) || 5)),
    simulateStubbornWriter: config.llmMode === "mock" && body.simulateStubbornWriter === true,
  };
}

// Start a run. Validates input, then runs the orchestrated pipeline in the background.
runs.post("/", asyncRoute(async (req, res) => {
  const brief = normalizeBrief(req.body);
  if (!brief.goal || !brief.prices.length) {
    await log(null, "ERROR", { status: 400, message: "Goal and price list are required." });
    return res.status(400).json({ error: "Goal and price list are required." });
  }
  const run = await db.createRun({ brief, status: "running", llmMode: config.llmMode });
  // Not awaited: the client polls GET /api/runs/:id. The catch stops a failure in the pipeline's
  // own error handling (e.g. the database is down) from crashing the process.
  runPipeline(run.id, brief).catch((err) => console.error(`Pipeline for run ${run.id} failed:`, err));
  res.status(202).json(run);
}));

runs.get("/", asyncRoute(async (_req, res) => {
  const list = await db.listRuns();
  const counts = await db.countPosts(list.map((r) => r.id));
  res.json(list.map(({ progress, ...r }) => ({ ...r, counts: counts[r.id] || { total: 0, APPROVED: 0, REJECTED: 0, PENDING: 0 } })));
}));

runs.get("/:id", asyncRoute(async (req, res) => {
  const run = await db.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Plan not found." });
  const posts = await db.listPosts(run.id);
  res.json({ run, posts, metrics: metrics(posts) });
}));

runs.get("/:id/events", asyncRoute(async (req, res) => {
  res.json(await db.listEvents(req.params.id));
}));

// Final output — the server returns ONLY approved posts. This is the approval gate.
runs.get("/:id/final", asyncRoute(async (req, res) => {
  const posts = await db.listPosts(req.params.id);
  res.json(posts.filter((p) => p.decision === "APPROVED").map(({ trail, issues, ...p }) => p));
}));

export function metrics(posts) {
  const byCategory = {};
  for (const p of posts)
    for (const t of p.trail || [])
      for (const c of new Set((t.issues || []).map((i) => i.category))) byCategory[c] = (byCategory[c] || 0) + 1;
  const n = posts.length;
  return {
    total: n,
    firstPass: posts.filter((p) => !(p.trail?.[0]?.issues || []).length).length,
    escalated: posts.filter((p) => p.status === "NEEDS_HUMAN_ATTENTION").length,
    violations: byCategory,
    approved: posts.filter((p) => p.decision === "APPROVED").length,
    edited: posts.filter((p) => p.decision === "APPROVED" && p.edited).length,
    rejected: posts.filter((p) => p.decision === "REJECTED").length,
    pending: posts.filter((p) => p.decision === "PENDING").length,
  };
}
