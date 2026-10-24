import Link from "next/link";
import { shortDate, today } from "@/lib/date";
import { hm, hmm } from "@/lib/format";
import { loadReview } from "@/lib/review-load";
import { loadTraining } from "@/lib/training";
import { mondayOf, sportOf } from "@/lib/volume";
import { Forecast, Zones } from "../charts";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module, SportChip } from "../ui";
import { Volume } from "../Volume";
import { WeekReview } from "../WeekReview";

export default async function TrainingPage() {
  const [t, review] = await Promise.all([loadTraining(), loadReview(today())]);
  const week = t.year.at(-1)?.sports;
  const hours = week ? Object.values(week).reduce((s, x) => s + x.hours, 0) : 0;
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
          Fitness {t.ctl != null ? Math.round(t.ctl) : "–"} <span>·</span> Form{" "}
          {t.tsb != null ? Math.round(t.tsb) : "–"} <span>·</span> Ramp{" "}
          {t.ramp != null ? `${t.ramp > 0 ? "+" : ""}${t.ramp.toFixed(1)}/wk` : "–"}
        </div>
      </Hero>

      <WeekReview r={review} />

      <Module
        title="Fitness & form · 6 months"
        info={
          <>
            <p>
              Fitness is your 42-day load average; form is fitness minus 7-day fatigue
              (intervals.icu).
            </p>
            <p>
              Ramp is the weekly change in fitness. +5 to +8 a week is a common rule of thumb, not a
              hard limit.
            </p>
          </>
        }
      >
        <div className="mod-b">
          <Forecast days={t.fitness} label="Past" />
        </div>
      </Module>

      <Volume weeks={t.year} title="52 weeks" compact />

      {(t.zones.power.some(Boolean) || t.zones.hr.some(Boolean)) && (
        <Module
          title="Zones · 4 weeks"
          info={
            <>
              <p>
                Share of riding time in each power zone, and of all training in each heart-rate
                zone, over 4 weeks.
              </p>
              <p>
                Power:{" "}
                {t.zones.power.map((s, i) => `Z${i + 1} ${hm(s).replace(" ", "")}`).join(" · ")}
              </p>
            </>
          }
        >
          <div className="mod-b">
            <Zones secs={t.zones.power} label="Power" />
            <Zones secs={t.zones.hr} label="Heart rate" />
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
