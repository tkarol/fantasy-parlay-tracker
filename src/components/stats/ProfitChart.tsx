import { useId, useMemo, useState } from "react";
import { useMeasure } from "../../hooks/useMeasure";
import { formatUsdSigned } from "../../lib/odds";

export interface ProfitPoint {
  weekId: string;
  week: number;
  season: number;
  cumulative: number;
}

const HEIGHT = 200;
const PAD = { top: 16, right: 16, bottom: 26, left: 48 };

/**
 * Cumulative group profit across the season.
 *
 * One series, so no legend — the card title names it. The final point carries
 * a direct label; the rest are read via the crosshair tooltip rather than
 * stamping a number on every point.
 */
export function ProfitChart({ points }: { points: ProfitPoint[] }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const clipId = useId();

  const geometry = useMemo(() => {
    if (points.length === 0 || width === 0) return null;

    const plotWidth = Math.max(10, width - PAD.left - PAD.right);
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;

    const values = points.map((point) => point.cumulative);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    // Pad the domain so the line never rides the frame, and keep it non-zero
    // for a flat all-zero series.
    const span = rawMax - rawMin || 1;
    const min = rawMin - span * 0.1;
    const max = rawMax + span * 0.1;

    const x = (index: number) =>
      PAD.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = (value: number) => PAD.top + ((max - value) / (max - min)) * plotHeight;

    const line = points.map((point, index) => `${x(index)},${y(point.cumulative)}`).join(" ");
    const zeroY = y(0);

    // Close the area down to the zero line so the fill reads as "distance from
    // break-even" rather than distance from the bottom of the frame.
    const area = `${x(0)},${zeroY} ${line} ${x(points.length - 1)},${zeroY}`;

    return { x, y, zeroY, line, area, plotWidth, plotHeight, min, max };
  }, [points, width]);

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        No settled weeks yet — the curve starts once a ticket is graded.
      </p>
    );
  }

  const active = hoverIndex !== null ? points[hoverIndex] : undefined;
  const last = points[points.length - 1]!;

  return (
    <div className="viz" ref={ref}>
      {geometry && width > 0 && (
        <div className="relative">
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Cumulative profit across ${points.length} settled weeks, ending at ${formatUsdSigned(last.cumulative)}`}
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const relative = event.clientX - bounds.left - PAD.left;
              const step = geometry.plotWidth / Math.max(1, points.length - 1);
              const index = Math.round(relative / step);
              setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
            }}
          >
            <defs>
              {/* Split the fill at break-even: above and below get their own clip. */}
              <clipPath id={`${clipId}-above`}>
                <rect x="0" y="0" width={width} height={geometry.zeroY} />
              </clipPath>
              <clipPath id={`${clipId}-below`}>
                <rect x="0" y={geometry.zeroY} width={width} height={HEIGHT - geometry.zeroY} />
              </clipPath>
            </defs>

            {/* Recessive grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const y = PAD.top + fraction * geometry.plotHeight;
              return (
                <line
                  key={fraction}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--viz-grid)"
                  strokeWidth="1"
                />
              );
            })}

            <polygon
              points={geometry.area}
              fill="var(--viz-positive)"
              opacity="0.14"
              clipPath={`url(#${clipId}-above)`}
            />
            <polygon
              points={geometry.area}
              fill="var(--viz-negative)"
              opacity="0.14"
              clipPath={`url(#${clipId}-below)`}
            />

            {/* Break-even reference, emphasised over the ordinary grid. */}
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={geometry.zeroY}
              y2={geometry.zeroY}
              stroke="var(--viz-axis)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <text
              x={PAD.left - 8}
              y={geometry.zeroY + 3}
              textAnchor="end"
              className="fill-ink-faint text-[10px]"
            >
              $0
            </text>

            <polyline
              points={geometry.line}
              fill="none"
              stroke={last.cumulative >= 0 ? "var(--viz-positive)" : "var(--viz-negative)"}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              clipPath={undefined}
            />

            {/* Final value carries a direct label; the rest use the tooltip. */}
            <circle
              cx={geometry.x(points.length - 1)}
              cy={geometry.y(last.cumulative)}
              r="4"
              fill={last.cumulative >= 0 ? "var(--viz-positive)" : "var(--viz-negative)"}
              stroke="rgb(var(--surface))"
              strokeWidth="2"
            />

            {hoverIndex !== null && active && (
              <g>
                <line
                  x1={geometry.x(hoverIndex)}
                  x2={geometry.x(hoverIndex)}
                  y1={PAD.top}
                  y2={HEIGHT - PAD.bottom}
                  stroke="var(--viz-axis)"
                  strokeWidth="1"
                />
                <circle
                  cx={geometry.x(hoverIndex)}
                  cy={geometry.y(active.cumulative)}
                  r="5"
                  fill={active.cumulative >= 0 ? "var(--viz-positive)" : "var(--viz-negative)"}
                  stroke="rgb(var(--surface))"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Week ticks, thinned so labels never collide. */}
            {points.map((point, index) => {
              const every = Math.ceil(points.length / 8);
              if (index % every !== 0 && index !== points.length - 1) return null;
              return (
                <text
                  key={point.weekId}
                  x={geometry.x(index)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-ink-faint text-[10px]"
                >
                  W{point.week}
                </text>
              );
            })}
          </svg>

          {hoverIndex !== null && active && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
              style={{
                left: Math.min(Math.max(geometry.x(hoverIndex), 60), width - 60),
                top: 0,
              }}
              role="status"
            >
              <div className="font-medium text-ink">
                {active.season} · Week {active.week}
              </div>
              <div className="tnum text-ink-muted">{formatUsdSigned(active.cumulative)} running</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
