import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api.js";

function summary(e) {
  const d = e.data || {};
  switch (e.event) {
    case "START": return `Brief received for ${d.business} (${d.posts} posts, ${d.llm === "mock" ? "mock agents" : "Claude"})`;
    case "BRIEF_FLAGGED": return d.flags.join(" · ");
    case "PLAN_CREATED": return `${d.count} slots: ${d.slots.join(", ")}`;
    case "DRAFT_WRITTEN": return `Post ${d.slotId}, attempt ${d.attempt}: “${d.caption}”`;
    case "RULES_CHECKED": return d.issues.length ? `Post ${d.slotId}: ${d.issues.join(" · ")}` : `Post ${d.slotId}: all rules passed`;
    case "REVIEW": return `Post ${d.slotId} ${d.status}${d.issues.length ? `: ${d.issues.join(" · ")}` : ""}`;
    case "ESCALATED": return `Post ${d.slotId} stopped after ${d.attempts} attempts and was flagged for you`;
    case "SENT_TO_HUMAN": return `${d.count} drafts sent for approval, ${d.flagged} flagged`;
    case "HUMAN_APPROVED": return `Post ${d.slotId} approved${d.edited ? " with edits" : ""}${d.overrode ? ` (override: ${d.overrode.join("; ")})` : ""}`;
    case "HUMAN_REJECTED": return `Post ${d.slotId} rejected`;
    case "HUMAN_RESET": return `Post ${d.slotId} back to pending (was ${d.previous})`;
    case "ERROR": return d.message;
    default: return JSON.stringify(d);
  }
}
const tone = (e) =>
  /HUMAN_APPROVED/.test(e.event) || (e.event === "REVIEW" && e.data.status === "PASS") ? "ok"
  : /ERROR|ESCALATED|REJECTED|FLAGGED/.test(e.event) || (e.event === "REVIEW" && e.data.status === "FAIL") ? "bad"
  : e.event === "RULES_CHECKED" && e.data.issues.length ? "warn" : "";

export default function Activity() {
  const { run, posts } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(null);

  // Refetch when the plan changes (new progress or a decision)
  const key = `${run.updatedAt}-${posts.map((p) => p.decision).join("")}`;
  useEffect(() => { api.events(run.id).then(setEvents).catch(() => {}); }, [run.id, key]);

  const t0 = events[0] ? new Date(events[0].createdAt).getTime() : 0;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Audit log</h2><span className="sub">{events.length} events · also written to logs/audit-log.jsonl</span></div>
      <ul className="events">
        {events.map((e) => (
          <li key={e.id}>
            <button className="event" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
              <span className="mono ev-time">+{((new Date(e.createdAt).getTime() - t0) / 1000).toFixed(1)}s</span>
              <span className={`mono ev-name ${tone(e)}`}>{e.event}</span>
              <span className="ev-sum">{summary(e)}</span>
            </button>
            {open === e.id && <pre>{JSON.stringify({ time: e.createdAt, event: e.event, data: e.data }, null, 2)}</pre>}
          </li>
        ))}
      </ul>
    </section>
  );
}
