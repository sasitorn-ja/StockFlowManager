import type { ReactNode } from "react";

type DataPanelProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

export function DataPanel({ title, description, action, children }: DataPanelProps) {
  return (
    <section className="dashboard-card overflow-hidden">
      <div className="dashboard-panel-header">
        <div>
          <h2 className="dashboard-section-title">{title}</h2>
          <p className="dashboard-subtitle">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
