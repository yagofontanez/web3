"use client";

import { useState } from "react";

export function CodeBlock({ code, label, wrap = false }: { code: string; label?: string; wrap?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="theme-dark deep-surface relative overflow-hidden rounded-lg">
      {label ? <div className="border-b border-line px-4 py-2 text-xs text-muted">{label}</div> : null}
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-1.5 right-1.5 rounded px-2 py-1 text-xs text-muted hover:bg-white/10 hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className={`p-4 pr-16 font-mono text-[12.5px] leading-relaxed text-ink ${wrap ? "break-all whitespace-pre-wrap" : "overflow-x-auto"}`}>{code}</pre>
    </div>
  );
}
