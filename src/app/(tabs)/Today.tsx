import Link from "next/link";
import type { night } from "@/db/schema";
import { addDays, weekday } from "@/lib/date";
import { hmm } from "@/lib/format";
import { type Trend, WEEK_ZONES, weekZone } from "@/lib/load";
import { splitPlan } from "@/lib/plan";
import { type HrvStatus, hrvStatus, hrvWord, rhrWord, sleepWord } from "@/lib/readiness";
import { type PlanEvent, profile } from "@/lib/today";
import { hoursOf, sportOf } from "@/lib/volume";
import { Glyph, hm, Module, SportChip } from "./ui";

type Night = typeof night.$inferSelect & { tagged?: boolean };

function Profile({ steps, ftp }: { steps: [number, number][]; ftp: number }) {
  const total = steps.reduce((s, [d]) => s + d, 0);
  if (!total) return null;
  let x = 0;
  return (
    <svg
      className="profile"
      viewBox="0 0 300 64"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Workout profile against FTP ${ftp} W`}
    >
      {steps.map(([d, pct], i) => {
        const w = (d / total) * 300;
        const h = Math.min(1, pct / 1.2) * 64;
        const hard = pct >= 0.85;
        const rect = (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: steps have no id and never reorder
            key={i}
            x={x + 0.6}
            y={64 - h}
            width={Math.max(0.5, w - 1.2)}
            height={h}
            rx={2}
            fill={hard ? "var(--mid)" : "#fff"}
            fillOpacity={hard ? 0.95 : 0.28}
          />
        );
        x += w;
        return rect;
      })}
    </svg>
  );
}

/** The coach's note, the steps, and for rides the power profile. */
function PlanDetail({ event, ftp }: { event: PlanEvent; ftp: number }) {
  const { note, steps } = splitPlan(event.description);
  return (
    <>
      {sportOf(event.type) === "ride" && steps.length > 1 && (
        <Profile steps={profile(event.workout_doc?.steps, ftp)} ftp={ftp} />
      )}
      {note && <p className="plan-note">{note}</p>}
      {steps.length > 0 && (
        <ul className="plan-steps num">
          {steps.map((step, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: steps repeat ("- 3m 130W") and never reorder
            <li key={i}>{step}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The next 6 days of the plan, rest days included; tap a session for its note and steps. */
export function ComingUp({
  date,
  events,
  ftp,
}: {
  date: string;
  events: PlanEvent[];
  ftp: number;
}) {
  if (events.length === 0) return null;
  const days = Array.from({ length: 6 }, (_, i) => addDays(date, i + 1));
  return (
    <Module title="Coming up" value={hmm(hoursOf(events) * 3600)}>
      <ul className="feed plan">
        {days.flatMap((day) => {
          const sessions = events.filter((e) => e.start_date_local.startsWith(day));
          if (sessions.length === 0)
            return (
              <li key={day} className="plan-rest">
                <span className="plan-day">{weekday(day)}</span>
                <span>Rest</span>
              </li>
            );
          return sessions.map((e, i) => {
            const row = (
              <>
                <span className="plan-day">{i === 0 ? weekday(day) : ""}</span>
                <SportChip sport={sportOf(e.type)} />
                <span className="what">
                  <b>{e.name ?? e.type}</b>
                </span>
                <span className="num figures">
                  {e.category.startsWith("RACE")
                    ? "Race"
                    : e.moving_time
                      ? hmm(e.moving_time)
                      : "–"}
                </span>
              </>
            );
            const { note, steps } = splitPlan(e.description);
            // Nothing to open: a plain row, not a control that opens onto nothing.
            if (!note && steps.length === 0)
              return (
                <li key={e.id} className="plan-row">
                  {row}
                </li>
              );
            return (
              <li key={e.id}>
                <details>
                  <summary>{row}</summary>
                  <div className="plan-detail">
                    <PlanDetail event={e} ftp={ftp} />
                  </div>
                </details>
              </li>
            );
          });
        })}
      </ul>
    </Module>
  );
}

export function Workout({
  event,
  notes,
  ftp,
  target,
}: {
  event?: PlanEvent;
  notes: PlanEvent[];
  ftp: number;
  /** Today's state says to adapt the session: easy only, or rest. */
  target?: string;
}) {
  if (!event && notes.length === 0) return null;
  return (
    <Module title="Today's workout">
      <div className="hair" />
      <div className="mod-b wk">
        {event ? (
          <>
            <h2>{event.name ?? event.type}</h2>
            {target && <p className="target">Today: {target}</p>}
            <div className="meta num">
              {event.moving_time ? (
                <span>
                  <b>{hm(event.moving_time)}</b>
                </span>
              ) : null}
              {event.icu_training_load ? (
                <span>
                  <b>{event.icu_training_load}</b> load
                </span>
              ) : null}
            </div>
            <PlanDetail event={event} ftp={ftp} />
          </>
        ) : null}
        {notes.map((n) => (
          <div key={n.id} className="note">
            <span className="av">W</span>
            <p>
              <small>{n.name ?? "Wattson"}</small>
              {n.description}
            </p>
          </div>
        ))}
      </div>
    </Module>
  );
}

/** Weather's forecast list: per night the overnight HRV range (dot = average) on your normal band. */
export function HrvWeek({
  date,
  nights,
  normal,
}: {
  date: string;
  nights: Night[];
  normal?: { low: number; high: number };
}) {
  const rows = nights
    .filter((n) => n.hrv)
    .slice(-7)
    .reverse();
  if (!rows.length) return null;
  const values = rows
    .flatMap((n) => [n.hrvLow ?? n.hrv, n.hrvHigh ?? n.hrv])
    .filter(Boolean) as number[];
  const lo = Math.min(...values, normal?.low ?? Infinity) - 3;
  const hi = Math.max(...values, normal?.high ?? 0) + 3;
  const pct = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  const span = (a: number, b: number) => ({ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` });
  return (
    <ul className="rows">
      {rows.map((n) => {
        const hrv = n.hrv as number;
        const below = normal ? hrv < normal.low : false;
        return (
          <li key={n.date} className="row num">
            <span>
              {n.date === date ? "Today" : weekday(n.date)}
              {n.tagged && (
                <span className="tagged" role="img" aria-label="tagged night">
                  ●
                </span>
              )}
            </span>
            <span className="sr">
              average {Math.round(hrv)} ms{below ? ", below normal" : ""}
            </span>
            <span className="track" aria-hidden="true">
              {normal && <span className="band" style={span(normal.low, normal.high)} />}
              <span
                className="seg"
                style={{
                  ...span(n.hrvLow ?? hrv, n.hrvHigh ?? hrv),
                  background: below
                    ? "linear-gradient(90deg,var(--mid),#ff9a5a)"
                    : "linear-gradient(90deg,var(--hrv),var(--go))",
                }}
              />
              <span className="dot" style={{ left: pct(hrv) }} />
            </span>
            <span className="hi">{Math.round(hrv)}</span>
          </li>
        );
      })}
    </ul>
  );
}

