import { Router } from "express";
import { db } from "../db/index.js";
import { log } from "../utils/logger.js";
import { asyncRoute } from "../utils/asyncRoute.js";
import { runGovernanceChecks } from "../governance/rules.js";

export const posts = Router();

// Human decision — approve (with optional edit), reject, or reset to pending.
posts.patch("/:id/decision", asyncRoute(async (req, res) => {
  const post = await db.getPost(req.params.id);
  const { decision, caption, acknowledgeIssues } = req.body || {};
  if (!post || !["APPROVED", "REJECTED", "PENDING"].includes(decision)) {
    return res.status(400).json({ error: "Invalid request." });
  }
  const run = await db.getRun(post.run);
  const newCaption = typeof caption === "string" && caption.trim() ? caption.trim() : post.caption;
  const edited = newCaption !== post.caption;

  // Edits are re-checked by the hard rules. Unedited flagged posts keep their reviewer issues.
  const openIssues = [
    ...runGovernanceChecks({ caption: newCaption }, run.brief),
    ...(edited ? [] : (post.issues || []).filter((i) => i.source === "Reviewer")),
  ];
  if (decision === "APPROVED" && openIssues.length && acknowledgeIssues !== true) {
    return res.status(409).json({ error: "This caption still breaks a rule. Fix it or approve anyway.", issues: openIssues });
  }

  const overrides = decision === "APPROVED" ? openIssues.map((i) => `${i.source}: ${i.message}`) : [];
  const updated = await db.updatePost(post.id, {
    decision,
    caption: newCaption,
    edited: post.edited || edited,
    overrides,
  });

  const event = decision === "PENDING" ? "HUMAN_RESET" : `HUMAN_${decision}`;
  await log(post.run, event, {
    postId: post.id, slotId: post.slotId, previous: post.decision, edited: updated.edited,
    ...(overrides.length ? { overrode: overrides } : {}),
  });

  const all = await db.listPosts(post.run);
  const status = all.every((p) => p.decision !== "PENDING") ? "completed" : "awaiting_approval";
  if (run.status !== status) await db.updateRun(run.id, { status });

  res.json(updated);
}));

// Live rule check for the approval screen while the owner edits a caption.
posts.post("/check", asyncRoute(async (req, res) => {
  const { runId, caption } = req.body || {};
  const run = await db.getRun(runId);
  if (!run) return res.status(404).json({ error: "Plan not found." });
  res.json({ issues: runGovernanceChecks({ caption: String(caption || "") }, run.brief) });
}));
