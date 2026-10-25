// Mock agents: scripted, deterministic replies built from the brief.
// Used when no ANTHROPIC_API_KEY is set, for offline demos and for tests.
// They deliberately make the same mistakes a real model might when the brief invites them
// (a wrong price, a banned claim, a phone number, political text) so governance has something to catch.
import {
  BANNED, bannedRe, pesoAmounts, allowedPrices, fmt, findBanned,
  POLITICAL, INJECTION, PHONE_LOOSE, EMAIL,
} from "../governance/rules.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ORDER = ["promo", "product", "engagement", "behind", "promo", "product", "engagement"];
const TIMES = ["11:30", "18:00", "19:30", "15:00", "12:00", "17:30", "20:00"];

const camel = (s) => s.replace(/['’]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const tagOf = (s) => "#" + camel(s);
const typeNoun = (b) => (b.type || "shop").replace(/\s*(shop|store|cafe|café|bar|stall)$/i, "").trim().toLowerCase() || "shop";

export function pickMain(b) {
  const g = (b.goal || "").toLowerCase();
  return b.prices.find((p) => g.includes(p.item.toLowerCase())) || b.prices[0];
}

export function mockPlan(b) {
  const n = b.count;
  const main = pickMain(b);
  const others = b.prices.filter((p) => p !== main);
  const posts = [];
  for (let i = 0; i < n; i++) {
    const d = n === 1 ? 0 : Math.round((i * 6) / (n - 1));
    const type = ORDER[i];
    const o = others[i === 1 ? 0 : 1] || others[0] || main;
    const theme = {
      promo: i === 0 ? `Launch: ${main.item}` : `Last call: ${main.item} promo`,
      product: `${o.item} spotlight`,
      engagement: `${main.item} vs ${(others[0] || main).item} poll`,
      behind: `How we make ${main.item}`,
    }[type];
    posts.push({ id: i + 1, day: DAYS[d], time: TIMES[i], type, theme, goal: b.goal });
  }
  return { posts };
}

function detectFaults(b) {
  const g = b.goal || "";
  const ok = allowedPrices(b);
  const f = {};
  const bad = pesoAmounts(g).find((a) => !ok.has(a));
  if (bad != null) f.price = bad;
  const claim = BANNED.find((w) => bannedRe(w).test(g));
  if (claim) f.claim = claim;
  const contact = g.match(PHONE_LOOSE) || g.match(EMAIL);
  if (contact) f.contact = contact[0];
  if (POLITICAL.test(g) || INJECTION.test(g)) f.political = true;
  return f;
}

function claimLine(w, b) {
  const noun = typeNoun(b);
  if (/best/.test(w)) return `The best ${noun} in the Philippines!`;
  if (/no\.|number/.test(w)) return `No. 1 ${noun} in town!`;
  if (/guarantee/.test(w)) return "Sarap guaranteed!";
  if (w === "cures") return "Cures any bad day!";
  if (w === "100% natural") return "100% natural, always!";
  return "The healthiest drink you'll ever try!";
}

export function mockWrite(slot, b, feedback, { attempt = 0 } = {}) {
  const main = pickMain(b);
  const others = b.prices.filter((p) => p !== main);
  const o1 = others[0] || main;
  const o2 = others[1] || o1;
  const tl = /taglish|filipino|tagalog/i.test(b.voice || "");
  const promoAmt = pesoAmounts(b.promo)[0];
  // On attempt 0 the writer follows the brief too literally. With feedback it fixes the issues,
  // unless the "stubborn writer" test switch is on.
  const faulty = slot.type === "promo" && (attempt === 0 || b.simulateStubbornWriter);
  const f = faulty ? detectFaults(b) : {};
  const price = (p) => fmt(Number(p.price));
  let caption, idea, extra;

  if (slot.type === "promo" && slot.id === 1) {
    let line = promoAmt != null
      ? `Launch week treat: ${fmt(promoAmt)} off our ${price(main)} ${main.item}.`
      : b.promo ? `${b.promo.trim().replace(/\.$/, "")}.` : `Get yours for ${price(main)}.`;
    if (f.price != null) line = `Now only ${fmt(f.price)} this week!`;
    const hook = tl
      ? `Bagong flavor alert! Our ${main.item} is finally here, and sobrang sarap niya.`
      : `New flavor alert! ${main.item} is finally here, and it's worth the hype.`;
    let cta = tl ? "Tara, order na!" : "Order now!";
    if (f.contact) cta = `Shoutout to our suki at ${f.contact} for the first order!`;
    caption = [hook, f.claim && claimLine(f.claim, b), line, cta].filter(Boolean).join(" ");
    idea = `Top-down shot of ${main.item} on a pastel backdrop with a "${promoAmt != null ? fmt(promoAmt) + " OFF" : "NEW"}" sticker.`;
    extra = "#NewFlavor";
  } else if (slot.type === "promo") {
    let line = promoAmt != null ? `${fmt(promoAmt)} off ${main.item} ends soon.` : `${main.item}, ${price(main)}, all week.`;
    if (f.price != null) line = `${main.item} for only ${fmt(f.price)} until Sunday.`;
    caption = [
      tl ? "Last few days na lang!" : "Last few days!",
      f.claim && claimLine(f.claim, b),
      line,
      f.contact ? `Text ${f.contact} to reserve.` : tl ? "Dala mo na barkada mo, see you sa store!" : "Bring your friends and see you at the store.",
    ].filter(Boolean).join(" ");
    idea = `Hand holding ${main.item} in front of the shop sign, "Last call" text overlay.`;
    extra = "#LastCall";
  } else if (slot.type === "product") {
    const o = slot.id === 2 ? o1 : o2;
    caption = `Fan favorite spotlight: ${o.item}. Simple, solid, never fails. ${tl ? price(o) + " lang!" : "Just " + price(o) + "."} Visit us today.`;
    idea = `Close-up of ${o.item} with condensation on the cup, counter blurred behind.`;
    extra = "#FanFavorite";
  } else if (slot.type === "engagement") {
    caption = `Quick question, ${b.name} fam: ${main.item} or ${o1.item}? ${tl ? "Comment your pick below, game!" : "Comment your pick below!"}`;
    idea = `Split photo: ${main.item} on the left, ${o1.item} on the right, "Which one?" in the middle.`;
    extra = "#ThisOrThat";
  } else {
    caption = `Behind the counter: every ${main.item} we serve is prepped fresh each morning by our team.${tl ? " Ganyan namin kayo ka-love." : ""} See you later!`;
    idea = `Staff hands preparing ${main.item} at the counter in warm morning light.`;
    extra = "#BehindTheScenes";
  }
  if (f.political) caption += ` Election season? Support our candidate and grab a ${main.item} on your way to vote!`;

  return {
    caption,
    hashtags: [tagOf(b.name), tagOf(main.item), tagOf(b.type), extra, "#SupportLocal"],
    image_idea: idea,
  };
}

export function mockReview(draft, b) {
  const c = draft.caption || "";
  const issues = [];
  const ok = allowedPrices(b);
  if (POLITICAL.test(c)) issues.push("Political content is off-limits for brand posts");
  if (INJECTION.test(c)) issues.push("Caption repeats an instruction from the brief");
  const bad = pesoAmounts(c).filter((a) => !ok.has(a));
  if (bad.length) issues.push(`${fmt(bad[0])} doesn't match the official list (${b.prices.map((p) => `${p.item} ${fmt(Number(p.price))}`).join(", ")})`);
  if (findBanned(c).length) issues.push("Exaggerated claim; rewrite without superlatives or guarantees");
  const suggestions =
    /taglish/i.test(b.voice || "") && !/\b(na|lang|tara|sarap|namin|kayo|mo|po|sa|game)\b/i.test(c)
      ? "Voice asks for Taglish; add a Filipino phrase."
      : "";
  return { status: issues.length ? "FAIL" : "PASS", issues, suggestions };
}
