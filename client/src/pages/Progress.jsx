import { Link, useOutletContext } from "react-router-dom";

const STEPS = [
  { key: "planner", name: "Planner", role: "Plans the week" },
  { key: "writer", name: "Writer", role: "Drafts captions" },
  { key: "governance", name: "Rules", role: "Hard-coded checks" },
  { key: "reviewer", name: "Reviewer", role: "Brand & compliance" },
  { key: "human", name: "You", role: "Approve or reject" },
];

const STATE_LABEL = {
  waiting: "Waiting", writing: "Writing", revising: "Revising with feedback", checking: "Checking rules",
  reviewing: "In review", passed: "Passed", flagged: "Flagged for you",
};

export default function Progress() {
  const { run, metrics } = useOutletContext();
  const agent = run.stage?.agent;
  const activeIdx = STEPS.findIndex((s) => s.key === agent);
  const done = run.status !== "running";

  return (
    <div className="stack">
      {run.flags?.length > 0 && (
        <div className="alert warn">
          <strong>Brief pre-screen:</strong> {run.flags.join(" · ")}. The agents still run, and every draft is checked.
        </div>
      )}
      {run.status === "failed" && <div className="alert error">{run.error} See Activity for details.</div>}

      <ol className="steps" aria-label="Pipeline">
        {STEPS.map((s, i) => {
          const state = run.status === "failed" ? "" : i === activeIdx ? "active" : (activeIdx > i || (done && i < STEPS.length - 1)) ? "done" : "";
          return (
            <li key={s.key} className={`step ${state}`}>
              <span className="step-name">{s.name}</span>
              <span className="step-role">{s.role}</span>
            </li>
          );
        })}
      </ol>
      <p className="orch-note">
        <span className="mono">Orchestrator</span>{" "}
        {run.status === "running"
          ? run.stage?.slotId
            ? `Post ${run.stage.slotId} of ${run.stage.total}${run.stage.attempt ? `, revision ${run.stage.attempt}` : ""}`
            : "Planning the week"
          : run.status === "failed" ? "Stopped." : `Finished. ${metrics.total} drafts sent to you.`}
      </p>

      <section className="panel">
        <div className="panel-head"><h2>Posts</h2><span className="sub">Up to 2 revisions each</span></div>
        {run.progress?.length ? (
          <ul className="slots">
            {run.progress.map((s) => (
              <li key={s.slotId} className={`slot-row ${s.state}`}>
                <span className="slot-when">{s.day} <span className="mono">{s.time}</span></span>
                <span className="slot-theme"><span className="tag">{s.type}</span>{s.theme}</span>
                <span className="attempts" aria-label={`${s.attempts.length} attempts`}>
                  {s.attempts.map((a) => <span key={a.attempt} className={`att ${a.passed ? "pass" : "fail"}`} title={a.issues.join("\n") || "Passed"} />)}
                </span>
                <span className="slot-state">{STATE_LABEL[s.state]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-empty">{run.status === "running" ? "The Planner is building the calendar…" : "No posts were planned."}</p>
        )}
      </section>

      {run.status !== "running" && run.status !== "failed" && (
        <div className="cta-bar">
          <span>{metrics.pending ? `${metrics.pending} draft${metrics.pending > 1 ? "s" : ""} waiting for your approval${metrics.escalated ? `, ${metrics.escalated} flagged` : ""}.` : "All drafts have a decision."}</span>
          <Link className="btn primary" to="../review">Review drafts</Link>
        </div>
      )}
    </div>
  );
}
