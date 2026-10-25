import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { copyText } from "../api.js";
import { Empty } from "../components/ui.jsx";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default function Calendar() {
  const { run, posts, metrics } = useOutletContext();
  const approved = posts.filter((p) => p.decision === "APPROVED"); // same filter as GET /api/final
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState("");
  const selected = approved.find((p) => p.id === selectedId) || approved[0];

  if (run.status === "running") return <Empty title="The agents are still working" />;

  async function copy(kind, text) {
    const ok = await copyText(text);
    setCopied(ok ? kind : "failed");
    setTimeout(() => setCopied(""), 1500);
  }
  const csv = () => {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    return ["day,time,type,caption,hashtags,image_idea", ...approved.map((p) => [p.day, p.time, p.type, q(p.caption), q(p.hashtags.join(" ")), q(p.imageIdea)].join(","))].join("\n");
  };
  const violations = Object.values(metrics.violations).reduce((a, b) => a + b, 0);

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Approved" value={`${metrics.approved}/${metrics.total}`} note={`${metrics.edited} edited · ${metrics.rejected} rejected`} />
        <Stat label="First-pass rate" value={pct(metrics.firstPass, metrics.total)} note="Passed on the first draft" />
        <Stat label="Violations caught" value={violations} note={Object.entries(metrics.violations).map(([k, v]) => `${v} ${k}`).join(" · ") || "None"} />
        <Stat label="Escalated" value={pct(metrics.escalated, metrics.total)} note="Flagged after 2 revisions" />
      </div>

      {approved.length === 0 ? (
        <Empty title="No approved posts yet" action={<Link className="btn primary" to="../review">Review drafts</Link>}>
          Only posts you approve appear here.
        </Empty>
      ) : (
        <>
          <div className="week">
            {DAYS.map((d) => {
              const items = approved.filter((p) => p.day === d);
              return (
                <div key={d} className={`day ${items.length ? "" : "empty-day"}`}>
                  <div className="day-name">{d}</div>
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
            <section className="panel detail">
              <div className="panel-head">
                <h2>{selected.day} · {selected.time} <span className="tag">{selected.type}</span></h2>
                <div className="row-gap">
                  <button className="btn primary sm" onClick={() => copy("post", `${selected.caption}\n\n${selected.hashtags.join(" ")}`)}>
                    {copied === "post" ? "Copied" : "Copy caption"}
                  </button>
                </div>
              </div>
              <div className="detail-body">
                <p className="detail-cap">{selected.caption}</p>
                <p className="tags">{selected.hashtags.join(" ")}</p>
                <p className="idea"><strong>Image idea:</strong> {selected.imageIdea}</p>
              </div>
            </section>
          )}

          <div className="row-gap">
            <button className="btn ghost sm" onClick={() => copy("csv", csv())}>{copied === "csv" ? "Copied" : "Copy calendar as CSV"}</button>
            {copied === "failed" && <span className="sub">Copy was blocked by the browser.</span>}
          </div>
        </>
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
