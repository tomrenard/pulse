import { hmm } from "@/lib/format";
import type { triSplit } from "@/lib/races";

type Split = ReturnType<typeof triSplit>;
type Leg = Split["swim"];

/** Midpoint of a range: the one time shown big. */
const mid = (l: { low: number; high: number }) => (l.low + l.high) / 2;

/** "24–28 min" under an hour, "1h04–1h09" from there. */
const range = (l: { low: number; high: number }) =>
  l.high < 3600
    ? `${Math.round(l.low / 60)}–${Math.round(l.high / 60)} min`
    : `${hmm(l.low)}–${hmm(l.high)}`;

/** One row per triathlon: finish time, tap for the legs. */

/** 21.0975 → 21.1: one decimal at most. */
const km = (m: number) => Math.round(m / 100) / 10;
export function Tri({ races }: { races: { name: string; split: Split }[] }) {
  return (
    <ul className="est">
      {races.map(({ name, split }) => {
        const [swimM, bikeM, runM] = split.distances;
        const legs: [string, string, Leg][] = [
          ["Swim", `${km(swimM)} km`, split.swim],
          ["Bike", `${km(bikeM)} km`, split.bike],
          ["Run", `${km(runM)} km`, split.run],
          ["Transitions", "T1 + T2", split.transitions],
        ];
        const t = split.total;
        return (
          <li key={name}>
            <details>
              <summary>
                <span className="what">
                  <b>{name}</b>
                  <small>
                    {km(swimM)} · {km(bikeM)} · {km(runM)} km
                  </small>
                </span>
                {t ? (
                  <span className="est-v num">
                    <b>
                      {hmm(mid(t))}
                      {t.swim ? "" : " + swim"}
                    </b>
                    <small>{range(t)}</small>
                  </span>
                ) : (
                  <span className="est-v missing">needs data</span>
                )}
              </summary>
              <ul className="est-legs">
                {legs.map(([leg, dist, l]) => (
                  <li key={leg}>
                    <span>
                      {leg} <small>{dist}</small>
                    </span>
                    <span className={`num${"problem" in l ? " missing" : ""}`}>
                      {"problem" in l ? l.problem : range(l)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
