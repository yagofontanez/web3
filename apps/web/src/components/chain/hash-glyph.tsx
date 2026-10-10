const GRID = 16;
const HALF = GRID / 2;
const LEVELS = [0, 0.32, 0.62, 1];

export function glyphCells(hash?: string): number[] {
  const hex = hash?.startsWith("0x") ? hash.slice(2) : hash;
  const cells: number[] = new Array(GRID * GRID).fill(0);
  if (!hex || hex.length < 64) return cells;
  const bits = BigInt(`0x${hex}`);
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < HALF; col++) {
      const i = row * HALF + col;
      const level = Number((bits >> BigInt(i * 2)) & 3n);
      cells[row * GRID + col] = level;
      cells[row * GRID + (GRID - 1 - col)] = level;
    }
  }
  return cells;
}

export function HashGlyph({
  hash,
  className = "",
  gap = 0.14,
  animate = true,
  label,
}: {
  hash?: string;
  className?: string;
  gap?: number;
  animate?: boolean;
  label?: string;
}) {
  const cells = glyphCells(hash);
  const size = 1 - gap;
  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      shapeRendering="geometricPrecision"
    >
      {cells.map((level, i) => {
        const x = i % GRID;
        const y = Math.floor(i / GRID);
        return (
          <rect
            key={i}
            x={x + gap / 2}
            y={y + gap / 2}
            width={size}
            height={size}
            rx={0.16}
            className="glyph-cell"
            style={{
              fill: level === 0 ? "var(--glyph-empty)" : "var(--glyph-on)",
              fillOpacity: level === 0 ? 1 : LEVELS[level],
              transitionDelay: animate ? `${(x + y) * 18}ms` : undefined,
            }}
          />
        );
      })}
    </svg>
  );
}
