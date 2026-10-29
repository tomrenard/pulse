import { addDays, daysBetween, shortDate } from "@/lib/date";
import { clock, hmm } from "@/lib/format";
import { vo2Word } from "@/lib/level";
import { formPct, formTarget, formVerdict, projectFitness } from "@/lib/outlook";
import { loadOutlook } from "@/lib/outlook-load";
import { freshTime, timeAt, valueOn } from "@/lib/potential";
import { swimCss, swimPace, triLegs, triSplit } from "@/lib/races";
import { loadSwim } from "@/lib/races-load";
import { planStart, SPORT_COLOR, SPORTS, type Sport, weeklyVolume } from "@/lib/volume";
import { Line } from "../charts";
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

const Word = ({ w }: { w: { word: string; tone: string } }) => (
  <small className={`signal-word ${w.tone}`}>{w.word}</small>
);

/** ▲2 · 3 mo: up is better here (VO2max, FTP). */
const Trend = ({ d, unit = "" }: { d: number; unit?: string }) =>
  Math.round(d) === 0 ? (
    <small className="dim">steady · 3 mo</small>
  ) : (
    <small className={d > 0 ? "better" : "worse"}>
      {d > 0 ? "▲" : "▼"}
      {Math.abs(Math.round(d))}
      {unit} · 3 mo
    </small>
  );

