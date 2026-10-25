// Only listed browser origins may call the API cross-origin (e.g. the GitHub Pages site).
// CORS is a browser guard, not auth: scripts and curl ignore it, so keep the API key off until rate limiting exists.

export function parseOrigins(value) {
  return (value || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function isAllowedOrigin(origin, allowlist) {
  // No Origin header = same-origin request or a non-browser client (health checks, curl)
  if (!origin) return true;
  return allowlist.includes(origin.replace(/\/+$/, ""));
}

export function corsOptions(allowlist) {
  return {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin, allowlist)),
  };
}
