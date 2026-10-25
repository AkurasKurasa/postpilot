// Agent 3 — Brand & Compliance Reviewer
import { callLLM, loadSkill, isMock, sleep } from "../utils/llm.js";
import { config } from "../config.js";
import { mockReview } from "./mock.js";

const validate = (o) =>
  ["PASS", "FAIL"].includes(o.status) && (o.issues == null || Array.isArray(o.issues))
    ? null
    : 'expected { status: "PASS" | "FAIL", issues: [] }';

/** Returns { status, issues: [{ source, category, message }], suggestions } */
export async function reviewPost(draft, brief) {
  let raw;
  if (isMock()) {
    await sleep(config.mockDelay);
    raw = mockReview(draft, brief);
  } else {
    const system = "You are the Brand & Compliance Reviewer agent.\n\n" + loadSkill("post-review-checklist");
    const user =
      `Official prices and promo:\n${JSON.stringify({ prices: brief.prices, promo: brief.promo, voice: brief.voice })}` +
      `\n\nDraft to review:\n${JSON.stringify(draft)}`;
    raw = await callLLM(system, user, validate);
  }
  const issues = (raw.issues || []).map((m) => ({ source: "Reviewer", category: categorize(String(m)), message: String(m) }));
  if (raw.status === "FAIL" && !issues.length) issues.push({ source: "Reviewer", category: "review", message: "Reviewer marked this draft FAIL" });
  return {
    status: issues.length ? "FAIL" : "PASS",
    issues,
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.join(" ") : String(raw.suggestions || ""),
  };
}

function categorize(m) {
  if (/price|₱|php/i.test(m)) return "price";
  if (/claim|superlative|guarantee|best/i.test(m)) return "claim";
  if (/personal|phone|email/i.test(m)) return "personal-data";
  if (/politic|offensive|instruction/i.test(m)) return "off-brand";
  return "review";
}
