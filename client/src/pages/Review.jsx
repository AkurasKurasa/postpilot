import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api.js";
import { Empty, PostStatus } from "../components/ui.jsx";

export default function Review() {
  const { run, posts, metrics, reload } = useOutletContext();
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

  if (run.status === "running") return <Empty title="The agents are still working">Drafts appear here when they are done.</Empty>;
  if (!posts.length) return <Empty title="No drafts">This plan has no posts to review.</Empty>;

  const passed = posts.filter((p) => p.decision === "PENDING" && p.status === "READY_FOR_APPROVAL");
  async function approvePassed() {
    setBulkBusy(true);
    for (const p of passed) await api.decide(p.id, { decision: "APPROVED" }).catch(() => {});
    await reload();
    setBulkBusy(false);
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="segmented" role="tablist">
          {[["pending", "Pending"], ["attention", "Needs attention"], ["all", "All"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{l} <span className="count">{counts[k]}</span></button>
          ))}
        </div>
        {passed.length > 0 && (
          <button className="btn ghost sm" disabled={bulkBusy} onClick={approvePassed}>
            Approve {passed.length} that passed review
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <Empty title="Nothing pending" action={<Link className="btn primary" to="../calendar">Open calendar</Link>}>
          {metrics.approved} approved, {metrics.rejected} rejected.
        </Empty>
      ) : (
        <div className="cards">{shown.map((p) => <PostCard key={p.id} post={p} runId={run.id} reload={reload} />)}</div>
      )}
    </div>
  );
}

function PostCard({ post, runId, reload }) {
  const [caption, setCaption] = useState(post.caption);
  const [liveIssues, setLiveIssues] = useState([]);
  const [blocked, setBlocked] = useState(null); // issues returned by a 409
  const [busy, setBusy] = useState(false);
  const decided = post.decision !== "PENDING";
  const edited = caption.trim() !== post.caption;
  const timer = useRef();

  useEffect(() => setCaption(post.caption), [post.caption]);

  // Edits are re-checked by the server's governance rules as you type
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
        <div>
          <h3>{post.day} · {post.time}</h3>
          <p className="sub"><span className="tag">{post.type}</span>{post.theme}</p>
        </div>
        <PostStatus post={post} />
      </header>

      {residual.length > 0 && (
        <ul className="issues">
          {residual.map((i, k) => <li key={k}><span className="src">{i.source}</span>{i.message}</li>)}
        </ul>
      )}

      <textarea
        aria-label={`Caption for ${post.day} ${post.time}`}
        value={caption}
        onChange={(e) => { setCaption(e.target.value); setBlocked(null); }}
        disabled={decided || busy}
        rows={4}
      />
      {edited && !decided && (
        <p className={`live ${liveIssues.length ? "bad" : "ok"}`}>
          {liveIssues.length ? `Your edit breaks: ${liveIssues.map((i) => `${i.source} (${i.message})`).join(", ")}` : "Your edit passes the rules."}
        </p>
      )}

      <p className="tags">{post.hashtags.join(" ")}</p>
      <p className="idea"><strong>Image idea:</strong> {post.imageIdea}</p>

      {post.trail.length > 1 && (
        <details className="trail">
          <summary>{post.trail.length} attempts</summary>
          <ol start={0}>
            {post.trail.map((t) => (
              <li key={t.attempt}>
                <span className={t.issues.length ? "fail" : "pass"}>{t.issues.length ? `Failed: ${t.issues.map((i) => i.message).join("; ")}` : "Passed"}</span>
                <span className="trail-cap">{t.caption}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {blocked && (
        <div className="alert warn">
          Still breaks: {blocked.map((i) => `${i.source}: ${i.message}`).join(" · ")}.
          <button className="btn warn sm" disabled={busy} onClick={() => decide("APPROVED", true)}>Approve anyway</button>
        </div>
      )}

      <footer className="card-foot">
        {decided ? (
          <>
            <span className="sub">{post.overrides?.length ? "Approved with an override (logged)" : post.decision === "APPROVED" ? "Will appear in the calendar" : "Excluded from the calendar"}</span>
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
