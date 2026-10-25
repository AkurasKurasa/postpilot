import { useEffect, useState } from "react";
import { api } from "../api.js";

function summary(e) {
  const d = e.data || {};
  switch (e.event) {
    case "START": return `Brief received for ${d.business} (${d.posts} posts)`;
    case "BRIEF_FLAGGED": return d.flags.join(" · ");
    case "PLAN_CREATED": return `${d.count} slots planned`;
    case "DRAFT_WRITTEN": return `Post ${d.slotId}, attempt ${d.attempt}: “${d.caption}”`;
    case "RULES_CHECKED": return d.issues.length ? `Post ${d.slotId}: ${d.issues.join(" · ")}` : `Post ${d.slotId}: all rules passed`;
    case "REVIEW": return `Post ${d.slotId} ${d.status}${d.issues.length ? `: ${d.issues.join(" · ")}` : ""}`;
    case "ESCALATED": return `Post ${d.slotId} flagged for you after ${d.attempts} attempts`;
    case "SENT_TO_HUMAN": return `${d.count} drafts sent for approval, ${d.flagged} flagged`;
    case "HUMAN_APPROVED": return `Post ${d.slotId} approved${d.edited ? " with edits" : ""}${d.overrode ? ` (override: ${d.overrode.join("; ")})` : ""}`;
    case "HUMAN_REJECTED": return `Post ${d.slotId} rejected`;
    case "HUMAN_RESET": return `Post ${d.slotId} back to pending`;
    case "ERROR": return d.message;
    default: return JSON.stringify(d);
  }
}
const tone = (e) =>
  e.event === "HUMAN_APPROVED" || (e.event === "REVIEW" && e.data.status === "PASS") ? "ok"
  : /ERROR|ESCALATED|REJECTED|FLAGGED/.test(e.event) || (e.event === "REVIEW" && e.data.status === "FAIL") ? "bad"
  : e.event === "RULES_CHECKED" && e.data.issues.length ? "warn" : "";

export default function ActivityDrawer({ open, onClose, runId, version }) {
  const [events, setEvents] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { if (open) api.events(runId).then(setEvents).catch(() => {}); }, [open, runId, version]);
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const t0 = events[0] ? new Date(events[0].createdAt).getTime() : 0;
  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open} aria-label="Audit log">
        <div className="drawer-head">
          <div>
            <h2>Audit log</h2>
            <p className="sub">{events.length} events · every agent step and decision</p>
          </div>
          <button className="tool-btn" onClick={onClose}>Close</button>
        </div>
        <ul className="events">
          {events.map((e) => (
            <li key={e.id}>
              <button className="event" aria-expanded={expanded === e.id} onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                <span className="mono ev-time">+{((new Date(e.createdAt).getTime() - t0) / 1000).toFixed(1)}s</span>
                <span className={`mono ev-name ${tone(e)}`}>{e.event}</span>
                <span className="ev-sum">{summary(e)}</span>
              </button>
              {expanded === e.id && <pre>{JSON.stringify({ time: e.createdAt, event: e.event, data: e.data }, null, 2)}</pre>}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
