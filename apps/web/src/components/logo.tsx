import Link from "next/link";

export function Logo({ href = "/", labelClassName = "" }: { href?: string; labelClassName?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <rect x="1" y="2" width="12" height="4" rx="1" fill="currentColor" />
        <rect x="1" y="8" width="12" height="4" rx="1" fill="currentColor" />
        <rect x="7" y="14" width="12" height="4" rx="1" fill="var(--verdigris)" />
      </svg>
      <span className={labelClassName}>Systema</span>
    </Link>
  );
}
