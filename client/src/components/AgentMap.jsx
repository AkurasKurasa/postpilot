import { useState } from "react";

// Interactive system diagram: lights up the agent that is working, animates the edge being used,
// and explains each part on click.
const INFO = {
  owner: ["Owner", "Fills in the brief. The browser never calls the AI, so the API key stays on the server."],
  orch: ["Orchestrator · main agent", "Decides which subagent works next, sends failed drafts back with the exact issues, and stops after 2 revisions."],
  planner: ["Content Planner · subagent 1", "Skill: content-calendar-planning. Turns the goal into day, time, theme and post type for each slot."],
  writer: ["Content Writer · subagent 2", "Skill: caption-writing. Drafts the caption, hashtags and image idea, then revises using reviewer feedback."],
  gov: ["Governance rules · plain code", "rules.js checks prices, banned claims, personal data and length. A model can't talk its way past it."],
  reviewer: ["Brand & Compliance Reviewer · subagent 3", "Skill: post-review-checklist. Returns PASS or FAIL with issues the Writer can act on."],
  human: ["Human approval · you", "Every post starts PENDING. Only you can approve, edit or reject it. Edits are re-checked by the rules."],
  final: ["Final output", "GET /api/runs/:id/final returns approved posts only. That is the approval gate."],
  audit: ["Audit log", "Every agent step and human decision is saved to MongoDB and logs/audit-log.jsonl."],
};

