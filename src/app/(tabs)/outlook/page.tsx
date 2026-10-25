import { addDays, daysBetween, shortDate } from "@/lib/date";
import { hmm, signed } from "@/lib/format";
import { formPct, formTarget, powerAt, projectFitness } from "@/lib/outlook";
import { loadOutlook } from "@/lib/outlook-load";
import { raceDayVdot, timeAt } from "@/lib/potential";
import { swimCss, triLegs, triSplit } from "@/lib/races";
import { loadCoros, loadSwim } from "@/lib/races-load";
import { MIN_EVENTS, type recoveryResponse, SOLID_NIGHTS } from "@/lib/recovery";
import { SPORT_COLOR, sportOf } from "@/lib/volume";
import { Scatter } from "../charts";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module } from "../ui";
import { Potential } from "./Potential";
import { Tri } from "./Tri";
import { WhatIf } from "./WhatIf";

const PRIORITY: Record<string, string> = { RACE_A: "A", RACE_B: "B", RACE_C: "C" };
const SPORT_TINT = { ...SPORT_COLOR, tri: SPORT_COLOR.swim };

/** Your HRV after big days: learning ring until 5 big days, then the dip night by night. */
function Recovery({ r }: { r: ReturnType<typeof recoveryResponse> }) {
  const ready = r.events >= MIN_EVENTS && r.nights !== undefined;
  const nights = (n: number) => (n > r.profile.length ? `${r.profile.length}+` : String(n));
  return (
    <Module
      title="Recovery response"
      value={ready ? `≈ ${nights(r.nights as number)} nights` : `${r.events} of ${MIN_EVENTS}`}
      info={
        <p>
          Big days are your top 10 % by training load ({r.bigLoad ? Math.round(r.bigLoad) : "–"}+),
          with no other big day within 3 days either side. Each night after is compared with your
          7-night HRV before; recovered means back within your normal spread. Learnt from {r.events}{" "}
          big days and {r.hrvNights} nights of HRV; an early read until {SOLID_NIGHTS} nights.
        </p>
      }
    >
      <div className="mod-b">
        {ready ? (
          <>
            <div className="stats num">
              {r.profile.map((p, k) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed nights 1–4 after
                <span key={k}>
                  <b>{signed(p, " %")}</b>
                  night {k + 1}
                </span>
              ))}
            </div>
            <div className="caption">
              HRV after a big day, against the week before
              {r.hrvNights < SOLID_NIGHTS ? " · early read" : ""}
            </div>
          </>
        ) : (
          <div className="recovery">
            <span
              className="ring"
              style={{ "--p": Math.min(1, r.events / MIN_EVENTS) } as React.CSSProperties}
            />
            <span className="caption">Learning how your HRV reacts to big days</span>
          </div>
        )}
      </div>
    </Module>
  );
}

