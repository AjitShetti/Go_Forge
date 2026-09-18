import { Plate } from "@/components/ui";

// Three slice headers pointing at one backing array of 4 ints.
// Values shown are the state after both appends, matching the verified trap output (42 42).
export function SliceAliasingDiagram() {
  const cellW = 64;
  const arrX = 250;
  const arrY = 210;
  const headers = [
    { name: "a", len: 3, y: 30 },
    { name: "b", len: 4, y: 90 },
    { name: "c", len: 4, y: 150 },
  ];
  const cells = ["0", "0", "0", "42"];
  return (
    <Plate caption="Slice headers share one backing array" aside="after both appends" className="not-prose">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 600 300" className="w-full min-w-[520px]" role="img" aria-label="Slices a, b and c are three headers whose pointers all point at the same four-element array; slot 3 holds 42.">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--color-accent)" />
            </marker>
          </defs>
          {headers.map((h) => (
            <g key={h.name} fontFamily="var(--font-mono)" fontSize="13">
              <text x="12" y={h.y + 24} fill="var(--color-ink)" fontWeight="700">
                {h.name}
              </text>
              {[
                ["ptr", "•"],
                ["len", String(h.len)],
                ["cap", "4"],
              ].map(([k, v], i) => (
                <g key={k}>
                  <rect x={36 + i * 52} y={h.y} width="52" height="36" fill="var(--color-paper)" stroke="var(--color-ink)" />
                  <text x={36 + i * 52 + 26} y={h.y + 14} textAnchor="middle" fontSize="9" fill="var(--color-ink-3)">
                    {k}
                  </text>
                  <text x={36 + i * 52 + 26} y={h.y + 29} textAnchor="middle" fill={k === "ptr" ? "var(--color-accent)" : "var(--color-ink)"}>
                    {v}
                  </text>
                </g>
              ))}
              <path d={`M62 ${h.y + 22} C 160 ${h.y + 22}, 200 ${arrY - 30}, ${arrX + 8} ${arrY - 4}`} fill="none" stroke="var(--color-accent)" strokeWidth="1.2" markerEnd="url(#arrow)" opacity="0.8" />
            </g>
          ))}
          <g fontFamily="var(--font-mono)" fontSize="14">
            {cells.map((v, i) => (
              <g key={i}>
                <rect x={arrX + i * cellW} y={arrY} width={cellW} height="44" fill={i === 3 ? "var(--color-accent-soft)" : "var(--color-paper)"} stroke="var(--color-ink)" />
                <text x={arrX + i * cellW + cellW / 2} y={arrY + 28} textAnchor="middle" fill="var(--color-ink)">
                  {v}
                </text>
                <text x={arrX + i * cellW + cellW / 2} y={arrY + 64} textAnchor="middle" fontSize="10" fill="var(--color-ink-3)">
                  [{i}]
                </text>
              </g>
            ))}
            <text x={arrX + 3 * cellW + cellW / 2} y={arrY - 12} textAnchor="middle" fontSize="10" fill="var(--color-accent)">
              b[3] and c[3]
            </text>
            <text x={arrX} y={arrY + 90} fontSize="11" fill="var(--color-ink-2)">
              backing array · one allocation · room for 4
            </text>
          </g>
        </svg>
      </div>
    </Plate>
  );
}
