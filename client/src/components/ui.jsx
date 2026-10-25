export function StatusDot({ status }) {
  return <span className={`dot dot-${status}`} aria-hidden="true" />;
}

export function Pill({ tone = "idle", children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function PostStatus({ post }) {
  if (post.decision === "APPROVED") return <Pill tone="ok">{post.edited ? "Approved · edited" : "Approved"}</Pill>;
  if (post.decision === "REJECTED") return <Pill>Rejected</Pill>;
  return post.status === "NEEDS_HUMAN_ATTENTION" ? <Pill tone="warn">Needs attention</Pill> : <Pill tone="ok">Passed review</Pill>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