export default async function OutlookPage() {
  const [o, coros, pool] = await Promise.all([loadOutlook(), loadCoros(), loadSwim()]);
  const next = o.races[0];
  const runRace = o.races.find((r) => r.info.sport === "run" && r.info.metres);
  const known = o.ctl !== undefined && o.atl !== undefined;

  // Planned hours per week for the next 8 weeks, by sport.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(o.date, i * 7 + 1);
    const to = addDays(from, 6);
    const ws = o.workouts.filter((w) => {
      const d = w.start_date_local.slice(0, 10);
      return d >= from && d <= to;
    });
    return {
      from,
      hours: ws.map((w) => ({ id: w.id, sport: sportOf(w.type), h: (w.moving_time ?? 0) / 3600 })),
    };
  });
  const planned = weeks.some((w) => w.hours.length);
  const maxH = Math.max(1, ...weeks.map((w) => w.hours.reduce((s, h) => s + h.h, 0)));

  // Race-day form from the plan, for the next race, when there is a plan.
  const raceDate = next?.start_date_local.slice(0, 10);
  const horizon = raceDate ? daysBetween(o.date, raceDate) : 0;
  const loads = Array.from({ length: horizon }, (_, i) =>
    o.workouts
      .filter((w) => w.start_date_local.startsWith(addDays(o.date, i + 1)))
      .reduce((s, w) => s + (w.icu_training_load ?? 0), 0),
  );
  // Only when the plan runs into race week and every session has a load: otherwise the
  // projection reads missing days as rest and race-day form comes out absurdly fresh.
  const upToRace = raceDate
    ? o.workouts.filter((w) => w.start_date_local.slice(0, 10) <= raceDate)
    : [];
  const covered =
    raceDate !== undefined &&
    upToRace.some((w) => w.start_date_local.slice(0, 10) >= addDays(raceDate, -7)) &&
    upToRace.every((w) => w.icu_training_load != null);
  const plan =
    known && covered && raceDate
      ? projectFitness(o.date, o.ctl as number, o.atl as number, loads)
      : [];
  const raceDay = plan.find((d) => d.date === raceDate);
  const target = next ? formTarget({ ...next, distance: next.info.metres }) : undefined;
  // Next triathlon: legs from swim CSS, eFTP and race-day running potential at today's volume.
  const tri = o.races.find((r) => r.info.sport === "tri");
  const css = swimCss(pool.swim200, pool.swim400);
  const triSplitNow =
    tri &&
    (() => {
      const weeks = daysBetween(o.date, tri.start_date_local.slice(0, 10)) / 7;
      const { now, anchor, weeklyKm } = o.potential;
      const v = now && anchor ? raceDayVdot(now, weeklyKm, anchor, weeks) : now;
      const runM = triLegs(tri.info.label)[2];
      return triSplit(tri.info.label, {
        swimPer100: "per100" in css ? css.per100 : undefined,
        ftp: o.ftp,
        kg: o.kg,
        runSecs: v ? timeAt(v, runM) : undefined,
      });
    })();
  const corosTimes = coros ? [coros.k5, coros.k10, coros.half, coros.marathon] : undefined;

  return (
    <Sky state="go">
      <Hero
        place="Outlook"
        word={next ? `${horizon} ${horizon === 1 ? "day" : "days"}` : "No race"}
        sub={next?.name ?? "Add a race in intervals.icu"}
      >
        {next && (
          <div className="hl num">
            {next.info.label} <span>· {shortDate(next.start_date_local)}</span>
          </div>
        )}
      </Hero>

      {o.races.length > 1 && (
        <Module title="Races ahead">
          <ul className="races">
            {o.races.map((r) => (
              <li key={r.id}>
                <span className="race-days num">
                  <b>{daysBetween(o.date, r.start_date_local.slice(0, 10))}</b>
                  <small>days</small>
                </span>
                <span className="what">
                  <b>{r.name}</b>
                  <small>
                    {shortDate(r.start_date_local)} · {r.info.label}
                  </small>
                </span>
                <span className="prio" style={{ background: SPORT_TINT[r.info.sport] }}>
                  {PRIORITY[r.category] ?? "·"}
                </span>
              </li>
            ))}
          </ul>
        </Module>
      )}

      <Module
        title="Running potential"
        value={o.potential.now ? `VDOT ${o.potential.now.toFixed(1)}` : undefined}
        info={
          <>
            <p>
              Now: your fitness from heart rate against pace on recent runs (Runalyze's method),
              scaled so your fittest stretch matches your best performances (VDOT{" "}
              {o.potential.pbVdot?.toFixed(1) ?? "–"}). Easy runs say less than a hard effort, so
              it's shown ±5 %.
            </p>
            <p>
              Race day: what the weekly distance you choose supports (Tanda 2011, from weekly km and
              training pace, about 5 min error on a marathon), reached over the weeks left with a
              ~10-week time constant. That last part is a heuristic: no validated retraining curve
              exists. Shown ±6 %.
            </p>
            <p>
              White ticks: your all-time bests. Grey dots: COROS's own prediction. Your recent
              running: {o.potential.weeklyKm.toFixed(1)} km/week.
            </p>
          </>
        }
      >
        <div className="mod-b">
          <Potential
            now={o.potential.now}
            pbTimes={o.potential.pbTimes}
            coros={corosTimes}
            anchor={o.potential.anchor}
            weeklyKm={o.potential.weeklyKm}
            weeks={runRace ? daysBetween(o.date, runRace.start_date_local.slice(0, 10)) / 7 : 12}
            race={runRace?.info}
          />
        </div>
      </Module>

      {tri && triSplitNow && (
        <Tri
          name={tri.name ?? ""}
          label={tri.info.label}
          split={triSplitNow}
          swimNote={"problem" in css ? css.problem : undefined}
        />
      )}

      <Module title="Next 8 weeks" value={planned ? undefined : "nothing planned"}>
        {planned ? (
          <div className="mod-b">
            <div className="weekstrip" role="img" aria-label="Planned hours per week by sport">
              {weeks.map((w) => (
                <div key={w.from} className="wk-col">
                  <div className="wk-bar">
                    {w.hours.map((h) => (
                      <i
                        key={h.id}
                        style={{
                          height: `${(h.h / maxH) * 100}%`,
                          background: SPORT_COLOR[h.sport],
                        }}
                      />
                    ))}
                  </div>
                  <small className="num">{hmm(w.hours.reduce((s, h) => s + h.h, 0) * 3600)}</small>
                </div>
              ))}
            </div>
            {raceDay && target && (
              <div className="caption">
                Race-day form {Math.round(formPct(raceDay))}% · target {target.low}–{target.high}%
              </div>
            )}
          </div>
        ) : null}
      </Module>

      {known && (
        <Module
          title="What if"
          info={
            <>
              <p>
                A scenario, not a forecast: fitness and form if you train exactly this, from today's
                numbers.
              </p>
              <p>
                It uses {o.rideRate.typical ? "a typical" : "your recent"}{" "}
                {Math.round(o.rideRate.rate)} load/h riding and{" "}
                {o.runRate.typical ? "a typical" : "your recent"} {Math.round(o.runRate.rate)}{" "}
                load/h running. The 20-min range is what you typically rode at that ride fitness (8
                of 10 weeks inside it), not a test result.
              </p>
            </>
          }
        >
          <div className="mod-b">
            <WhatIf
              date={o.date}
              ctl={o.ctl as number}
              atl={o.atl as number}
              rideCtl={o.rideCtl}
              ride={o.rideRate}
              run={o.runRate}
              fit={o.power}
              race={raceDate ? { date: raceDate, target } : undefined}
            />
          </div>
        </Module>
      )}

      {o.power && (
        <Module
          title="20-min power vs fitness"
          value={`${Math.round(o.recentBest20)} W now`}
          info={
            <p>
              Each dot is a week since 2025: your best 20-min power over the 6 weeks before it
              against your ride fitness. Line: +{o.power.b.toFixed(1)} W per point of fitness, ±
              {Math.round(o.power.p80 * 100)} % for 8 of 10 weeks. White: today (
              {Math.round(powerAt(o.power, o.rideCtl))} W typical at fitness {Math.round(o.rideCtl)}
              ). Training bests, not tests; not your FTP.
            </p>
          }
        >
          <div className="mod-b">
            <Scatter
              points={o.power.points}
              line={o.power}
              today={{ ctl: o.rideCtl, power: o.recentBest20 }}
            />
          </div>
        </Module>
      )}

      <Recovery r={o.recovery} />
    </Sky>
  );
}
