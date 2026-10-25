"use client";

import { useState } from "react";
import { shortDate } from "@/lib/date";

/**
 * A chart's plot that reads out the day under your finger (or the mouse): a cursor and a small
 * label with the date and value. Labels come pre-formatted, so the chart itself stays a server
 * component. `bars` picks the slot under the finger instead of the nearest point.
 */
export function Scrub({
  dates,
  labels,
  bars = false,
  children,
}: {
  dates: string[];
  labels: string[];
  bars?: boolean;
  children: React.ReactNode;
}) {
  const [at, setAt] = useState<number>();
  const n = dates.length;
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setAt(bars ? Math.min(n - 1, Math.floor(f * n)) : Math.round(f * (n - 1)));
  };
  // Cursor in the middle of a bar's slot, or on the point.
  const left = at === undefined ? 0 : bars ? ((at + 0.5) / n) * 100 : (at / (n - 1)) * 100;
  return (
    <div
      className="chart-plot fit-plot"
      onPointerDown={pick}
      onPointerMove={pick}
      // On a phone the value stays after lifting the finger; a mouse leaving clears it.
      onPointerLeave={(e) => e.pointerType === "mouse" && setAt(undefined)}
    >
      {children}
      {at !== undefined && (
        <>
          <i className="fit-cursor" style={{ left: `${left}%` }} />
          <span className="scrub-read num" style={{ left: `${Math.min(80, Math.max(20, left))}%` }}>
            {shortDate(dates[at] ?? "")} · <b>{labels[at]}</b>
          </span>
        </>
      )}
    </div>
  );
}
