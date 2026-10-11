import { connection } from "next/server";
import { API_BASE_URL } from "@/lib/developer";

async function pingApi() {
  const started = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    return { ok: res.ok, ms: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - started) };
  }
}

export async function ApiStatus() {
  await connection();
  const { ok, ms } = await pingApi();
  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs ${ok ? "border-verdigris/30 bg-verdigris-soft/50 text-ink" : "border-danger/40 text-danger"}`}>
      <span className="relative flex size-2" aria-hidden>
        {ok ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-verdigris opacity-50" /> : null}
        <span className={`relative inline-flex size-2 rounded-full ${ok ? "bg-verdigris" : "bg-danger"}`} />
      </span>
      {ok ? `API operational, ${ms} ms` : "API unreachable"}
      <span className="font-mono text-muted">{API_BASE_URL.replace(/^https?:\/\//, "")}</span>
    </span>
  );
}
