"use client";

import { useEffect, useState } from "react";

export function DocNav({ sections }: { sections: { id: string; label: string; mono?: boolean; group?: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="On this page" className="sticky top-10 hidden lg:block">
      <ul className="flex flex-col gap-0.5 border-l border-line text-sm">
        {sections.map((s, i) => {
          const header = s.group && s.group !== sections[i - 1]?.group ? s.group : null;
          return (
            <li key={s.id}>
              {header ? <span className="mt-4 mb-1 block pl-4 text-xs text-muted">{header}</span> : null}
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "location" : undefined}
                className={`-ml-px block truncate border-l py-1 pl-4 ${s.mono ? "font-mono text-xs" : ""} ${
                  active === s.id ? "border-verdigris text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
