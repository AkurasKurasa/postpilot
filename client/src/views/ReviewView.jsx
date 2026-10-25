import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { PostStatus } from "../components/ui.jsx";

export default function ReviewView({ data, reload, onCalendar }) {
  const { run, posts, metrics } = data;
  const [filter, setFilter] = useState("pending");
  const [bulkBusy, setBulkBusy] = useState(false);

  const counts = {
    pending: posts.filter((p) => p.decision === "PENDING").length,
    attention: posts.filter((p) => p.decision === "PENDING" && p.status === "NEEDS_HUMAN_ATTENTION").length,
    all: posts.length,
  };
  const shown = useMemo(() => {
    const list = filter === "all" ? posts : posts.filter((p) => p.decision === "PENDING" && (filter === "pending" || p.status === "NEEDS_HUMAN_ATTENTION"));
    return [...list].sort((a, b) => (b.status === "NEEDS_HUMAN_ATTENTION") - (a.status === "NEEDS_HUMAN_ATTENTION") || a.slotId - b.slotId);
  }, [posts, filter]);
  const passed = posts.filter((p) => p.decision === "PENDING" && p.status === "READY_FOR_APPROVAL");

  async function approvePassed() {
    setBulkBusy(true);
    for (const p of passed) await api.decide(p.id, { decision: "APPROVED" }).catch(() => {});
    await reload();
    setBulkBusy(false);
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <p className="eyebrow">{run.brief.name}</p>
          <h1>{counts.pending ? "Review the drafts" : "All drafts decided"}</h1>
          <p className="sub">{metrics.approved} approved · {metrics.rejected} rejected · {counts.pending} pending</p>
        </div>
        {counts.pending === 0 ? (
          <button className="btn primary" onClick={onCalendar}>Open calendar →</button>
        ) : passed.length > 0 && (
          <button className="btn ghost" disabled={bulkBusy} onClick={approvePassed}>Approve {passed.length} that passed</button>
        )}
      </div>

      <div className="segmented" role="tablist">
        {[["pending", "Pending"], ["attention", "Needs attention"], ["all", "All"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{l}<span className="seg-n">{counts[k]}</span></button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <strong>Nothing here</strong>
          <p>{counts.pending ? "No posts need extra attention." : "Every draft has a decision."}</p>
          {!counts.pending && <button className="btn primary" onClick={onCalendar}>Open calendar</button>}
        </div>
      ) : (
        <div className="cards">{shown.map((p) => <PostCard key={p.id} post={p} runId={run.id} reload={reload} />)}</div>
      )}
    </div>
  );
}

function PostCard({ post, runId, reload }) {
  const [caption, setCaption] = useState(post.caption);
  const [liveIssues, setLiveIssues] = useState([]);
  const [blocked, setBlocked] = useState(null);
  const [busy, setBusy] = useState(false);
  const decided = post.decision !== "PENDING";
  const edited = caption.trim() !== post.caption;
  const timer = useRef();

  useEffect(() => setCaption(post.caption), [post.caption]);
  // Edits are re-checked by the server's rules while you type
  useEffect(() => {
    if (!edited) { setLiveIssues([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api.check(runId, caption).then((r) => setLiveIssues(r.issues)).catch(() => {}), 300);
    return () => clearTimeout(timer.current);
  }, [caption, edited, runId]);

  async function decide(decision, acknowledgeIssues = false) {
    setBusy(true);
    try {
      await api.decide(post.id, { decision, caption: edited ? caption : undefined, acknowledgeIssues });
      setBlocked(null);
      await reload();
    } catch (e) {
      if (e.status === 409) setBlocked(e.data.issues);
    } finally {
      setBusy(false);
    }
  }

  const residual = !decided && !edited ? post.issues : [];
  return (
    <article className={`card ${post.status === "NEEDS_HUMAN_ATTENTION" && !decided ? "flagged" : ""} ${post.decision.toLowerCase()}`}>
      <header className="card-head">
        <div className="card-when"><strong>{post.day}</strong><span className="mono">{post.time}</span><span className="card-type">{post.type}</span></div>
        <PostStatus post={post} />
      </header>

      {residual.length > 0 && (
        <ul className="issues">{residual.map((i, k) => <li key={k}><span className="src">{i.source}</span>{i.message}</li>)}</ul>
      )}

      <textarea aria-label={`Caption for ${post.day} ${post.time}`} value={caption} rows={4} disabled={decided || busy}
        onChange={(e) => { setCaption(e.target.value); setBlocked(null); }} />
      {edited && !decided && (
        <p className={`live ${liveIssues.length ? "bad" : "ok"}`}>
          {liveIssues.length ? `Breaks ${liveIssues.map((i) => `${i.source}: ${i.message}`).join(", ")}` : "✓ Your edit passes the rules"}
        </p>
      )}
      <p className="tags">{post.hashtags.join(" ")}</p>
      <p className="idea">{post.imageIdea}</p>

      {post.trail.length > 1 && (
        <details className="trail">
          <summary>Revision history · {post.trail.length} attempts</summary>
          <ol start={0}>
            {post.trail.map((t) => (
              <li key={t.attempt}>
                <span className={t.issues.length ? "fail" : "pass"}>{t.issues.length ? t.issues.map((i) => i.message).join("; ") : "Passed"}</span>
                <span className="trail-cap">{t.caption}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {blocked && (
        <div className="alert warn">
          <span>Still breaks: {blocked.map((i) => i.message).join(" · ")}</span>
          <button className="btn warn sm" disabled={busy} onClick={() => decide("APPROVED", true)}>Approve anyway</button>
        </div>
      )}

      <footer className="card-foot">
        {decided ? (
          <>
            <span className="sub">{post.overrides?.length ? "Approved with a logged override" : post.decision === "APPROVED" ? "In the calendar" : "Left out of the calendar"}</span>
            <button className="btn ghost sm" disabled={busy} onClick={() => decide("PENDING")}>Undo</button>
          </>
        ) : (
          <>
            <button className="btn ghost sm" disabled={busy} onClick={() => decide("REJECTED")}>Reject</button>
            <button className="btn primary sm" disabled={busy} onClick={() => decide("APPROVED")}>{edited ? "Save & approve" : "Approve"}</button>
          </>
        )}
      </footer>
    </article>
  );
}
