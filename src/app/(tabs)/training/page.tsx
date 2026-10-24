import Link from "next/link";
import { shortDate, weekday } from "@/lib/date";
import { hm } from "@/lib/format";
import { loadTraining } from "@/lib/training";
import { SPORT_COLOR, sportOf } from "@/lib/volume";
import { Forecast, Zones } from "../charts";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module } from "../ui";
import { Volume } from "../Volume";

export default async function TrainingPage() {
  const t = await loadTraining();
  const week = t.year.at(-1)?.sports;
  const hours = week ? Object.values(week).reduce((s, x) => s + x.hours, 0) : 0;
  return (
    <Sky state="go">
      <Hero place="Training" word={hm(hours * 3600).replace(" ", "")} sub="this week">
        <div className="cond">this week</div>
        <div className="hl num">
          Fitness {t.ctl != null ? Math.round(t.ctl) : "–"} <span>·</span> Form{" "}
          {t.tsb != null ? Math.round(t.tsb) : "–"} <span>·</span> Ramp{" "}
          {t.ramp != null ? `${t.ramp > 0 ? "+" : ""}${t.ramp.toFixed(1)}/wk` : "–"}
        </div>
      </Hero>

      <Module title="Fitness & form · 6 months">
        <div className="mod-b">
          <Forecast days={t.fitness} label="Past" />
          <p className="say dim">
            Fitness = 42-day load average, form = fitness − 7-day fatigue (intervals.icu). Ramp is
            the weekly change in fitness; +5 to +8 a week is a common rule of thumb, not a hard
            limit.
          </p>
        </div>
      </Module>

      <Volume weeks={t.year} title="52 weeks" />

      <Module title="Time in zones · 4 weeks">
        <div className="mod-b">
          <Zones secs={t.zones.power} label="Power" />
          <Zones secs={t.zones.hr} label="Heart rate" />
          {!t.zones.power.some(Boolean) && !t.zones.hr.some(Boolean) && (
            <p className="say dim" style={{ marginTop: 0 }}>
              No zone data in the last 4 weeks.
            </p>
          )}
        </div>
      </Module>

      <Module title="Plan · 2 weeks">
        <div className="mod-b">
          {t.plan.length === 0 ? (
            <p className="say dim" style={{ marginTop: 0 }}>
              Nothing planned in intervals.icu for the next 2 weeks.
            </p>
          ) : (
            <ul className="plain">
              {t.plan.map((e) => (
                <li key={e.id}>
                  <b className="num">
                    {weekday(e.start_date_local.slice(0, 10))} {shortDate(e.start_date_local)}
                  </b>{" "}
                  {e.name ?? e.type}
                  {e.icu_training_load ? (
                    <span className="dim"> · load {e.icu_training_load}</span>
                  ) : null}
                  {e.category === "NOTE" && e.description ? (
                    <span className="dim"> · {e.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Module>

      <Module title="Activities">
        <ul className="feed">
          {t.feed.map((a) => (
            <li key={a.id}>
              <Link href={`/training/${a.id}`}>
                <span
                  className="sport"
                  style={{ background: SPORT_COLOR[sportOf(a.type)] }}
                  aria-hidden="true"
                />
                <span className="what">
                  <b>{a.name ?? a.type}</b>
                  <small>
                    {weekday(a.start_date_local.slice(0, 10))} {shortDate(a.start_date_local)} ·{" "}
                    {a.type}
                  </small>
                </span>
                <span className="num figures">
                  {hm(a.moving_time)}
                  <small>
                    {a.distance ? `${(a.distance / 1000).toFixed(1)} km` : ""}
                    {a.icu_training_load ? ` · ${a.icu_training_load}` : ""}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Module>
    </Sky>
  );
}
