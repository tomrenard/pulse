import Link from "next/link";
import { addDays, shortDate, today } from "@/lib/date";
import { hm, hmm } from "@/lib/format";
import { intensityMix, intensityTrend, WEEK_ZONES, weekLoads } from "@/lib/load";
import { loadReview } from "@/lib/review-load";
import { loadTraining } from "@/lib/training";
import { mondayOf, sportOf } from "@/lib/volume";
import { Zones } from "../charts";
import { FitnessChart } from "../FitnessChart";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module, SportChip } from "../ui";
import { Volume } from "../Volume";
import { WeekReview } from "../WeekReview";

export default async function TrainingPage() {
  const [t, review] = await Promise.all([loadTraining(), loadReview(today())]);
  const week = t.year.at(-1)?.sports;
  const hours = week ? Object.values(week).reduce((s, x) => s + x.hours, 0) : 0;
  const ctlBy = new Map(t.fitness.map((d) => [d.date, d.ctl]));
  const loads = weekLoads(
    t.year.slice(-12).map((w) => ({
      monday: w.monday,
      load: Math.round(Object.values(w.sports).reduce((s, x) => s + x.load, 0)),
    })),
    // The fitness a week starts from: Sunday's, before Monday's training.
    (monday) => ctlBy.get(addDays(monday, -1)),
  );
  const loadTop = Math.max(...loads.map((w) => Math.max(w.load, w.usual ?? 0)), 1);
  const mix = intensityMix(t.zones.hr);
  // The same words as Today: COROS's load trend, not intervals.icu's form zones.
  const trend = intensityTrend(t.ctl, t.atl);
  // Last 3 weeks of activities, grouped Monday to Sunday; older ones behind "Show more".
  const weeks = new Map<string, typeof t.feed>();
  for (const a of t.feed) {
    const m = mondayOf(a.start_date_local.slice(0, 10));
    weeks.set(m, [...(weeks.get(m) ?? []), a]);
  }
  const groups = [...weeks.entries()];
  const row = (a: (typeof t.feed)[number]) => {
    const sport = sportOf(a.type);
    return (
      <li key={a.id}>
        <Link href={`/training/${a.id}`}>
          <SportChip sport={sport} />
          <span className="what">
            <b>{a.name ?? a.type}</b>
            <small>{shortDate(a.start_date_local)}</small>
          </span>
          <span className="num figures">
            {a.moving_time ? hmm(a.moving_time) : "–"}
            <small>{a.distance ? `${(a.distance / 1000).toFixed(1)} km` : ""}</small>
          </span>
        </Link>
      </li>
    );
  };
  const group = ([monday, list]: [string, typeof t.feed]) => (
    <li key={monday} className="week">
      <div className="week-h">
        Week of {shortDate(monday)}
        <span className="num">{hmm(list.reduce((s, a) => s + (a.moving_time ?? 0), 0))}</span>
      </div>
      <ul className="feed">{list.map(row)}</ul>
    </li>
  );
  return (
    <Sky state="go">
      <Hero
        place="Training"
        word={hm(hours * 3600)
          .replace(" ", "")
          .replace("m", "")}
        sub="this week"
      >
        <div className="hl num">
          Fitness {t.ctl != null ? Math.round(t.ctl) : "–"}
          {t.ramp != null && ` ${t.ramp > 0 ? "▲" : "▼"}${Math.abs(t.ramp).toFixed(1)}/wk`}
          {trend && (
            <>
              {" "}
              <span>·</span> {trend.zone} load
            </>
          )}
        </div>
      </Hero>

      <WeekReview r={review} />

      <Module
        title="Fitness & form · 6 months"
        info={
          <>
            <p>
              Fitness is your 42-day load average, fatigue your 7-day one; form is fitness minus
              fatigue (intervals.icu), also shown as a % of fitness. The zones are COROS's load
              trend, the same words as Today: Optimized 0 to −50 % (building), Excessive below −50
              %, Maintaining 0 to +20 %, Performance +20 to +50 % (a deep taper or a break).
              Outlook's race-day targets (0 to +20 %) sit in Maintaining: fresh, fitness kept.
            </p>
            <p>
              Ramp is the weekly change in fitness. +5 to +8 a week is a common rule of thumb, not a
              hard limit.
            </p>
          </>
        }
      >
        <div className="mod-b">
          <FitnessChart days={t.fitness} />
        </div>
      </Module>

      <Module
        title="Load · 12 weeks"
        info={
          <p>
            Each week's training load, coloured by what it did to your fitness against a usual week
            (7 × the fitness you started it with, the white tick): under 0.8× lose, 0.8–1× keep,
            1–1.5× build safely, above 1.5× overreach. This week is still filling up.
          </p>
        }
      >
        <div className="mod-b">
          <div className="load-weeks" role="img" aria-label="Weekly load, last 12 weeks">
            {loads.map((w, i) => {
              const z = w.zone ? WEEK_ZONES.indexOf(w.zone) : -1;
              return (
                <span key={w.monday} className={i === loads.length - 1 ? "now" : undefined}>
                  <i
                    className={z >= 0 ? `wz${z}` : undefined}
                    style={{ height: `${(w.load / loadTop) * 100}%` }}
                  />
                  {w.usual && <b style={{ bottom: `${(w.usual / loadTop) * 100}%` }} />}
                </span>
              );
            })}
          </div>
          <div className="week-legend">
            {WEEK_ZONES.map((z, i) => (
              <span key={z.label}>
                <i className={`wz${i}`} />
                {z.short}
              </span>
            ))}
          </div>
        </div>
      </Module>

      <Volume weeks={t.year} title="52 weeks" compact />

      {(mix || t.zones.power.some(Boolean)) && (
        <Module
          title="Intensity · 4 weeks"
          info={
            <>
              <p>
                Heart-rate time over 4 weeks, all sports: easy is Z1–2, moderate Z3, hard Z4 and up.
                Endurance training works best mostly easy with a little hard (about 80/20, Seiler).
              </p>
              <p>
                Heart rate:{" "}
                {t.zones.hr.map((s, i) => `Z${i + 1} ${hm(s).replace(" ", "")}`).join(" · ")}
              </p>
              <p>
                Power (rides):{" "}
                {t.zones.power.map((s, i) => `Z${i + 1} ${hm(s).replace(" ", "")}`).join(" · ")}
              </p>
            </>
          }
        >
          <div className="mod-b">
            {mix && (
              <>
                <Zones
                  secs={[mix.easy, mix.moderate, mix.hard]}
                  names={["Easy", "Mod", "Hard"]}
                  colors={["var(--go)", "var(--mid)", "var(--stop)"]}
                />
                <p className="mod-line">
                  <span className={`signal-word ${mix.tone}`}>{mix.text}</span>
                </p>
              </>
            )}
            <Zones secs={t.zones.power} label="Power, rides" />
          </div>
        </Module>
      )}

      <Module title="Activities">
        <ul className="weeks">{groups.slice(0, 3).map(group)}</ul>
        {groups.length > 3 && (
          <details className="more">
            <summary>Show more</summary>
            <ul className="weeks">{groups.slice(3).map(group)}</ul>
          </details>
        )}
      </Module>
    </Sky>
  );
}
