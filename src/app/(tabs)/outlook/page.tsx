import { addDays, daysBetween, shortDate } from "@/lib/date";
import { clock, hmm } from "@/lib/format";
import { formPct, formTarget, formVerdict, projectFitness } from "@/lib/outlook";
import { loadOutlook } from "@/lib/outlook-load";
import { freshTime } from "@/lib/potential";
import { swimCss, swimPace, triLegs, triSplit } from "@/lib/races";
import { loadSwim } from "@/lib/races-load";
import { mondayOf, SPORT_COLOR, SPORTS, type Sport, weeklyVolume } from "@/lib/volume";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Module } from "../ui";
import { LongRide } from "./LongRide";
import { Tri } from "./Tri";

const PRIORITY: Record<string, string> = { RACE_A: "A", RACE_B: "B", RACE_C: "C" };
const SPORT_TINT = { ...SPORT_COLOR, tri: SPORT_COLOR.swim };

const RUNS = [
  [5000, "5 km"],
  [10000, "10 km"],
  [21097.5, "Half marathon"],
  [42195, "Marathon"],
] as const;
const TRIS = [
  ["Olympic triathlon", "Olympic"],
  ["T100", "T100"],
  ["Half distance", "70.3"],
  ["Full distance", "Ironman"],
] as const;
/** Running times are shown ±5 %: "now" comes from easy-run heart rate, not a race. */
const RUN_SPREAD = 0.05;