export default function AgentMap({ run, posts }) {
  const [picked, setPicked] = useState(null);
  const stage = run.stage || {};
  const running = run.status === "running";
  const attempts = (run.progress || []).reduce((n, s) => n + s.attempts.length, 0);
  const lastSlot = (run.progress || []).find((s) => s.slotId === stage.slotId);
  const lastAttempt = lastSlot?.attempts[lastSlot.attempts.length - 1];

  // Which node and edge are live right now
  let active = null, edge = null, result = null;
  if (running) {
    if (stage.agent === "planner") { active = "planner"; edge = "e-planner"; }
    else if (stage.agent === "writer") { active = "writer"; edge = stage.attempt ? "e-loop" : "e-writer"; }
    else if (stage.agent === "governance") { active = "gov"; edge = "e-gov"; }
    else if (stage.agent === "reviewer") {
      active = "reviewer"; edge = "e-rev";
      if (lastAttempt && lastAttempt.attempt === stage.attempt) result = lastAttempt.passed ? "pass" : "fail";
    } else { active = "owner"; edge = "e-owner"; }
  } else if (run.status !== "failed") {
    active = "human"; edge = "e-human";
  }

  const approved = posts.filter((p) => p.decision === "APPROVED").length;
  const pending = posts.filter((p) => p.decision === "PENDING").length;
  const counts = {
    planner: run.progress?.length ? "1 call" : "0 calls",
    writer: `${attempts} draft${attempts === 1 ? "" : "s"}`,
    gov: `${attempts} check${attempts === 1 ? "" : "s"}`,
    reviewer: `${attempts} review${attempts === 1 ? "" : "s"}`,
    human: posts.length ? `${pending} pending` : "approve · edit · reject",
    final: posts.length ? `${approved} of ${posts.length} approved` : "approved posts only",
  };
  const orchLine = running
    ? stage.slotId ? `post ${stage.slotId} of ${stage.total}${stage.attempt ? ` · revision ${stage.attempt}` : ""}` : "planning the week"
    : run.status === "failed" ? "stopped" : "done · drafts sent to you";

  const cls = (id) => `node ${active === id ? "active" : ""} ${id === "reviewer" && result ? result : ""}`;
  const e = (id) => ({ className: `edge ${id === "e-loop" || id === "e-audit" ? "dash" : ""} ${id === "e-loop" ? "loop" : ""} ${edge === id ? "on" : ""}`, markerEnd: `url(#${edge === id ? (id === "e-loop" ? "ah-bad" : "ah-on") : "ah"})` });
  const Node = ({ id, x, y, w, h, title, sub, tag }) => (
    <g className={cls(id)} id={`n-${id}`} tabIndex={0} role="button" aria-label={INFO[id][0]} aria-pressed={picked === id}
      onClick={() => setPicked(picked === id ? null : id)} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), setPicked(picked === id ? null : id))}>
      <rect x={x} y={y} width={w} height={h} rx="10" />
      {tag && <text className="tag" x={x + 12} y={y + 17}>{tag}</text>}
      <text className="t1" x={x + w / 2} y={y + h / 2 + (tag ? 7 : 2)} textAnchor="middle">{title}</text>
      {sub && <text className="t2" x={x + w / 2} y={y + h / 2 + (tag ? 24 : 19)} textAnchor="middle">{sub}</text>}
    </g>
  );

  return (
    <div className="map">
      <div className="map-scroll">
        <svg viewBox="0 0 760 352" className="diagram" role="img" aria-label="PostPilot agent diagram">
          <defs>
            {[["ah", "ah"], ["ah-on", "ah-on"], ["ah-bad", "ah-bad"]].map(([id, c]) => (
              <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path className={c} d="M0 0L10 5L0 10z" /></marker>
            ))}
          </defs>
          <path {...e("e-owner")} d="M140 58H186" />
          <path {...e("e-planner")} d="M252 98V146" />
          <path {...e("e-writer")} d="M402 98V146" />
          <path {...e("e-gov")} d="M464 182H486" />
          <path {...e("e-rev")} d="M600 182H622" />
          <path {...e("e-loop")} d="M685 214V246H402V218" />
          <text className="lbl" x="543" y="262" textAnchor="middle">FAIL → revise with feedback (max 2)</text>
          <path {...e("e-human")} d="M744 182H754V310H614" />
          <text className="lbl" x="746" y="300" textAnchor="end">PASS / flagged</text>
          <path {...e("e-final")} d="M420 310H364" />
          <path {...e("e-audit")} d="M78 88V278" />
          <text className="lbl" x="86" y="186">logs every event</text>

          <Node id="owner" x={16} y={28} w={124} h={60} title="Owner" sub="brief form" />
          <g className={`node orch ${running ? "live" : ""}`} id="n-orch" tabIndex={0} role="button" aria-label={INFO.orch[0]} aria-pressed={picked === "orch"}
            onClick={() => setPicked(picked === "orch" ? null : "orch")} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), setPicked(picked === "orch" ? null : "orch"))}>
            <rect x="190" y="18" width="554" height="80" rx="12" />
            <text className="tag" x="206" y="38">MAIN AGENT · orchestrator.js</text>
            {running && <circle className="beacon" cx="726" cy="34" r="4" />}
            <text className="t1 big" x="467" y="62" textAnchor="middle">Orchestrator</text>
            <text className="t2" x="467" y="82" textAnchor="middle">{orchLine}</text>
          </g>
          <Node id="planner" x={190} y={150} w={124} h={64} tag="AGENT 1" title="Planner" sub={counts.planner} />
          <Node id="writer" x={340} y={150} w={124} h={64} tag="AGENT 2" title="Writer" sub={counts.writer} />
          <Node id="gov" x={490} y={150} w={110} h={64} tag="CODE" title="Rules" sub={counts.gov} />
          <Node id="reviewer" x={626} y={150} w={118} h={64} tag="AGENT 3" title="Reviewer" sub={counts.reviewer} />
          <Node id="human" x={420} y={282} w={194} h={56} title="Human approval" sub={counts.human} />
          <Node id="final" x={190} y={282} w={174} h={56} title="Final output" sub={counts.final} />
          <Node id="audit" x={16} y={282} w={124} h={56} title="Audit log" sub="every step" />
        </svg>
      </div>
      <p className="map-info" aria-live="polite">
        {picked ? <><strong>{INFO[picked][0]}.</strong> {INFO[picked][1]}</> : "Click any box to see what that agent or step does."}
      </p>
    </div>
  );
}
