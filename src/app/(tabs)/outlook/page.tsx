import { addDays, weekday } from "@/lib/date";
import { formPct, formTarget, projectFitness } from "@/lib/outlook";
import { loadOutlook } from "@/lib/outlook-load";
import { Forecast } from "../charts";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module } from "../ui";
import { WhatIf } from "./WhatIf";

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export default async function OutlookPage() {
  const o = await loadOutlook();
  const raceDate = o.race?.start_date_local.slice(0, 10);
  const end = raceDate ?? addDays(o.date, 56);
  const horizon = daysBetween(o.date, end);
  const loads = Array.from({ length: horizon }, (_, i) =>
    o.workouts
      .filter((w) => w.start_date_local.startsWith(addDays(o.date, i + 1)))
      .reduce((s, w) => s + (w.icu_training_load ?? 0), 0),
  );
  const plan = projectFitness(o.date, o.ctl, o.atl, loads);
  const raceDay = raceDate ? plan.find((d) => d.date === raceDate) : undefined;
  const target = formTarget(o.race?.moving_time);
  const raceForm = raceDay ? formPct(raceDay) : undefined;
  const plannedWeeks = o.workouts.length / Math.max(1, horizon / 7);
  const thin = plannedWeeks < 2;
  const word = raceDate ? `${horizon} days` : "No race";

  return (
    <Sky state="go">
      <Hero place="Outlook" word={word} sub={o.race?.name ?? "Add a race in intervals.icu"}>
        <div className="cond">
          {o.race
            ? `to ${o.race.name ?? "your race"} · ${weekday(raceDate as string)} ${raceDate?.slice(5)}`
            : "No A, B or C race in the next 120 days"}
        </div>
        <div className="hl num">
          Fitness {Math.round(o.ctl)} <span>·</span> Form {Math.round(o.ctl - o.atl)}
        </div>
      </Hero>

      <Module title={o.race ? "Your plan to race day" : "Your plan · next 8 weeks"}>
        <div className="mod-b">
          {o.workouts.length === 0 ? (
            <p className="say dim" style={{ marginTop: 0 }}>
              Nothing planned in intervals.icu yet. Use the what-if below, or add workouts.
            </p>
          ) : (
            <>
              <Forecast days={plan} race={raceDate} />
              {raceForm !== undefined && (
                <p className="say">
                  Race-day form {Math.round(raceForm)}% (fitness {Math.round(raceDay?.ctl ?? 0)}).
                  Target {target.low} to +{target.high}%: {target.why}.{" "}
                  {raceForm < target.low
                    ? "Lighten the final week."
                    : raceForm > target.high
                      ? "You'd arrive flat: keep some load in the final week."
                      : "On target."}
                </p>
              )}
              <p className="say dim">
                If you do exactly what's planned; unplanned days count as rest.
                {thin ? " The plan is thin (under 2 workouts a week), so this runs low." : ""}
              </p>
            </>
          )}
        </div>
      </Module>

      <Module title="What if">
        <div className="mod-b">
          <WhatIf
            date={o.date}
            ctl={o.ctl}
            atl={o.atl}
            rideCtl={o.rideCtl}
            rideRate={o.rideRate}
            runRate={o.runRate}
            fit={
              o.power && {
                a: o.power.a,
                b: o.power.b,
                p80: o.power.p80,
                minCtl: o.power.minCtl,
                maxCtl: o.power.maxCtl,
              }
            }
          />
        </div>
      </Module>

      <Module title="20-min power vs ride fitness">
        <div className="mod-b">
          {o.power ? (
            <>
              <div className="stats num">
                <span>
                  <b>{Math.round(o.recentBest20)} W</b>best, last 6 weeks
                </span>
                <span>
                  <b>{Math.round(o.power.at(o.rideCtl))} W</b>typical at ride fitness{" "}
                  {Math.round(o.rideCtl)}
                </span>
              </div>
              <p className="say dim">
                From {o.power.n} weekly windows since 2025: +{o.power.b.toFixed(1)} W per point of
                ride fitness, ±{Math.round(o.power.p80 * 100)}% for 8 of 10 weeks. These are
                training bests, not tests; a real 20-min effort or race would sharpen it. Not your
                FTP.
              </p>
            </>
          ) : (
            <p className="say dim" style={{ marginTop: 0 }}>
              Needs 8 weeks of rides with power to relate your power to fitness.
            </p>
          )}
        </div>
      </Module>

      <Module title="Recovery response">
        <div className="mod-b">
          <p className="say dim" style={{ marginTop: 0 }}>
            Building. How your HRV and resting HR react to big days needs about 8 weeks of COROS
            nights; the first ones came on 1 Oct.
          </p>
        </div>
      </Module>
    </Sky>
  );
}
