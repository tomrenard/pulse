import type { Badge } from "@/lib/badges";
import { clock as time } from "@/lib/format";
import { swimCss } from "@/lib/races";
import { loadSwim } from "@/lib/races-load";
import { loadRecords } from "@/lib/records";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Glyph, Module } from "../ui";
import { LongRide } from "./LongRide";
import { RecordBars } from "./RecordBars";

type Records = Awaited<ReturnType<typeof loadRecords>>;

/** Run and ride on one "% of world class" bar each, with the class marks and PB vs now. */
function Level({ r }: { r: Records }) {
  const rows = [
    ["run", "Run", "var(--go)"],
    ["ride", "Ride", "var(--form)"],
  ] as const;
  return (
    <Module
      title="Your level"
      info={
        <>
          <p>
            Run: your best performance as an age grade (WMA/USATF 2025 tables). Ride: your FTP in
            W/kg against Coggan's world-class 6.4 W/kg. For running, 60 % is local class, 70 %
            regional, 80 % national, 90 % world class; Coggan's riding categories line up roughly.
          </p>
          {r.pb.run && (
            <p>
              Run: {r.pb.run.real}. Faster than {r.pb.run.beats ?? "–"} of male race finishers
              (RunRepeat, approximate).
            </p>
          )}
          {r.pb.ride && (
            <p>
              Ride: {r.pb.ride.real}. Above {r.pb.ride.beats} of men 25–34 who train (Roadman,
              approximate).
            </p>
          )}
          <p>The white marker is where you are now (best of the last 6 weeks).</p>
        </>
      }
    >
      <div className="mod-b levels">
        {rows.map(([key, label, color]) => {
          const best = r.pb[key];
          const now = r.now[key];
          if (!best) return null;
          return (
            <div key={key} className="level-row">
              <div className="level-top">
                <span>{label}</span>
                <b>{best.name}</b>
                <span className="num">
                  {Math.round(best.pct)}%{now ? <small> · now {Math.round(now.pct)}%</small> : null}
                </span>
              </div>
              <div className="level-bar" aria-hidden="true">
                {[60, 70, 80, 90].map((m) => (
                  <i key={m} className="tick" style={{ left: `${m}%` }} />
                ))}
                <i
                  className="fill"
                  style={{ width: `${Math.min(100, best.pct)}%`, background: color }}
                />
                {now && <i className="now" style={{ left: `${Math.min(100, now.pct)}%` }} />}
              </div>
            </div>
          );
        })}
        <div className="level-scale" aria-hidden="true">
          <span style={{ left: "60%" }}>Local</span>
          <span style={{ left: "70%" }}>Reg.</span>
          <span style={{ left: "80%" }}>Nat.</span>
          <span style={{ left: "90%" }}>World</span>
        </div>
      </div>
    </Module>
  );
}

const BADGE_GLYPH: Record<string, React.ReactNode> = {
  "Longest ride": <path d="M3 17h4l3-8 4 6 3-4h4" />,
  "Biggest week": <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  Centuries: <path d="M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0M12 8v4l3 2" />,
  "Around the world": (
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18" />
  ),
  "Week streak": <path d="M12 3c2 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 4 3" />,
  "Brick days": <path d="M4 7h16v10H4zM4 12h16M12 7v5M8 12v5M16 12v5" />,
};
// Everest and anything new: a peak.
const glyphFor = (title: string) => BADGE_GLYPH[title] ?? <path d="M2 20 9 7l4 6 3-4 6 11z" />;

/** Compact icon grid: value under each icon, a progress ring when not earned yet. */
function Badges({ list }: { list: Badge[] }) {
  const cell = (b: Badge) => (
    <div
      key={b.title}
      className={`badge-cell${b.earned ? " earned" : ""}`}
      title={`${b.title}: ${b.detail}`}
    >
      <span
        className="badge-icon"
        style={
          b.progress !== undefined && !b.earned
            ? ({ "--p": b.progress } as React.CSSProperties)
            : undefined
        }
      >
        <Glyph>{glyphFor(b.title)}</Glyph>
      </span>
      <b className="num">{b.value}</b>
      <small>{b.title}</small>
      <span className="sr">
        {b.earned
          ? "earned"
          : b.progress !== undefined
            ? `${Math.round(b.progress * 100)} % there`
            : "not yet"}
      </span>
    </div>
  );
  return (
    <Module
      title="Badges"
      info={list.map((b) => (
        <p key={b.title}>
          {b.title}: {b.value}, {b.detail}.
        </p>
      ))}
    >
      <div className="mod-b">
        <div className="badge-grid">{list.slice(0, 4).map(cell)}</div>
        {list.length > 4 && (
          <details className="more">
            <summary>See all {list.length}</summary>
            <div className="badge-grid">{list.slice(4).map(cell)}</div>
          </details>
        )}
      </div>
    </Module>
  );
}

export default async function RacesPage() {
  const [r, x] = await Promise.all([loadRecords(), loadSwim()]);
  const pb5k = r.run[0]?.values[0];
  const css = swimCss(x.swim200, x.swim400);
  const vo2 = (v?: number) => (v ? Math.round(v) : "–");
  return (
    <Sky state="go">
      <Hero place="Races" word={pb5k ? time(pb5k) : "Records"} sub="5 km PB">
        <div className="hl num">
          FTP {r.ftpSet ?? "–"} W <span>· eFTP {r.ftpModel ?? "–"} W</span>
        </div>
      </Hero>

      <Level r={r} />

      <Module
        title="Run · PB vs now"
        info={
          <p>
            Fastest stretch of any run at that distance (intervals.icu best efforts), so a 10 km PB
            can sit inside a half marathon. The filled bar is your best in the chosen window as a
            share of PB speed.
          </p>
        }
      >
        <div className="mod-b">
          <RecordBars rows={r.run} kind="time" color="var(--go)" />
        </div>
      </Module>

      <Module
        title="Ride · PB vs now"
        value={`VO₂max ${vo2(r.vo2[0]?.ride)}`}
        info={
          <>
            <p>
              Best average power for each duration (power data starts in 2025). The filled bar is
              your best in the chosen window as a share of the PB.
            </p>
            <p>
              FTP {r.ftpSet ?? "–"} W is the value set in intervals.icu; eFTP {r.ftpModel ?? "–"} W
              is intervals.icu's running estimate from recent rides.
            </p>
            <p>
              Ride VO₂max: Hawley &amp; Noakes from best 5-min power at that day's weight (
              {vo2(r.vo2[3]?.ride)} over the last 6 weeks).
            </p>
          </>
        }
      >
        <div className="mod-b">
          <RecordBars rows={r.power} kind="watts" color="var(--form)" />
        </div>
      </Module>

      <Badges list={r.badges} />

      <details className="mod tools">
        <summary className="mod-h">
          <span>Tools</span>
        </summary>
        <div className="mod-b">
          <h3 className="tool-h">Long ride estimate</h3>
          <LongRide ftp={r.ftpModel ?? r.ftpSet} kg={r.weight} />
          <h3 className="tool-h">Swim critical speed</h3>
          <p className="caption">
            {"problem" in css ? css.problem : `CSS ${time(css.per100)} /100 m`}
          </p>
        </div>
      </details>
    </Sky>
  );
}
