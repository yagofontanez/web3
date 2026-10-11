"use client";

import { useState, useSyncExternalStore } from "react";
import { LANGS, type Lang } from "@/lib/snippets";

const KEY = "w3s:snippet-lang";
const EVENT = "w3s:lang";

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "curl" || v === "javascript" || v === "python") return v;
  } catch {}
  return "curl";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function choose(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function CodeTabs({ code, label, wrap = true }: { code: Record<Lang, string>; label?: string; wrap?: boolean }) {
  const lang = useSyncExternalStore(subscribe, read, () => "curl" as Lang);
  const [copied, setCopied] = useState(false);

  return (
    <div className="theme-dark deep-surface overflow-hidden rounded-lg">
      <div className="flex items-center justify-between gap-2 border-b border-line pr-1.5 pl-2">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto" role="tablist" aria-label={label ?? "Language"}>
          {label ? <span className="mr-2 shrink-0 pl-2 text-xs text-muted">{label}</span> : null}
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={lang === l.id}
              onClick={() => choose(l.id)}
              className={`-mb-px shrink-0 border-b-2 px-2 py-2 text-xs ${lang === l.id ? "border-verdigris text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code[lang]);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded px-2 py-1 text-xs text-muted hover:bg-white/10 hover:text-ink"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={`p-4 font-mono text-[12.5px] leading-relaxed text-ink ${wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "overflow-x-auto"}`}>{code[lang]}</pre>
    </div>
  );
}
