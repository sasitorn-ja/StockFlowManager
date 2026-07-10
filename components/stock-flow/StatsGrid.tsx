export type StatCard = {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  tone?: "sky" | "emerald" | "amber" | "violet" | "orange";
  icon?: any;
  valueTone?: "default" | "danger";
};

type StatsGridProps = {
  stats: StatCard[];
};

export function StatsGrid({ stats }: StatsGridProps) {
  const toneClasses = {
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-600",
  } as const;
  const valueToneClasses = {
    default: "text-[var(--text-strong)]",
    danger: "text-red-600",
  } as const;

  return (
    <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <article key={stat.label} className="kpi-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold leading-4 text-[var(--text-muted)]">
                {stat.label}
              </p>
              <div className="mt-1.5 flex flex-wrap items-end gap-1.5">
                <strong
                  className={`break-words text-[21px] font-bold leading-6 ${
                    valueToneClasses[stat.valueTone ?? "default"]
                  }`}
                >
                  {stat.value}
                </strong>
                {stat.unit ? (
                  <span className="pb-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
                    {stat.unit}
                  </span>
                ) : null}
              </div>
            </div>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                toneClasses[stat.tone ?? "sky"]
              }`}
            >
              {stat.value.slice(0, 1)}
            </div>
          </div>
          {stat.helper ? <p className="text-[11px] leading-4 text-[var(--text-muted)]">{stat.helper}</p> : null}
        </article>
      ))}
    </section>
  );
}
