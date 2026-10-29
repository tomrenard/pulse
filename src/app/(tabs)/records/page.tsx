import type { Badge } from "@/lib/badges";
import { addDays, monthYear, shortDate } from "@/lib/date";
import { clock } from "@/lib/format";
import { type Grade, rideGrade, runGrade } from "@/lib/level";
import { loadOutlook } from "@/lib/outlook-load";
import { freshTime } from "@/lib/potential";
import { latestBests, loadRecords } from "@/lib/records";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Glyph, Module } from "../ui";

type Records = Awaited<ReturnType<typeof loadRecords>>;
type Now = { run?: Grade; ride?: Grade };

/**
 * Run and ride on one "% of world class" bar each: the fill is your PB level, the marker where the
 * models put you now (run: VO2max from heart rate; ride: eFTP), not raw recent efforts, which are
 * rarely all-out.
 */
function Level({ r, now }: { r: Records; now: Now }) {
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
          <p>
            The name and fill: your PB level. The white marker and “now”: what you could do today,
            from your run VO₂max and your eFTP (Outlook's estimates).
          </p>
        </>
      }
    >
      <div className="mod-b levels">
        {rows.map(([key, label, color]) => {
          const best = r.pb[key];
          const today = now[key];
          if (!best) return null;
          return (
            <div key={key} className="level-row">
              <div className="level-top">
                <span>{label}</span>
                <b>{best.name}</b>
                <span className="num">
                  {Math.round(best.pct)}%
                  {today ? <small> · now {Math.round(today.pct)}%</small> : null}
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
                {today && <i className="now" style={{ left: `${Math.min(100, today.pct)}%` }} />}
              </div>
              {today && today.name !== best.name && (
                <small className="level-now">Now: {today.name}</small>
              )}
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

/** TrainingPeaks-style: what you set lately, a star for an all-time PB, a medal for a 12-month best. */
function Latest({ r, date }: { r: Records; date: string }) {
  const list = latestBests(
    [
      ...r.run.map((x) => ({ ...x, kind: "run" as const })),
      ...r.power.map((x) => ({ ...x, kind: "ride" as const })),
    ],
    addDays(date, -365),
  );
  if (!list.length) return null;
  return (
    <Module
      title="Latest bests"
      info={
        <p>
          Your best of the last 12 months for each distance and duration, newest first. ★ also an
          all-time PB, ● a 12-month best.
        </p>
      }
    >
      <ul className="why bests">
        {list.map((b) => (
          <li key={`${b.kind}${b.label}`}>
            <span>
              <i className={b.pb ? "star" : "medal"} aria-hidden="true">
                {b.pb ? "★" : "●"}
              </i>{" "}
              {b.kind === "run" ? "Run" : "Ride"} {b.label}
              <span className="sr">{b.pb ? ", all-time PB" : ", 12-month best"}</span>
            </span>
            <span className="num">{b.kind === "run" ? clock(b.value) : `${b.value} W`}</span>
            <span className="num dim">{shortDate(b.date)}</span>
          </li>
        ))}
      </ul>
    </Module>
  );
}

/** Power curve: all time, 12 months, 6 weeks, on a log time axis (5 s to 1 h), intervals.icu-style. */
function PowerCurve({ curves }: { curves: Records["curves"] }) {
  const lines = [
    ["all", "All time", "rgba(255,255,255,.55)"],
    ["year", "12 months", "var(--form)"],
    ["weeks", "6 weeks", "var(--go)"],
  ] as const;
  const top = Math.max(1, ...curves.all.map((p) => p.watts)) * 1.05;
  const x = (secs: number) =>
    ((Math.log(secs) - Math.log(5)) / (Math.log(3600) - Math.log(5))) * 300;
  const y = (w: number) => 100 - (w / top) * 100;
  if (curves.all.length < 2) return null;
  return (
    <figure className="pcurve">
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Power curve">
        {[60, 300, 1200, 3600].map((s) => (
          <line key={s} x1={x(s)} x2={x(s)} y1={0} y2={100} className="chart-grid" />
        ))}
        {lines.map(([key, , color]) =>
          curves[key].length > 1 ? (
            <path
              key={key}
              d={curves[key]
                .map((p, i) => `${i ? "L" : "M"}${x(p.secs).toFixed(1)} ${y(p.watts).toFixed(1)}`)
                .join("")}
              fill="none"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
      </svg>
      <div className="pcurve-x" aria-hidden="true">
        {[
          [5, "5 s"],
          [60, "1 min"],
          [300, "5 min"],
          [1200, "20 min"],
          [3600, "1 h"],
        ].map(([s, t]) => (
          <span key={t} style={{ left: `${(x(s as number) / 300) * 100}%` }}>
            {t}
          </span>
        ))}
      </div>
      <figcaption className="week-legend">
        {lines.map(([key, name, color]) => (
          <span key={key}>
            <i style={{ background: color }} />
            {name}
          </span>
        ))}
      </figcaption>
    </figure>
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
      <small>
        {b.title}
        {b.date && <i className="badge-date">{monthYear(b.date)}</i>}
      </small>
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

export default async function RecordsPage() {
  const [r, o] = await Promise.all([loadRecords(), loadOutlook()]);
  const five = r.run[0];
  const v = o.potential.now;
  // What you could run fresh today, per distance: Outlook's estimate.
  const est = r.run.map((x) => (v ? freshTime(v, x.distance, o.potential.volume) : undefined));
  const now: Now = {
    run: runGrade(r.run.map((x, i) => ({ distance: x.distance, secs: est[i] }))),
    ride: o.ftp && o.kg ? rideGrade(o.ftp / o.kg) : undefined,
  };
  // No hard run lately: the 6-week best 5 km is over 10 % slower than the estimate.
  const recent5k = five?.values[2];
  const stale = est[0] !== undefined && (!recent5k || recent5k > est[0] * 1.1);
  return (
    <Sky state="go">
      <Hero
        place="Records"
        word={five?.values[0] ? clock(five.values[0]) : "–"}
        sub={`5 km PB${five?.dates[0] ? ` · ${monthYear(five.dates[0])}` : ""}`}
      />

      <Level r={r} now={now} />

      <Latest r={r} date={o.date} />

      <Module
        title="Running"
        info={
          <>
            <p>
              Fastest stretch of any run at that distance (intervals.icu best efforts), so a 10 km
              PB can sit inside a half marathon. 12 mo: your best of the last 12 months.
            </p>
            <p>
              Now: what you could run fresh today, estimated from your heart rate on recent runs
              (Outlook's running estimate, ±5 %). An estimate, not a result.
            </p>
          </>
        }
      >
        <div className="mod-b">
          <table className="rtable num">
            <thead>
              <tr>
                <th />
                <th>PB</th>
                <th>12 mo</th>
                <th>Now ≈</th>
              </tr>
            </thead>
            <tbody>
              {r.run.map((x, i) => (
                <tr key={x.label}>
                  <th>{x.label}</th>
                  <td>
                    {x.values[0] ? clock(x.values[0]) : "–"}
                    {x.dates[0] && <small>{monthYear(x.dates[0])}</small>}
                  </td>
                  <td>{x.values[1] ? clock(x.values[1]) : "–"}</td>
                  <td>{est[i] ? clock(est[i] as number) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stale && <p className="mod-line">No hard run in 6 weeks: "now" comes from easy runs.</p>}
        </div>
      </Module>

      <Module
        title="Riding"
        info={
          <p>
            Best average power for each duration (power data starts in 2025): all time, last 12
            months and last 6 weeks. Lines close together mean you're near your best; a gap at short
            durations usually means no hard efforts lately rather than lost fitness.
          </p>
        }
      >
        <div className="mod-b">
          <PowerCurve curves={r.curves} />
          <table className="rtable num">
            <thead>
              <tr>
                <th />
                <th>PB</th>
                <th>12 mo</th>
                <th>6 wk</th>
              </tr>
            </thead>
            <tbody>
              {r.power.map((x) => (
                <tr key={x.label}>
                  <th>{x.label}</th>
                  <td>
                    {x.values[0] ?? "–"}
                    {x.dates[0] && <small>{monthYear(x.dates[0])}</small>}
                  </td>
                  <td>{x.values[1] ?? "–"}</td>
                  <td>{x.values[2] ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Module>

      <Badges list={r.badges} />
    </Sky>
  );
}
