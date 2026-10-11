export function Sparkline({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <span className="flex h-8 items-end gap-[2px]" role="img" aria-label={`${label}: ${total} requests over ${data.length} days`}>
      {data.map((v, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-t-[2px] ${v === 0 ? "bg-line" : "bg-verdigris"}`}
          style={{ height: v === 0 ? "2px" : `${Math.max(12, (v / max) * 100)}%` }}
          title={`${v} requests`}
        />
      ))}
    </span>
  );
}
