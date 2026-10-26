import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import Header from "./components/Header.jsx";
import ActivityDrawer from "./components/ActivityDrawer.jsx";
import BriefView, { EXAMPLES } from "./views/BriefView.jsx";
import AgentsView from "./views/AgentsView.jsx";
import ReviewView from "./views/ReviewView.jsx";
import CalendarView from "./views/CalendarView.jsx";

const WAKE_WINDOW_MS = 120000;

// One-page app: the header's step bar switches between four views of the current plan.
export default function App() {
  const [health, setHealth] = useState(null);
  const [plans, setPlans] = useState([]);
  const [brief, setBrief] = useState(EXAMPLES[0].brief);
  const [planId, setPlanId] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState("brief");
  const [activityOpen, setActivityOpen] = useState(false);
  const lastStatus = useRef(null);

  const refreshPlans = useCallback(() => api.listPlans().then(setPlans).catch(() => {}), []);
  // The hosted API (Render free tier) sleeps when idle and takes up to a minute to wake,
  // so keep checking instead of declaring it offline after one failed request.
  useEffect(() => {
    let cancelled = false;
    let timer;
    const started = Date.now();
    async function check() {
      try {
        const h = await api.health();
        if (cancelled) return;
        setHealth(h);
        refreshPlans();
      } catch {
        if (cancelled) return;
        const waking = Date.now() - started < WAKE_WINDOW_MS;
        setHealth({ ok: false, waking });
        timer = setTimeout(check, waking ? 3000 : 15000);
      }
    }
    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [refreshPlans]);

  const reload = useCallback(async () => {
    if (!planId) return null;
    try {
      const d = await api.getPlan(planId);
      setData(d);
      if (lastStatus.current && lastStatus.current !== d.run.status) refreshPlans();
      lastStatus.current = d.run.status;
      return d;
    } catch {
      return null;
    }
  }, [planId, refreshPlans]);

  useEffect(() => { reload(); }, [reload]);

  // Poll while the agents are working
  const running = data?.run.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 800);
    return () => clearInterval(t);
  }, [running, reload]);

  async function openPlan(id) {
    const d = await api.getPlan(id).catch(() => null);
    if (!d) return;
    lastStatus.current = d.run.status;
    setData(d);
    setPlanId(id);
    setView({ awaiting_approval: "review", completed: "calendar" }[d.run.status] || "agents");
  }

  function onCreated(run) {
    lastStatus.current = "running";
    setData(null);
    setPlanId(run.id);
    setView("agents");
    refreshPlans();
  }

  const ready = data && !["running", "failed"].includes(data.run.status);
  const steps = [
    { key: "brief", label: "Brief", enabled: true },
    { key: "agents", label: "Agents", enabled: !!planId },
    { key: "review", label: "Review", enabled: !!ready, badge: ready ? data.metrics.pending : 0 },
    { key: "calendar", label: "Calendar", enabled: !!ready },
  ];

  return (
    <>
      <Header
        steps={steps}
        view={view}
        setView={setView}
        plans={plans}
        currentId={planId}
        openPlan={openPlan}
        health={health}
        onActivity={planId ? () => setActivityOpen(true) : null}
        onNew={() => setView("brief")}
      />
      <main className="main">
        {view === "brief" && <BriefView brief={brief} setBrief={setBrief} health={health} onCreated={onCreated} />}
        {view === "agents" && <AgentsView data={data} onReview={() => setView("review")} />}
        {view === "review" && data && <ReviewView data={data} reload={reload} onCalendar={() => setView("calendar")} />}
        {view === "calendar" && data && <CalendarView data={data} onReview={() => setView("review")} />}
      </main>
      {planId && <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} runId={planId} version={`${data?.run.updatedAt}-${data?.posts.map((p) => p.decision).join("")}`} />}
    </>
  );
}
