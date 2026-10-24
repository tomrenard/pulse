import type { Badge } from "@/lib/badges";
import { clock as time } from "@/lib/format";
import { loadRecords, WINDOWS } from "@/lib/records";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module } from "../ui";

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
  const r = await loadRecords();
  const pb5k = r.run[0]?.values[0];
  return (
    <Sky state="go">
      <Hero place="Races" word={pb5k ? time(pb5k) : "Records"} sub="5 km best">
        <div className="cond">Your best efforts, then and now</div>
        <div className="hl num">
          FTP {r.ftpSet ?? "–"} W set <span>·</span> {r.ftpModel ?? "–"} W from the last 6 weeks
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
            {r.ftpModel ?? "–"} W is intervals.icu's estimate from your last 6 weeks.
          </p>
        </div>
      </Module>

      <Badges list={r.badges} />

      <p className="say dim" style={{ padding: "0 4px" }}>
        Sources: WMA/USATF 2025 age-grading tables; Coggan power profile; RunRepeat (35M race
        results) and Roadman benchmarks for the percentages, which are approximate.
      </p>

      <Module title="Coming next">
        <ul>
          <li>5 km to marathon estimates from critical speed, next to COROS</li>
          <li>Running and cycling VO₂max, swim CSS</li>
          <li>Long-ride estimate from a GPX route</li>
          <li>A/B/C race countdown, gear</li>
        </ul>
      </Module>
    </Sky>
  );
}
