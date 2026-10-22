// Shared page header for panel and admin sections.
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title:        string;
  description?: string;
  actions?:     React.ReactNode;
  breadcrumb?:  React.ReactNode;
}) {
  return (
    <div className="panel-page-header">
      <div>
        {breadcrumb && <div className="panel-breadcrumb">{breadcrumb}</div>}
        <h1 className="panel-page-title">{title}</h1>
        {description && <p className="panel-page-desc">{description}</p>}
      </div>
      {actions && (
        <div className="panel-page-actions">{actions}</div>
      )}
    </div>
  );
}
