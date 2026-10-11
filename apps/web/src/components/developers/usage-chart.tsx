const dayFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

export function UsageChart({ data, title }: { data: { day: string; requests: number; errors: number }[]; title: string }) {
  const max = Math.max(...data.map((d) => d.requests), 1);
  const total = data.reduce((s, d) => s + d.requests, 0);
  const ticks = [max, Math.round(max / 2), 0];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">{total.toLocaleString("en")} requests</span>
      </figcaption>
      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        <div className="flex h-40 flex-col justify-between text-right font-mono text-[11px] text-muted tabular-nums" aria-hidden>
          {ticks.map((t, i) => (
            <span key={i} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t.toLocaleString("en")}
            </span>
          ))}
        </div>
        <div className="relative h-40">
          {[0, 50, 100].map((p) => (
            <span key={p} aria-hidden className="absolute inset-x-0 h-px bg-line/70" style={{ bottom: `${p}%` }} />
          ))}
          <ol className="relative flex h-full items-end gap-[2px]" aria-hidden>
            {data.map((d) => {
              const h = d.requests === 0 ? 0 : Math.max(2, (d.requests / max) * 100);
              return (
                <li key={d.day} className="group relative flex h-full flex-1 items-end">
                  <span className="absolute inset-0 rounded-sm group-hover:bg-ink/[0.04]" />
                  <span
                    className="relative w-full rounded-t-[4px] bg-verdigris transition-opacity group-hover:opacity-80"
                    style={{ height: `${h}%` }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-paper shadow-lg group-hover:block">
                    <span className="block font-medium">{dayFmt.format(new Date(`${d.day}T00:00:00Z`))}</span>
                    <span className="block tabular-nums">
                      {d.requests.toLocaleString("en")} requests, {d.errors.toLocaleString("en")} errors
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <span />
        <div className="mt-2 flex justify-between text-[11px] text-muted" aria-hidden>
          <span>{dayFmt.format(new Date(`${data[0]!.day}T00:00:00Z`))}</span>
          <span>{dayFmt.format(new Date(`${data.at(-1)!.day}T00:00:00Z`))}</span>
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Requests</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.requests}</td>
              <td>{d.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function StatTile({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "warn" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-mono text-2xl tracking-tight tabular-nums ${tone === "warn" ? "text-amber" : ""}`}>{value}</span>
      {sub ? <span className="text-xs text-muted">{sub}</span> : null}
    </div>
  );
}
