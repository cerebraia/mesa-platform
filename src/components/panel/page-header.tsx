// Shared page header for all panel sections.
// Renders title, optional description and optional right-side actions.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title:        string;
  description?: string;
  actions?:     React.ReactNode;
}) {
  return (
    <div className="panel-page-header">
      <div>
        <h1 className="panel-page-title">{title}</h1>
        {description && <p className="panel-page-desc">{description}</p>}
      </div>
      {actions && (
        <div className="panel-page-actions">{actions}</div>
      )}
    </div>
  );
}
