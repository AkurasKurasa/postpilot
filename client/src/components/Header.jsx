import { useEffect, useRef, useState } from "react";

const STATUS = { running: "Agents working", awaiting_approval: "Waiting for you", completed: "Done", failed: "Failed" };

export default function Header({ steps, view, setView, plans, currentId, openPlan, health, onActivity, onNew }) {
  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo" onClick={onNew} aria-label="PostPilot, new plan">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 18 20 12 4 6l2.5 6z" /></svg>
          </span>
          <span className="logo-word">Post<span>Pilot</span></span>
        </button>

        <nav className="stepper" aria-label="Steps">
          {steps.map((s, i) => {
            const activeIdx = steps.findIndex((x) => x.key === view);
            const state = s.key === view ? "active" : i < activeIdx && s.enabled ? "done" : "";
            return (
              <button key={s.key} className={`step-btn ${state}`} disabled={!s.enabled} aria-current={s.key === view ? "step" : undefined} onClick={() => setView(s.key)}>
                <span className="step-num">{i + 1}</span>
                <span className="step-label">{s.label}</span>
                {s.badge > 0 && <span className="step-badge">{s.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="header-tools">
          <PlansMenu plans={plans} currentId={currentId} openPlan={openPlan} />
          {onActivity && <button className="tool-btn" onClick={onActivity}>Activity</button>}
          {health && (
            <span className={`mode ${health.ok ? health.llm : health.waking ? "waking" : "down"}`} title={health.ok ? (health.db === "memory" ? "In-memory database" : "MongoDB") : health.waking ? "The API was asleep and is starting up (can take a minute)" : "The API is not reachable. Still retrying."}>
              {health.ok ? (health.llm === "mock" ? "Mock agents" : "Claude") : health.waking ? "Waking up API…" : "API offline"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function PlansMenu({ plans, currentId, openPlan }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="menu" ref={ref}>
      <button className="tool-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Plans <span aria-hidden="true">▾</span></button>
      {open && (
        <div className="menu-pop" role="menu">
          {plans.length === 0 && <p className="menu-empty">No plans yet.</p>}
          {plans.map((p) => (
            <button key={p.id} role="menuitem" className={`menu-item ${p.id === currentId ? "on" : ""}`} onClick={() => { setOpen(false); openPlan(p.id); }}>
              <span className={`dot dot-${p.status}`} />
              <span className="menu-text">
                <span className="menu-name">{p.brief.name}</span>
                <span className="menu-meta">
                  {new Date(p.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ·{" "}
                  {p.counts.total ? `${p.counts.APPROVED}/${p.counts.total} approved` : STATUS[p.status]}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
