import AgentMap from "../components/AgentMap.jsx";

const STATE = {
  waiting: "Waiting", writing: "Writing", revising: "Revising", checking: "Checking rules",
  reviewing: "In review", passed: "Passed", flagged: "Needs you",
};

export default function AgentsView({ data, onReview }) {
  if (!data) return <div className="view center"><p className="sub">Starting the agents…</p></div>;
  const { run, metrics } = data;
  const running = run.status === "running";

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <p className="eyebrow">{run.brief.name}</p>
          <h1>{running ? "The agents are working" : run.status === "failed" ? "The run stopped" : "Drafts are ready"}</h1>
        </div>
        {!running && run.status !== "failed" && (
          <button className="btn primary" onClick={onReview}>
            Review {metrics.pending} draft{metrics.pending === 1 ? "" : "s"} →
          </button>
        )}
      </div>

      {run.flags?.length > 0 && <div className="alert warn"><strong>Brief pre-screen:</strong>&nbsp;{run.flags.join(" · ")}. Every draft is still checked.</div>}

      {run.status === "failed" && <div className="alert error">{run.error} Open Activity for details.</div>}

      <section className="flow">
        <AgentMap run={run} posts={data.posts} />
      </section>

      <section className="slots">
        {(run.progress || []).map((s) => (
          <div key={s.slotId} className={`slot ${s.state}`}>
            <div className="slot-day"><strong>{s.day}</strong><span className="mono">{s.time}</span></div>
            <div className="slot-main">
              <span className="slot-theme">{s.theme}</span>
              <span className="slot-type">{s.type}</span>
            </div>
            <div className="attempts" aria-label={`${s.attempts.length} attempts`}>
              {[0, 1, 2].map((n) => {
                const a = s.attempts[n];
                return <span key={n} className={`att ${a ? (a.passed ? "pass" : "fail") : ""}`} title={a ? a.issues.join("\n") || "Passed" : ""} />;
              })}
            </div>
            <span className="slot-state">{STATE[s.state]}</span>
          </div>
        ))}
        {!run.progress?.length && running && <p className="sub pad">The Planner is building the calendar…</p>}
      </section>
    </div>
  );
}
