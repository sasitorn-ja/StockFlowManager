import type { StatCard } from "@/types/stock-flow";

type StatsGridProps = {
  stats: StatCard[];
};

export function StatsGrid({ stats }: StatsGridProps) {
  const toneClasses = {
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  } as const;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => (
        <article key={stat.label} className="kpi-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-muted)]">{stat.label}</p>
              <div className="mt-2 flex items-end gap-2">
                <strong className="text-2xl font-bold text-[var(--text-strong)]">
                  {stat.value}
                </strong>
                {stat.unit ? (
                  <span className="pb-1 text-[11px] font-medium text-[var(--text-subtle)]">
                    {stat.unit}
                  </span>
                ) : null}
              </div>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold ${
                toneClasses[stat.tone ?? "sky"]
              }`}
            >
              {stat.value.slice(0, 1)}
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-muted)]">{stat.helper ?? "อัปเดตจากข้อมูลล่าสุด"}</p>
        </article>
      ))}
    </section>
  );
}
