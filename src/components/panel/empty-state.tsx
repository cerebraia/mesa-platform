import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?:        LucideIcon;
  title:        string;
  description?: string;
  action?:      React.ReactNode;
}) {
  return (
    <div className="panel-empty">
      {Icon && (
        <div className="panel-empty-icon">
          <Icon size={24} strokeWidth={1.5} />
        </div>
      )}
      <p className="panel-empty-title">{title}</p>
      {description && <p className="panel-empty-desc">{description}</p>}
      {action}
    </div>
  );
}
