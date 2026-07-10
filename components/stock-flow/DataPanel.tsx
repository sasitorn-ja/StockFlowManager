import type { ReactNode } from "react";

type DataPanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function DataPanel({ title, action, children }: DataPanelProps) {
  return (
    <section className="dashboard-card overflow-hidden">
      <div className="dashboard-panel-header">
        <h2 className="dashboard-section-title">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
