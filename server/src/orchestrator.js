// The Orchestrator (main agent). Decides which subagent works next,
// loops failed drafts back to the Writer, and stops after MAX_REVISIONS.
import { planContent } from "./agents/planner.js";
import { writePost } from "./agents/writer.js";
import { reviewPost } from "./agents/reviewer.js";
import { runGovernanceChecks, prescreenBrief } from "./governance/rules.js";
import { log } from "./utils/logger.js";
import { db } from "./db/index.js";
import { config } from "./config.js";

const fmtIssues = (list) => list.map((i) => `${i.source}: ${i.message}`);

export async function runPipeline(runId, brief) {
  const progress = [];
  const setStage = (stage) => db.updateRun(runId, { stage, progress });

  try {
    await log(runId, "START", { business: brief.name, posts: brief.count, llm: config.llmMode });

    // 0. PRE-SCREEN — hard rule, no AI involved
    const flags = prescreenBrief(brief);
    if (flags.length) {
      await db.updateRun(runId, { flags });
      await log(runId, "BRIEF_FLAGGED", { flags });
    }

    // 1. PLAN
    await setStage({ agent: "planner" });
    const plan = await planContent(brief);
    plan.posts.forEach((s) => progress.push({ slotId: s.id, day: s.day, time: s.time, type: s.type, theme: s.theme, state: "waiting", attempts: [] }));
    await log(runId, "PLAN_CREATED", { count: plan.posts.length, slots: plan.posts.map((p) => `${p.day} ${p.time} · ${p.type}`) });

    const results = [];
    for (const slot of plan.posts) {
      const row = progress.find((p) => p.slotId === slot.id);
      let feedback = null, draft, issues = [];
      const trail = [];

      for (let attempt = 0; attempt <= config.maxRevisions; attempt++) {
        const where = { slotId: slot.id, attempt, total: plan.posts.length };

        // 2. EXECUTE
        row.state = attempt ? "revising" : "writing";
        await setStage({ agent: "writer", ...where });
        draft = await writePost(slot, brief, feedback, { attempt });
        await log(runId, "DRAFT_WRITTEN", { slotId: slot.id, attempt, caption: draft.caption });

        // 3. GOVERN — hard rules, no AI involved
        row.state = "checking";
        await setStage({ agent: "governance", ...where });
        const ruleIssues = runGovernanceChecks(draft, brief);
        await log(runId, "RULES_CHECKED", { slotId: slot.id, attempt, issues: fmtIssues(ruleIssues) });

        // 4. CHECK — AI reviewer
        row.state = "reviewing";
        await setStage({ agent: "reviewer", ...where });
        const review = await reviewPost(draft, brief);
        issues = [...ruleIssues, ...review.issues];
        await log(runId, "REVIEW", { slotId: slot.id, attempt, status: issues.length ? "FAIL" : "PASS", issues: fmtIssues(issues), suggestions: review.suggestions });

        trail.push({ attempt, caption: draft.caption, issues });
        row.attempts.push({ attempt, passed: !issues.length, issues: fmtIssues(issues) });
        if (!issues.length) break;       // passed → stop looping
        feedback = issues.map((i) => i.message); // failed → route back to Writer
      }

      row.state = issues.length ? "flagged" : "passed";
      if (issues.length) await log(runId, "ESCALATED", { slotId: slot.id, attempts: trail.length, issues: fmtIssues(issues) });

      results.push({
        slotId: slot.id, day: slot.day, time: slot.time, type: slot.type, theme: slot.theme,
        caption: draft.caption, hashtags: draft.hashtags, imageIdea: draft.image_idea,
        issues, trail,
        status: issues.length ? "NEEDS_HUMAN_ATTENTION" : "READY_FOR_APPROVAL",
        decision: "PENDING", // 5. only a human can change this
      });
    }

    await db.insertPosts(runId, results);
    await db.updateRun(runId, { status: "awaiting_approval", stage: { agent: "human" }, progress });
    await log(runId, "SENT_TO_HUMAN", { count: results.length, flagged: results.filter((r) => r.issues.length).length });
  } catch (err) {
    console.error(err);
    await db.updateRun(runId, { status: "failed", error: "Generation failed. Please try again.", stage: { agent: "error" }, progress });
    await log(runId, "ERROR", { message: err.message });
  }
}
