/** Durations for display. Round to the smallest unit first, then split, so 3599 s is "1h00". */
const pad = (n: number) => String(n).padStart(2, "0");

/** "8h 05m" style; "–" for nothing. */
export const hm = (secs?: number | null) => {
  if (!secs) return "–";
  const m = Math.round(secs / 60);
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};

/** "+3" / "−4 %" style: a signed whole number, "–" when missing. */
export const signed = (v?: number, unit = "") =>
  v === undefined ? "–" : `${v > 0 ? "+" : ""}${Math.round(v)}${unit}`;

/** "4h05" compact style. */
export const hmm = (secs: number) => {
  const m = Math.round(secs / 60);
  return `${Math.floor(m / 60)}h${pad(m % 60)}`;
};

/** Race clock: "18:22" or "1:21:55". */
export const clock = (secs?: number) => {
  if (!secs) return "–";
  const s = Math.round(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};