type Tone = "go" | "mid" | "stop";
type Signal = {
  key: string;
  label: string;
  href: string;
  color: string;
  icon: React.ReactNode;
  value: string;
  unit?: string;
  state: Tone;
  word: string;
};

/**
 * The four signals as glass tiles, each with its state in a word (Normal, Low, Optimized…), so no
 * number needs decoding. HRV is the 7-night mean; last night has its own row below.
 */
export function Signals({
  hrv7,
  hrvNormal,
  last,
  rhr,
  trend,
}: {
  hrv7?: number;
  hrvNormal?: { lnMean: number; lnSd: number };
  last?: Night;
  rhr?: { low: number; high: number };
  trend?: Trend;
}) {
  const hrv = hrv7 && hrvNormal ? hrvWord(hrv7, hrvNormal) : undefined;
  const sleep = sleepWord(last?.asleepSecs);
  const rest = rhrWord(last?.rhr, rhr);
  const signals: Signal[] = [
    {
      key: "hrv",
      label: "HRV 7 nights",
      href: "/health",
      color: "var(--hrv)",
      icon: (
        <Glyph width={1.9}>
          <path d="M2.5 12h4l2-5 3.5 10 2.5-7 1.5 2h5.5" />
        </Glyph>
      ),
      value: hrv7 ? `${Math.round(hrv7)}` : "–",
      unit: "ms",
      state: hrv?.tone ?? "go",
      word: hrv?.word ?? "Learning",
    },
    {
      key: "rhr",
      label: "Resting HR",
      href: "/health",
      color: "var(--rhr)",
      icon: (
        <Glyph width={1.9}>
          <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
        </Glyph>
      ),
      value: last?.rhr ? `${last.rhr}` : "–",
      unit: "bpm",
      state: rest?.tone ?? "go",
      word: rest?.word ?? "No data",
    },
    {
      key: "sleep",
      label: "Sleep",
      href: "/health",
      color: "var(--sleep)",
      icon: (
        <Glyph width={1.9}>
          <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
        </Glyph>
      ),
      value: last?.asleepSecs ? hmm(last.asleepSecs) : "–",
      state: sleep?.tone ?? "go",
      word: sleep?.word ?? "No data",
    },
    {
      key: "load",
      label: "Load trend",
      href: "/training",
      color: "var(--form)",
      icon: (
        <Glyph width={1.9}>
          <path d="M4 16a8 8 0 0 1 16 0M12 16l4-5" />
        </Glyph>
      ),
      value: trend ? `${trend.pct}` : "–",
      unit: "%",
      state: trend?.state ?? "go",
      word: trend?.zone ?? "No data",
    },
  ];
  return (
    <nav className="signals" aria-label="Readiness signals">
      {signals.map((s) => (
        <Link key={s.key} href={s.href} className="signal" style={{ color: s.color }}>
          {s.icon}
          <b className="num">
            {s.value}
            {s.unit && s.value !== "–" && <small>{s.unit}</small>}
          </b>
          <span className={`signal-word ${s.state}`}>{s.word}</span>
          <span className="signal-label">{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}

const HRV_MEANING: Record<HrvStatus, string> = {
  Elevated: "Above your normal: well recovered.",
  Normal: "In your normal range.",
  Reduced: "A bit under your normal: common after a hard day.",
  Low: "Well under your normal: alcohol, stress, a cold?",
};

type Normal = { low: number; high: number; lnMean: number; lnSd: number };

/** Last night's HRV on your normal band, the 7-night mean as a tick, and what it means. */
export function NightBar({ hrv, hrv7, normal }: { hrv: number; hrv7?: number; normal: Normal }) {
  const values = [hrv, hrv7 ?? hrv, normal.low, normal.high];
  const lo = Math.min(...values) * 0.85;
  const hi = Math.max(...values) * 1.1;
  const pct = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  return (
    <>
      <span className="track night-track" aria-hidden="true">
        <span
          className="band"
          style={{ left: pct(normal.low), width: `calc(${pct(normal.high)} - ${pct(normal.low)})` }}
        />
        {hrv7 && <span className="tick" style={{ left: pct(hrv7) }} />}
        <span className="dot" style={{ left: pct(hrv) }} />
      </span>
      <p className="mod-line">{HRV_MEANING[hrvStatus(hrv, normal)]}</p>
    </>
  );
}

export const nightInfo = (normal: Normal, hrv7?: number) => (
  <p>
    The white dot is last night, the light band your normal ({Math.round(normal.low)}–
    {Math.round(normal.high)} ms, 60 days), the tick your 7-night average
    {hrv7 ? ` (${Math.round(hrv7)} ms)` : ""}. Readiness follows the 7-night average: one night
    swings, a trend matters. Reduced is down to 1.5 SD under your average, Low below.
  </p>
);

export function LastNight({
  hrv,
  hrv7,
  normal,
}: {
  hrv?: number | null;
  hrv7?: number;
  normal?: Normal;
}) {
  if (!hrv || !normal) return null;
  return (
    <Module
      title="HRV last night"
      value={
        <>
          {Math.round(hrv)} ms{" "}
          <span className={`signal-word ${hrvWord(hrv, normal).tone}`}>
            {hrvWord(hrv, normal).word}
          </span>
        </>
      }
      info={nightInfo(normal, hrv7)}
    >
      <div className="mod-b">
        <NightBar hrv={hrv} hrv7={hrv7} normal={normal} />
      </div>
    </Module>
  );
}

/**
 * This week's load against a usual week (7 × fitness), COROS-style: the bar is done, the faint
 * part what the plan adds, the zones behind it say what the week does to your fitness.
 */
export function WeekLoad({
  done,
  planned,
  projected,
  ctl,
}: {
  done: number;
  planned?: number;
  projected: number;
  ctl?: number;
}) {
  if (!ctl) return null;
  const usual = 7 * ctl;
  const max = Math.max(usual * 1.8, projected * 1.05);
  const pct = (v: number) => `${((Math.min(v, max) / max) * 100).toFixed(1)}%`;
  const zone = weekZone(projected, ctl);
  let from = 0;
  return (
    <Module
      title="This week's load"
      value={planned ? `${done} of ${planned}` : `${done}`}
      info={
        <p>
          Training load done since Monday, then what the rest of the plan adds. The zones compare
          the week with a usual week, 7 × your fitness ({Math.round(usual)}): under 0.8× you lose
          fitness, 0.8–1× you keep it, 1–1.5× you build it safely, above 1.5× you overreach (COROS's
          weekly load).
        </p>
      }
    >
      <div className="mod-b">
        <span className="track week-track" aria-hidden="true">
          {WEEK_ZONES.map((z, i) => {
            const to = Math.min(z.upTo * usual, max);
            const el = (
              <span
                key={z.label}
                className={`wz wz${i}`}
                style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})` }}
              />
            );
            from = to;
            return el;
          })}
          <span className="seg ahead" style={{ width: pct(projected) }} />
          <span className="seg" style={{ width: pct(done) }} />
        </span>
        <span className="week-scale" aria-hidden="true">
          {WEEK_ZONES.map((z) => (
            <span key={z.short} style={{ left: pct(z.from * usual) }}>
              {z.short}
            </span>
          ))}
        </span>
        <p className="mod-line">
          {projected > done ? "With the plan: " : ""}
          <b>{zone.label}</b>
        </p>
      </div>
    </Module>
  );
}