export default async function OutlookPage() {
  const [o, pool] = await Promise.all([loadOutlook(), loadSwim()]);
  const next = o.races[0];
  const known = o.ctl !== undefined && o.atl !== undefined;
  const v = o.potential.now;
  const run = (metres: number) => (v ? freshTime(v, metres, o.potential.volume) : undefined);
  const css = swimCss(pool.swim200, pool.swim400);
  const swim = swimPace(css, o.recentSwim);
  const tris = TRIS.map(([label, name]) => ({
    label,
    name,
    split: triSplit(label, { swim, ftp: o.ftp, kg: o.kg, runSecs: run(triLegs(label)[2]) }),
  }));
  // Garmin's primary race: the A race leads, the rest are "also ahead".
  const primary = o.races.find((r) => r.category === "RACE_A") ?? o.races[0];
  const others = o.races.filter((r) => r !== primary);
  const series = o.potential.series;
  const ago = (days: number) => valueOn(series, addDays(o.date, -days))?.vdot;
  /** Predicted finish (s) for a race at a run fitness: runs and triathlons; rides need a route. */
  const predict = (r: (typeof o.races)[number], vdot: number | undefined) => {
    if (r.info.sport === "run" && r.info.metres && vdot)
      return freshTime(vdot, r.info.metres, o.potential.volume);
    const t = tris.find((x) => x.label === r.info.label)?.split.total;
    return r.info.sport === "tri" && t?.swim ? (t.low + t.high) / 2 : undefined;
  };
  const finish = (secs: number) => (secs < 3600 ? clock(secs) : hmm(secs));
  // Change over 4 weeks, for runs (a triathlon's swim and bike have no history here).
  const change = (r: (typeof o.races)[number]) => {
    const now = predict(r, v);
    const before = r.info.sport === "run" ? predict(r, ago(28)) : undefined;
    return now && before ? now - before : undefined;
  };
  // The last 12 months of run fitness, from the first run after any break of 6+ weeks.
  const year = series.filter((p) => p.date >= addDays(o.date, -365));
  const breakAt = year.reduce(
    (at, p, i) => (i > 0 && p.date > addDays(year[i - 1]?.date ?? p.date, 42) ? i : at),
    0,
  );
  const recentSeries = year.slice(breakAt);
  const run90 = ago(90);
  const entered = new Set(o.races.map((r) => r.info.label));
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

  // The plan by calendar week (Mon to Sun): planned hours per sport.
  // weeklyVolume counts back from its last week: the plan's first Monday + 7 weeks.
  const lastPlanned = o.workouts.at(-1)?.start_date_local.slice(0, 10);
  const raceDays = o.races.map((r) => r.start_date_local.slice(0, 10));
  const weeks = weeklyVolume(o.workouts, addDays(planStart(o.date), 49), 8).map((w) => ({
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
        word={
          primary
            ? ((d) => `${d} ${d === 1 ? "day" : "days"}`)(
                daysBetween(o.date, primary.start_date_local.slice(0, 10)),
              )
            : "No race"
        }
        sub={primary?.name ?? "Add a race in intervals.icu"}
      >
        {primary && (
          <div className="hl num">
            {primary.info.label} <span>· {shortDate(primary.start_date_local)}</span>
          </div>
        )}
      </Hero>

      {others.length > 0 && (
        <Module
          title="Also ahead"
          info={
            <p>
              Days to go, your predicted time today and its change over the last 4 weeks (▼ faster),
              and the race's priority: A is the one you peak for, B a tune-up, C trained through. A
              ride's time needs its route: load the GPX in Long ride.
            </p>
          }
        >
          <ul className="races">
            {others.map((r) => {
              const t = predict(r, v);
              const d = change(r);
              return (
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
                  <span className="race-t num">
                    {t ? finish(t) : r.info.sport === "ride" ? <small>add route</small> : "–"}
                    {d !== undefined && Math.abs(d) >= 1 && (
                      <small className={d < 0 ? "better" : "worse"}>
                        {d < 0 ? "▼" : "▲"}
                        {clock(Math.abs(d))} · 4 wk
                      </small>
                    )}
                  </span>
                  <span className="prio" style={{ background: SPORT_TINT[r.info.sport] }}>
                    {PRIORITY[r.category] ?? "·"}
                  </span>
                </li>
              );
            })}
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
            <p>
              Words: the Cooper Institute's VO₂max ratings for men 30–39 (Superior 54+, Excellent
              48.3, Good 44, Fair 40.5), as Garmin shows them. Arrows: the change over 3 months.
            </p>
          </>
        }
      >
        <div className="mod-b">
          <div className="stats num engine">
            <span>
              <b>{v ? Math.round(v) : "–"}</b>
              Run VO₂max
              {v && <Word w={vo2Word(v)} />}
              {v && run90 && <Trend d={v - run90} />}
            </span>
            <span>
              <b>{o.rideVo2 ? Math.round(o.rideVo2) : "–"}</b>
              Ride VO₂max
              {o.rideVo2 && <Word w={vo2Word(o.rideVo2)} />}
            </span>
            <span>
              <b>{o.ftp ? `${Math.round(o.ftp)} W` : "–"}</b>
              FTP{o.ftp && o.kg ? ` · ${(o.ftp / o.kg).toFixed(1)} W/kg` : ""}
              {o.ftp && o.ftpBefore && <Trend d={o.ftp - o.ftpBefore} unit=" W" />}
            </span>
          </div>
        </div>
      </Module>

      <Module
        title="Running"
        info={
          <p>
            What you could run fresh today, from your run VO₂max (Daniels' tables), ±5 %. That
            VO₂max comes from your heart rate against pace on recent runs, mostly easy ones: without
            a hard effort it's an estimate, not a result. The marathon also needs volume: it's the
            slower of that and what your last 8 weeks ({o.potential.volume.weeklyKm.toFixed(0)}{" "}
            km/week) support (Tanda 2011), since VO₂max alone predicts marathons too fast for most
            runners (Vickers &amp; Vertosick 2016). Below about 30 km/week the half is optimistic
            too, and the marathon sits near the formula's no-training floor.
          </p>
        }
      >
        <div className="mod-b">
          {v ? (
            <ul className="est">
              {RUNS.map(([metres, name]) => {
                const t = run(metres) as number;
                // Runalyze's two numbers: what the engine is fit for, what the volume is ready for.
                const fit = timeAt(v, metres);
                return (
                  <li key={name}>
                    <span className="what">
                      <b>{name}</b>
                      {t > fit * 1.01 && <small>fit for {clock(fit)}, volume holds it back</small>}
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
          {recentSeries.length > 3 && (
            <>
              <p className="mod-line">
                Run VO₂max since {shortDate(recentSeries[0]?.date ?? o.date)}: the estimates move
                with it.
              </p>
              <Line
                points={recentSeries.map((p) => ({ date: p.date, value: p.vdot }))}
                color="var(--go)"
                label="Run VO2max since your last comeback"
                unit=""
              />
            </>
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
          <Tri races={tris.filter((t) => entered.has(t.label))} open />
          {tris.some((t) => !entered.has(t.label)) && (
            <details className="more">
              <summary>Other distances</summary>
              <Tri races={tris.filter((t) => !entered.has(t.label))} />
            </details>
          )}
        </div>
      </Module>

      <Module
        title="Long ride"
        info={
          <>
            <p>
              Load a route (GPX) and pick a steady power: moving time from physics on each 100 m of
              the route, plus your stops. Starts at 65 % of your FTP.
            </p>
            <p>
              Physics only: gravel rolls at 0.008 with CdA 0.34, road at 0.004 with CdA 0.30; your
              weight (or 68 kg) plus bike and bags; descents capped at 55 km/h. No wind, no fatigue:
              over many hours you'll likely hold less power than you plan.
            </p>
          </>
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
            {raceForm === undefined &&
              next &&
              lastPlanned &&
              lastPlanned < next.start_date_local.slice(0, 10) && (
                <div className="caption">
                  Plan runs to {shortDate(lastPlanned)}: race-day form shows once it reaches race
                  week.
                </div>
              )}
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
