interface StatePanelProps {
  title: string;
  message: string;
  tone?: "info" | "success" | "warning" | "danger";
  actionLabel?: string;
  actionHref?: string;
}

export function StatePanel({
  title,
  message,
  tone = "info",
  actionLabel,
  actionHref,
}: StatePanelProps) {
  return (
    <section className={`state-panel state-panel--${tone}`}>
      <p className="state-panel__eyebrow">Status</p>
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && actionHref ? (
        <a className="state-panel__action" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}
    </section>
  );
}
