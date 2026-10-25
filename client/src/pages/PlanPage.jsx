import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useOutletContext, useParams } from "react-router-dom";
import { api } from "../api.js";
import { Empty, Pill } from "../components/ui.jsx";
import { statusLabel } from "../App.jsx";

export default function PlanPage() {
  const { id } = useParams();
  const { refreshPlans, health } = useOutletContext();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const lastStatus = useRef(null);

  const reload = useCallback(async () => {
    try {
      const d = await api.getPlan(id);
      setData(d);
      setError("");
      if (lastStatus.current && lastStatus.current !== d.run.status) refreshPlans();
      lastStatus.current = d.run.status;
      return d;
    } catch (e) {
      setError(e.message);
    }
  }, [id, refreshPlans]);

  useEffect(() => { setData(null); lastStatus.current = null; reload(); }, [id, reload]);

  // Poll while the agents are working
  const running = data?.run.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 800);
    return () => clearInterval(t);
  }, [running, reload]);

  if (error) return <div className="page"><Empty title="Couldn't load this plan">{error}</Empty></div>;
  if (!data) return <div className="page"><p className="sub">Loading…</p></div>;

  const { run, metrics } = data;
  const tone = { running: "accent", awaiting_approval: "warn", completed: "ok", failed: "bad" }[run.status];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{run.brief.name}</h1>
          <p className="sub">
            {run.brief.count} posts · {new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            {" · "}{run.llmMode === "mock" ? "mock agents" : "Claude"}
          </p>
        </div>
        <Pill tone={tone}>{statusLabel(run.status)}</Pill>
      </header>

      <nav className="tabs" aria-label="Plan sections">
        <NavLink to="progress">Progress</NavLink>
        <NavLink to="review" className={running ? "disabled" : ""}>
          Review {metrics.pending > 0 && <span className="count">{metrics.pending}</span>}
        </NavLink>
        <NavLink to="calendar" className={running ? "disabled" : ""}>Calendar</NavLink>
        <NavLink to="activity">Activity</NavLink>
      </nav>

      <Outlet context={{ ...data, reload, health }} />
    </div>
  );
}

export function PlanIndex() {
  const { run } = useOutletContext();
  const to = { awaiting_approval: "review", completed: "calendar" }[run.status] || "progress";
  return <Navigate to={to} replace />;
}
