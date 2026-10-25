// Hard-coded governance rules. These run in plain code, outside the model,
// so an AI agent can never talk its way past them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const BANNED = fs
  .readFileSync(path.join(here, "banned-words.txt"), "utf8")
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Word-boundary match so "cures" does not fire on "secures".
export const bannedRe = (w) => new RegExp("(^|[^a-z0-9])" + escapeRe(w) + "(?![a-z0-9])", "i");

export const POLITICAL = /\b(vote|votes|voting|election|elections|senator|mayor|congressman|candidate|politic\w*|party[- ]list)\b/i;
export const INJECTION = /ignore\s+(?:all\s+|your\s+|the\s+|previous\s+|any\s+)*(?:rules|instructions|guidelines)/i;
export const PHONE_LOOSE = /(?:\+63\s?9|09)\d{2}[\s-]?\d{3}[\s-]?\d{4}/;
export const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;

export const fmt = (n) => "₱" + (Number.isInteger(n) ? n.toLocaleString("en-PH") : n.toFixed(2));

// Reads every peso amount: ₱99, ₱ 99, ₱1,299, ₱99.50, PHP 99
export function pesoAmounts(text) {
  const re = /(?:₱|\bPHP\s?)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/gi;
  const out = [];
  let m;
  while ((m = re.exec(text || ""))) out.push(Number(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : "")));
  return out;
}

// Prices on the owner's list, plus any amounts the owner wrote in the promo ("₱20 off").
export function allowedPrices(brief) {
  return new Set([...(brief.prices || []).map((p) => Number(p.price)), ...pesoAmounts(brief.promo)]);
}

export function hasPersonalData(text) {
  const squashed = (text || "").replace(/[\s\-().]/g, ""); // catches "0917 123 4567"
  return /(?:\+639|09)\d{9}/.test(squashed) || EMAIL.test(text || "");
}

export function findBanned(text) {
  const hits = BANNED.filter((w) => bannedRe(w).test(text || ""));
  // "the best" and "best in" overlapping in one phrase report once
  return hits.filter((w) => !hits.some((o) => o !== w && o.includes(w)));
}

/** Rules 1–4. Returns [] when the caption passes. */
export function runGovernanceChecks(draft, brief) {
  const caption = draft.caption || "";
  const issues = [];
  const ok = allowedPrices(brief);

  // Rule 1 — every price must exist in the owner's price list or promo
  for (const amount of new Set(pesoAmounts(caption))) {
    if (!ok.has(amount)) issues.push(issue(1, "price", `${fmt(amount)} is not in the price list`));
  }
  // Rule 2 — no banned or exaggerated claims
  for (const w of findBanned(caption)) issues.push(issue(2, "claim", `Banned claim: "${w}"`));
  // Rule 3 — no personal data
  if (hasPersonalData(caption)) issues.push(issue(3, "personal-data", "Possible personal data (phone number or email)"));
  // Rule 4 — length
  const words = caption.trim().split(/\s+/).filter(Boolean).length;
  if (words > 150) issues.push(issue(4, "length", `Caption is ${words} words (limit 150)`));

  return issues;
}

/** Rule 0 — screens the brief before any AI call. Flags are logged, not blocking. */
export function prescreenBrief(brief) {
  const text = [brief.goal, brief.promo].join(" ");
  const flags = [];
  if (INJECTION.test(text)) flags.push("Instruction-override attempt in brief");
  if (POLITICAL.test(text)) flags.push("Political topic in brief");
  if (PHONE_LOOSE.test(text) || EMAIL.test(text)) flags.push("Personal data in brief");
  return flags;
}

function issue(rule, category, message) {
  return { source: `Rule ${rule}`, rule, category, message };
}
