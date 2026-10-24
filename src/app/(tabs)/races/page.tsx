import type { Badge } from "@/lib/badges";
import { daysBetween } from "@/lib/date";
import { clock as time } from "@/lib/format";
import { criticalSpeed, predictTime, swimCss } from "@/lib/races";
import { loadRaceExtras } from "@/lib/races-load";
import { loadRecords, WINDOWS } from "@/lib/records";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module } from "../ui";
import { LongRide } from "./LongRide";

const daysTo = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 864e5);

function Table({
  rows,
  show,
}: {
  rows: { label: string; values: (number | undefined)[] }[];
  show: (v?: number) => string;
}) {
  return (
    <table className="records num">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr">Effort</span>
          </th>
          {WINDOWS.map(([id, label]) => (
            <th key={id} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            {r.values.map((v, i) => (
              <td key={WINDOWS[i]?.[0]} className={i === 0 ? "pb" : undefined}>
                {show(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Level = Awaited<ReturnType<typeof loadRecords>>["pb"];

function LevelCard({ sport, pb, now }: { sport: "run" | "ride"; pb: Level; now: Level }) {
  const best = pb[sport];
  const current = now[sport];
  if (!best) return null;
  return (
    <section className="mod tile level" aria-label={`${sport} level`}>
      <div className="mod-h">{sport === "run" ? "Running" : "Riding"}</div>
      <div className="mod-b">
        <div className="w">{best.name}</div>
        <div className="say dim">{best.real}</div>
        {best.beats !== undefined && (
          <div className="say">
            Faster than {best.beats} of{" "}
            {sport === "run" ? "male race finishers" : "men 25–34 who train"}
          </div>
        )}
        <div className="say">
          <b>Now:</b>{" "}
          {current ? `${current.name} (${Math.round(current.pct)}%)` : "no recent hard effort"}
        </div>
      </div>
    </section>
  );
}

function Badges({ list }: { list: Badge[] }) {
  return (
    <Module title="Badges">
      <div className="mod-b badges">
        {list.map((b) => (
          <div key={b.title} className={`badge${b.earned ? " earned" : ""}`}>
            <b className="num">{b.value}</b>
            <span>{b.title}</span>
            {b.progress !== undefined && (
              <i className="meter">
                <i style={{ width: `${Math.round(b.progress * 100)}%` }} />
              </i>
            )}
            <small>{b.detail}</small>
          </div>
        ))}
      </div>
    </Module>
  );
}

export default async function RacesPage() {
  const [r, x] = await Promise.all([loadRecords(), loadRaceExtras()]);
  const pb5k = r.run[0]?.values[0];
  const cs = criticalSpeed(x.runPoints);
  const css = swimCss(x.swim200, x.swim400);
  const vo2 = (v?: number) => (v ? Math.round(v) : "–");
  return (
    <Sky state="go">
      <Hero place="Races" word={pb5k ? time(pb5k) : "Records"} sub="5 km best">
        <div className="cond">Your best efforts, then and now</div>
        <div className="hl num">
          FTP {r.ftpSet ?? "–"} W set <span>·</span> {r.ftpModel ?? "–"} W eFTP
        </div>
      </Hero>

      <div className="tiles">
        <LevelCard sport="run" pb={r.pb} now={r.now} />
        <LevelCard sport="ride" pb={r.pb} now={r.now} />
      </div>
      {r.pb.run && r.pb.ride && (
        <Module title="One scale · % of world class">
          <div className="mod-b">
            {(["run", "ride"] as const).map((sp) => {
              const pct = r.pb[sp]?.pct ?? 0;
              return (
                <div key={sp} className="scale">
                  <span>{sp === "run" ? "Run" : "Ride"}</span>
                  <i className="meter">
                    <i
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: sp === "run" ? "var(--go)" : "var(--form)",
                      }}
                    />
                  </i>
                  <b className="num">{Math.round(pct)}%</b>
                </div>
              );
            })}
            <p className="say dim">
              Your best run as an age grade, your best ride as W/kg against Coggan's world-class
              6.4. For running, 60% is local class, 70% regional, 80% national, 90% world class;
              Coggan's riding categories only roughly line up with that.{" "}
              {Math.abs((r.pb.run?.pct ?? 0) - (r.pb.ride?.pct ?? 0)) < 3
                ? "Both sides are about even."
                : (r.pb.run?.pct ?? 0) > (r.pb.ride?.pct ?? 0)
                  ? "Running is your stronger side."
                  : "Riding is your stronger side."}
            </p>
          </div>
        </Module>
      )}

      <Module title="Run · best times">
        <div className="mod-b">
          <Table rows={r.run} show={time} />
          <p className="say dim">
            Fastest stretch of any run at that distance, so a 10 km PB can sit inside a half
            marathon.
          </p>
        </div>
      </Module>

      <Module title="Ride · best power">
        <div className="mod-b">
          <Table rows={r.power} show={(v) => (v ? `${v} W` : "–")} />
          <p className="say dim">
            Power data starts in 2025. FTP {r.ftpSet ?? "–"} W is the value set in intervals.icu;{" "}
            {r.ftpModel ?? "–"} W is intervals.icu's eFTP, its running estimate from recent rides.
          </p>
        </div>
      </Module>

      <Badges list={r.badges} />

      <p className="say dim" style={{ padding: "0 4px" }}>
        Sources: WMA/USATF 2025 age-grading tables; Coggan power profile; RunRepeat (35M race
        results) and Roadman benchmarks for the percentages, which are approximate.
      </p>

      <Module title="Races ahead">
        <div className="mod-b">
          {x.races.length === 0 ? (
            <p className="say dim" style={{ marginTop: 0 }}>
              No race in intervals.icu for the next 12 months. Add one as an A, B or C race.
            </p>
          ) : (
            <ul className="plain">
              {x.races.map((race) => (
                <li key={race.id}>
                  <b className="num">{daysBetween(x.date, race.start_date_local.slice(0, 10))} d</b>{" "}
                  {race.name ?? "Race"}{" "}
                  <span className="dim">· {race.category.replace("RACE_", "")} race</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Module>

      <Module title="VO₂max estimates">
        <div className="mod-b">
          <table className="records num">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr">Sport</span>
                </th>
                <th scope="col">Best</th>
                <th scope="col">6 wk</th>
                <th scope="col">COROS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Running</th>
                <td className="pb">{vo2(r.vo2[0]?.run)}</td>
                <td>{vo2(r.vo2[3]?.run)}</td>
                <td>{vo2(x.coros?.vo2max)}</td>
              </tr>
              <tr>
                <th scope="row">Riding</th>
                <td className="pb">{vo2(r.vo2[0]?.ride)}</td>
                <td>{vo2(r.vo2[3]?.ride)}</td>
                <td>–</td>
              </tr>
            </tbody>
          </table>
          <p className="say dim">
            ml/kg/min. Running: Daniels VDOT from your best effort (5 km to half). Riding: Hawley
            &amp; Noakes from best 5-min power at that day's weight. Both are estimates from
            training bests, typically within 5–10% of a lab test at best.
          </p>
        </div>
      </Module>

      <Module title="Run race estimates">
        <div className="mod-b">
          {"cs" in cs ? (
            <div className="stats num">
              {(
                [
                  [5000, "5 km"],
                  [10000, "10 km"],
                ] as const
              ).map(([d, label]) => {
                const t = predictTime(cs, d);
                return (
                  <span key={label}>
                    <b>
                      {time(t * 0.94)}–{time(t * 1.06)}
                    </b>
                    {label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="say dim" style={{ marginTop: 0 }}>
              {cs.problem}
            </p>
          )}
          {x.coros?.k5 && (
            <p className="say">
              COROS predicts (
              {x.corosAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}) 5 km{" "}
              {time(x.coros.k5)}, 10 km {time(x.coros.k10)}, half {time(x.coros.half)}, marathon{" "}
              {time(x.coros.marathon)}.
            </p>
          )}
          <p className="say dim">
            Ours: critical speed from your hardest 3–15 min efforts of the last 12 weeks, ±6%
            (checked against your own races, where it ran ~2% slow). COROS uses its own model.
          </p>
        </div>
      </Module>

      <Module title="Swim · critical speed">
        <div className="mod-b">
          <p className="say" style={{ marginTop: 0 }}>
            {"problem" in css
              ? css.problem
              : `CSS ${time(css.per100)} /100 m, from your best 200 m (${time(x.swim200)}) and 400 m (${time(x.swim400)}).`}
          </p>
        </div>
      </Module>

      <Module title="Long ride estimate">
        <div className="mod-b">
          <LongRide ftp={r.ftpModel ?? r.ftpSet} kg={r.weight} />
        </div>
      </Module>
    </Sky>
  );
}
