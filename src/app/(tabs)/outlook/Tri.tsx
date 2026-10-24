import type { triSplit } from "@/lib/races";
import { Module } from "../ui";

type Split = ReturnType<typeof triSplit>;
type Leg = Split["swim"];

const hmin = (secs: number) => {
  const m = Math.round(secs / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};
/** "24–28 min" under an hour, "1:04–1:09" from there. */
const range = (l: { low: number; high: number }) =>
  l.high < 3600
    ? `${Math.round(l.low / 60)}–${Math.round(l.high / 60)} min`
    : `${hmin(l.low)}–${hmin(l.high)}`;

/** Leg-by-leg estimate for the next triathlon. */
export function Tri({
  name,
  label,
  split,
  swimNote,
}: {
  name: string;
  label: string;
  split: Split;
  swimNote?: string;
}) {
  const [swimM, bikeM, runM] = split.distances;
  const rows: [string, string, Leg][] = [
    ["Swim", `${swimM / 1000} km`, split.swim],
    ["Bike", `${bikeM / 1000} km`, split.bike],
    ["Run", `${runM / 1000} km`, split.run],
    ["Transitions", "T1 + T2", split.transitions],
  ];
  return (
    <Module
      title={label}
      value={split.total ? range(split.total) : "swim missing"}
      info={
        <>
          <p>{name}, on a flat course without drafting.</p>
          {swimNote && <p>Swim: {swimNote}</p>}
          <p>
            Swim: your critical swim speed from your best 200 m and 400 m, plus 4 s per 100 m for
            open water, ±8 %. Bike: physics at 80–88 % of your eFTP in race kit. Run: your race-day
            running potential, 3–8 % slower off the bike (Bonacci 2011). Transitions: 3–6 min.
          </p>
        </>
      }
    >
      <div className="mod-b">
        <ul className="tri">
          {rows.map(([leg, dist, l]) => (
            <li key={leg}>
              <span className="what">
                <b>{leg}</b>
                <small>{dist}</small>
              </span>
              <span className={`num${"problem" in l ? " missing" : ""}`}>
                {"problem" in l ? l.problem : range(l)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Module>
  );
}