export default async function OutlookPage() {
  const [o, pool] = await Promise.all([loadOutlook(), loadSwim()]);
  const next = o.races[0];
  const known = o.ctl !== undefined && o.atl !== undefined;
  const v = o.potential.now;
  const run = (metres: number) => (v ? freshTime(v, metres, o.potential.volume) : undefined);
  const css = swimCss(pool.swim200, pool.swim400);
  const swim = swimPace(css, o.recentSwim);
  const tris = TRIS.map(([label, name]) => ({
    name,
    split: triSplit(label, { swim, ftp: o.ftp, kg: o.kg, runSecs: run(triLegs(label)[2]) }),
  }));
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
  const raceForm = raceDay && Math.round(formPct(raceDay));

  // The plan by calendar week (Mon to Sun), this week first: planned hours per sport.
  // The plan starts tomorrow, so weeks start from tomorrow's week (on a Sunday: next week).
  // weeklyVolume counts back from its last week: that Monday + 7 weeks.
  const raceDays = o.races.map((r) => r.start_date_local.slice(0, 10));
  const weeks = weeklyVolume(o.workouts, addDays(mondayOf(addDays(o.date, 1)), 49), 8).map((w) => ({
    from: w.monday,
    hours: Object.fromEntries(SPORTS.map((sp) => [sp, w.sports[sp].hours])) as Record<
      Sport,
      number
    >,
    total: SPORTS.reduce((sum, sp) => sum + w.sports[sp].hours, 0),
    race: raceDays.some((d) => d >= w.monday && d <= addDays(w.monday, 6)),
  }));
  const planTotal = weeks.reduce((sum, w) => sum + w.total, 0);
  const maxH = Math.max(1, ...weeks.map((w) => w.total));
  const bySport = SPORTS.map((sp) => [sp, weeks.reduce((sum, w) => sum + w.hours[sp], 0)] as const);

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
        title="Engine"
        info={
          <>
            <p>
              Run VO₂max: your VDOT now, from heart rate against pace on runs in the last 30 days,
              scaled so your fittest stretch matches your best race efforts (Runalyze's method).
            </p>
            <p>
              Ride VO₂max: from your best 5-min power in the last 6 weeks (Hawley &amp; Noakes
              1992). FTP: intervals.icu's eFTP from your recent rides.
            </p>
          </>
        }
      >
        <div className="mod-b">
          <div className="stats num">
            <span>
              <b>{v ? Math.round(v) : "–"}</b>
              Run VO₂max
            </span>
            <span>
              <b>{o.rideVo2 ? Math.round(o.rideVo2) : "–"}</b>
              Ride VO₂max
            </span>
            <span>
              <b>{o.ftp ? `${Math.round(o.ftp)} W` : "–"}</b>
              FTP{o.ftp && o.kg ? ` · ${(o.ftp / o.kg).toFixed(1)} W/kg` : ""}
            </span>
          </div>
        </div>
      </Module>

      <Module
        title="Running"
        info={
          <p>
            What you could run fresh today, from your run VO₂max (Daniels' tables), ±5 %. The
            marathon also needs volume: it's the slower of that and what your last 8 weeks (
            {o.potential.volume.weeklyKm.toFixed(0)} km/week) support (Tanda 2011), since VO₂max
            alone predicts marathons too fast for most runners (Vickers &amp; Vertosick 2016). Below
            about 30 km/week the half is optimistic too, and the marathon sits near the formula's
            no-training floor.
          </p>
        }
      >
        <div className="mod-b">
          {v ? (
            <ul className="est">
              {RUNS.map(([metres, name]) => {
                const t = run(metres) as number;
                return (
                  <li key={name}>
                    <span className="what">
                      <b>{name}</b>
                    </span>
                    <span className="est-v num">
                      <b>{clock(t)}</b>
                      <small>
                        {clock(t * (1 - RUN_SPREAD))}–{clock(t * (1 + RUN_SPREAD))}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="caption">Needs a few runs with heart rate in the last 30 days.</p>
          )}
        </div>
      </Module>

      <Module
        title="Triathlon"
        info={
          <>
            <p>Flat course, no drafting. Tap a race for its legs.</p>
            <p>
              Swim:{" "}
              {"per100" in css
                ? "your critical swim speed from your best 200 m and 400 m, +4 s per 100 m for open water, ±8 %."
                : swim
                  ? "your average pace over your swims in the last 8 weeks, ±12 %. Rough: your pool bests look wrong (pool length?); a 400 m and a 200 m test would sharpen it."
                  : "no usable swim data in the last 8 weeks, so totals are without the swim."}
            </p>
            <p>
              Bike: physics at a share of your FTP that drops with distance (Friel's age-group
              guide: Olympic 80–90 %, T100 72–82 %, 70.3 70–80 %, Ironman 60–70 %).
            </p>
            <p>
              Run: your fresh time for the distance, slower off the bike (about 10 % after an
              Olympic, 15 % after a T100, 18 % after a 70.3, 30 % after an Ironman). Transitions 3–6
              min.
            </p>
          </>
        }
      >
        <div className="mod-b">
          <Tri races={tris} />
        </div>
      </Module>

      <Module
        title="Long ride"
        info={
          <p>
            Load a route (GPX) and pick a steady power: moving time from physics on each 100 m of
            the route, plus your stops. Starts at 65 % of your FTP.
          </p>
        }
      >
        <div className="mod-b">
          <LongRide ftp={o.ftp} kg={o.kg} />
        </div>
      </Module>

      <Module
        title="Your plan"
        value={planTotal ? `${hmm(planTotal * 3600)} in 8 weeks` : "nothing planned"}
        info={
          <>
            <p>
              The workouts in your intervals.icu calendar (Wattson's plan, or ones you add), in
              hours per week from Monday, coloured by sport. This week counts only what's still to
              come.
            </p>
            <p>
              Race-day form: where your form lands on race day if you do exactly this plan. Shown
              only when the plan reaches race week and every workout has a training load.
            </p>
          </>
        }
      >
        {planTotal ? (
          <div className="mod-b">
            <div className="weekstrip">
              {weeks.map((w) => (
                <div key={w.from} className={`wk-col${w.race ? " race" : ""}`}>
                  <div className="wk-bar" aria-hidden="true">
                    {SPORTS.map((sp) =>
                      w.hours[sp] ? (
                        <i
                          key={sp}
                          style={{
                            height: `${(w.hours[sp] / maxH) * 100}%`,
                            background: SPORT_COLOR[sp],
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                  <b className="num">{w.total ? hmm(w.total * 3600) : "–"}</b>
                  <small>
                    {w.race ? "Race" : w.from <= o.date ? "This wk" : shortDate(w.from)}
                  </small>
                </div>
              ))}
            </div>
            <div className="wk-legend num">
              {bySport.map(([sp, h]) =>
                h ? (
                  <span key={sp}>
                    <i style={{ background: SPORT_COLOR[sp] }} />
                    {sp[0]?.toUpperCase()}
                    {sp.slice(1)} {hmm(h * 3600)}
                  </span>
                ) : null,
              )}
            </div>
            {raceForm !== undefined && target && (
              <div className="caption">
                Race-day form {raceForm}% (aim {target.low} to {target.high}%):{" "}
                {formVerdict(raceForm, target)}
              </div>
            )}
          </div>
        ) : null}
      </Module>
    </Sky>
  );
}
