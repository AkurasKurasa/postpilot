// Agent 1 — Content Planner
import { callLLM, loadSkill, isMock, sleep } from "../utils/llm.js";
import { config } from "../config.js";
import { mockPlan } from "./mock.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const validate = (o) =>
  Array.isArray(o.posts) && o.posts.length && o.posts.every((p) => p && p.day && p.time && p.type)
    ? null
    : "expected { posts: [{ day, time, theme, type }] }";

export async function planContent(brief) {
  if (isMock()) {
    await sleep(config.mockDelay * 1.5);
    return mockPlan(brief);
  }
  const system = "You are the Content Planner agent.\n\n" + loadSkill("content-calendar-planning");
  const user = `Create a content calendar with exactly ${brief.count} posts for this business:\n${JSON.stringify(publicBrief(brief), null, 2)}`;
  const plan = await callLLM(system, user, validate);
  return {
    posts: plan.posts.slice(0, brief.count).map((p, i) => ({
      id: i + 1,
      day: DAYS.includes(p.day) ? p.day : DAYS[i % 7],
      time: String(p.time),
      type: String(p.type),
      theme: String(p.theme || ""),
      goal: brief.goal,
    })),
  };
}

// Only what the agents need; never internal flags.
export const publicBrief = ({ name, type, voice, goal, promo, prices }) => ({ name, type, voice, goal, promo, prices });
