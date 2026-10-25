// One shared helper for every model call. Switching to Gemini or OpenAI only changes this file.
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config, SERVER_ROOT } from "../config.js";

let client;

export function loadSkill(name) {
  return fs.readFileSync(path.join(SERVER_ROOT, "skills", name, "SKILL.md"), "utf8");
}

export const isMock = () => config.llmMode === "mock";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls the model and returns parsed JSON.
 * `validate(obj)` returns an error string or null. A bad reply is retried once.
 */
export async function callLLM(system, user, validate = () => null) {
  client ||= new Anthropic({ apiKey: config.apiKey });
  let lastError = "unknown";

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model: config.model,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content:
            attempt === 0
              ? user
              : `${user}\n\nYour previous reply was not valid JSON in the required shape (${lastError}). Reply with JSON only.`,
        },
      ],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      const obj = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      const err = validate(obj);
      if (!err) return obj;
      lastError = err;
    } catch (e) {
      lastError = e.message;
    }
  }
  throw new Error(`Model returned invalid JSON twice: ${lastError}`);
}
