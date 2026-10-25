// Empty in dev (Vite proxies /api) and when Express serves the build; set to the Render URL for GitHub Pages.
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

async function request(method, url, body) {
  const res = await fetch(API_BASE + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request("GET", "/api/health"),
  listPlans: () => request("GET", "/api/runs"),
  createPlan: (brief) => request("POST", "/api/runs", brief),
  getPlan: (id) => request("GET", `/api/runs/${id}`),
  events: (id) => request("GET", `/api/runs/${id}/events`),
  final: (id) => request("GET", `/api/runs/${id}/final`),
  decide: (postId, body) => request("PATCH", `/api/posts/${postId}/decision`, body),
  check: (runId, caption) => request("POST", "/api/posts/check", { runId, caption }),
};

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}
