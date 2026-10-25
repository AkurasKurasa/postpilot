// Agent 2 — Content Writer
import { callLLM, loadSkill, isMock, sleep } from "../utils/llm.js";
import { config } from "../config.js";
import { mockWrite } from "./mock.js";
import { publicBrief } from "./planner.js";

const validate = (o) =>
  typeof o.caption === "string" && o.caption.trim() ? null : "expected { caption, hashtags, image_idea }";

export async function writePost(slot, brief, feedback = null, ctx = {}) {
  if (isMock()) {
    await sleep(config.mockDelay * 1.2);
    return mockWrite(slot, brief, feedback, ctx);
  }
  const system = "You are the Content Writer agent.\n\n" + loadSkill("caption-writing");
  let user = `Business:\n${JSON.stringify(publicBrief(brief))}\n\nPost slot:\n${JSON.stringify(slot)}`;
  if (feedback?.length) user += `\n\nFix these reviewer issues:\n- ${feedback.join("\n- ")}`;
  const out = await callLLM(system, user, validate);
  return {
    caption: out.caption.trim(),
    hashtags: (Array.isArray(out.hashtags) ? out.hashtags : String(out.hashtags || "").split(/\s+/))
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : "#" + t))
      .slice(0, 6),
    image_idea: String(out.image_idea || ""),
  };
}
