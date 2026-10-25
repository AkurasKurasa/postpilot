import { useState } from "react";
import { copyText } from "../api.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LABELS = { price: "wrong price", claim: "banned claim", "personal-data": "personal data", length: "too long", "off-brand": "off-brand", review: "reviewer" };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default function CalendarView({ data, onReview }) {
  const { run, posts, metrics } = data;
  const approved = posts.filter((p) => p.decision === "APPROVED"); // same filter as GET /api/runs/:id/final
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState("");
  const selected = approved.find((p) => p.id === selectedId) || approved[0];
  const violations = Object.values(metrics.violations).reduce((a, b) => a + b, 0);

  async function copy(kind, text) {
    setCopied((await copyText(text)) ? kind : "failed");
    setTimeout(() => setCopied(""), 1500);
  }
  const csv = () => {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    return ["day,time,type,caption,hashtags,image_idea", ...approved.map((p) => [p.day, p.time, p.type, q(p.caption), q(p.hashtags.join(" ")), q(p.imageIdea)].join(","))].join("\n");
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <p className="eyebrow">{run.brief.name}</p>
          <h1>This week's calendar</h1>
          <p className="sub">Only posts you approved. Copy them into Facebook or Instagram.</p>
        </div>
        {approved.length > 0 && <button className="btn ghost" onClick={() => copy("csv", csv())}>{copied === "csv" ? "Copied" : "Copy as CSV"}</button>}
      </div>

      <div className="stats">
        <Stat label="Approved" value={`${metrics.approved}/${metrics.total}`} note={`${metrics.edited} edited · ${metrics.rejected} rejected`} />
        <Stat label="First-pass rate" value={pct(metrics.firstPass, metrics.total)} note="Passed on the first draft" />
        <Stat label="Violations caught" value={violations} note={Object.entries(metrics.violations).map(([k, v]) => `${v} ${LABELS[k] || k}`).join(" · ") || "None"} />
        <Stat label="Escalated" value={pct(metrics.escalated, metrics.total)} note="Flagged after 2 revisions" />
      </div>

      {approved.length === 0 ? (
        <div className="empty">
          <strong>No approved posts yet</strong>
          <p>The calendar only shows posts you approve.</p>
          <button className="btn primary" onClick={onReview}>Review drafts</button>
        </div>
      ) : (
        <div className="cal-layout">
          <div className="week">
            {DAYS.map((d) => {
              const items = approved.filter((p) => p.day === d);
              return (
                <div key={d} className={`day ${items.length ? "" : "free"}`}>
                  <span className="day-name">{d}</span>
                  {items.map((p) => (
                    <button key={p.id} className={`cal-post ${selected?.id === p.id ? "on" : ""}`} onClick={() => setSelectedId(p.id)}>
                      <span className="mono">{p.time}</span>
                      <span className="cal-cap">{p.caption}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {selected && (
            <article className="preview">
              <header className="pv-head">
                <span className="avatar">{run.brief.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                <span><strong>{run.brief.name}</strong><span className="sub">{selected.day} · {selected.time}</span></span>
              </header>
              <p className="pv-cap">{selected.caption}</p>
              <p className="tags">{selected.hashtags.join(" ")}</p>
              <div className="pv-img"><span>{selected.imageIdea}</span></div>
              <button className="btn primary block" onClick={() => copy("post", `${selected.caption}\n\n${selected.hashtags.join(" ")}`)}>
                {copied === "post" ? "Copied" : "Copy caption"}
              </button>
              {copied === "failed" && <p className="sub">Your browser blocked copying.</p>}
            </article>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}
