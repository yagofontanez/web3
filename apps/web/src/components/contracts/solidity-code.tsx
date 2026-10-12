const KEYWORDS = new Set(
  "pragma solidity import from contract interface library is function constructor modifier event error emit returns return memory storage calldata public private internal external view pure payable override virtual if else for while require revert new using struct mapping enum true false address uint256 uint8 uint int256 bool string bytes bytes32 unchecked immutable constant".split(" "),
);

function tokenize(line: string) {
  const out: { t: string; c: string }[] = [];
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d[\d_]*(?:\.\d+)?(?:e\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
  for (const m of line.matchAll(re)) {
    if (m[1]) out.push({ t: m[1], c: "text-muted italic" });
    else if (m[2]) out.push({ t: m[2], c: "text-[#5fd0bc]" });
    else if (m[3]) out.push({ t: m[3], c: "text-[#e0a94e]" });
    else if (m[4]) out.push({ t: m[4], c: KEYWORDS.has(m[4]) ? "text-[#8fb6ff]" : /^[A-Z]/.test(m[4]) ? "text-[#f0c987]" : "" });
    else out.push({ t: m[0], c: "" });
  }
  return out;
}

export function SolidityCode({ source, highlightLines = [], maxHeight = "32rem" }: { source: string; highlightLines?: number[]; maxHeight?: string }) {
  const lines = source.replace(/\n$/, "").split("\n");
  const width = String(lines.length).length;
  return (
    <div className="theme-dark deep-surface overflow-auto rounded-lg" style={{ maxHeight }}>
      <pre className="py-3 font-mono text-[12.5px] leading-[1.65] text-ink">
        {lines.map((l, i) => (
          <div key={i} className={`flex pr-4 ${highlightLines.includes(i + 1) ? "bg-danger/20" : ""}`}>
            <span className="sticky left-0 shrink-0 bg-inherit pr-4 pl-4 text-right text-muted/60 select-none" style={{ width: `${width + 3}ch` }}>
              {i + 1}
            </span>
            <code className="whitespace-pre">
              {tokenize(l).map((tok, j) => (
                <span key={j} className={tok.c}>
                  {tok.t}
                </span>
              ))}
            </code>
          </div>
        ))}
      </pre>
    </div>
  );
}
