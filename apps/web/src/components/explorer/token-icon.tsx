export function TokenIcon({ symbol, logo }: { symbol: string; logo: string | null }) {
  if (logo) {
    return <img src={logo} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" className="size-7 shrink-0 rounded-full bg-paper" />;
  }
  return (
    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-paper text-[10px] font-semibold text-muted ring-1 ring-line">
      {symbol.slice(0, 3).toUpperCase()}
    </span>
  );
}
