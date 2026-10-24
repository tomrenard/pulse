import type { night } from "@/db/schema";
import { addDays, weekday } from "@/lib/date";
import { MIN_NIGHTS, rhrNormal, SLEEP_NEED_SECS } from "@/lib/readiness";
import { type PlanEvent, profile } from "@/lib/today";
import { sportOf } from "@/lib/volume";
import { Gauge, hm, Module } from "./ui";

type Night = typeof night.$inferSelect & { tagged?: boolean };

const NEED = hm(SLEEP_NEED_SECS).replace("h ", " h ").replace("m", "");

const SPORT: Record<string, React.ReactNode> = {
  ride: (
    <>
      <circle cx="5.5" cy="16" r="3.5" />
      <circle cx="18.5" cy="16" r="3.5" />
      <path d="M5.5 16 9 9h6l3.5 7M9 9l3 7h-1M14 5.5h2.5" />
    </>
  ),
  run: (
    <>
      <circle cx="14" cy="4.5" r="1.8" />
      <path d="M6 21l3.5-5 3 2 1-6 3 3h3M8 11l3-3h3" />
    </>
  ),
  swim: (
    <>
      <circle cx="16.5" cy="7" r="1.8" />
      <path d="M3 18c2 0 2-1.5 4.5-1.5S9.5 18 12 18s2-1.5 4.5-1.5S18.5 18 21 18M6 14l4-5 3 3 3-2" />
    </>
  ),
  rest: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  other: <circle cx="12" cy="12" r="6" />,
};

function Icon({ sport }: { sport: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SPORT[sport]}
    </svg>
  );
}

export function PlanStrip({ date, plan }: { date: string; plan: PlanEvent[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(date, i);
    return { d, event: plan.find((e) => e.start_date_local.startsWith(d)) };
  });
  const sessions = plan.length;
  return (
    <Module title="Next 7 days · plan">
      <p className="mod-sum">
        {sessions
          ? `${sessions} session${sessions > 1 ? "s" : ""} planned, ${days.filter((x) => !x.event).length} rest days.`
          : "Nothing planned in intervals.icu for the next 7 days."}
      </p>
      {sessions > 0 && (
        <div className="strip">
          {days.map(({ d, event }, i) => {
            const sport = event ? sportOf(event.type) : "rest";
            return (
              <div key={d} className={`day${i ? "" : " now"}`}>
                <span>{i ? weekday(d) : "Today"}</span>
                <Icon sport={sport} />
                <span className="load num">{event?.icu_training_load ?? "–"}</span>
                <small>
                  {event?.moving_time
                    ? hm(event.moving_time).replace(" 00m", "h").replace("0h ", "")
                    : event
                      ? ""
                      : "off"}
                </small>
              </div>
            );
          })}
        </div>
      )}
    </Module>
  );
}

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

export function Workout({
  event,
  notes,
  ftp,
}: {
  event?: PlanEvent;
  notes: PlanEvent[];
  ftp: number;
}) {
  return (
    <Module title="Today's workout">
      <div className="hair" />
      <div className="mod-b wk">
        {event ? (
          <>
            <h2>{event.name ?? event.type}</h2>
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
            <Profile steps={profile(event.workout_doc?.steps, ftp)} ftp={ftp} />
          </>
        ) : (
          <span className="dim">No workout planned today.</span>
        )}
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

/** Weather's 10-day list: per night the overnight HRV range, the night's average, your normal. */
export function HrvList({
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
    .slice(-10)
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
    <Module title="10-night HRV">
      <div className="hair" />
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
              <span className="slp">{hm(n.asleepSecs).replace(" ", "")}</span>
              <span className="lo">{Math.round(n.hrvLow ?? hrv)}</span>
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
              <span className="hi">{Math.round(n.hrvHigh ?? hrv)}</span>
            </li>
          );
        })}
      </ul>
      <div className="legend">
        Bar: overnight HRV, 10th to 90th percentile. Dot: night average.
        {normal
          ? ` Light band: your normal (${Math.round(normal.low)}–${Math.round(normal.high)} ms).`
          : ` Your normal appears after ${MIN_NIGHTS} nights.`}
      </div>
    </Module>
  );
}

export function SleepTile({
  nights,
  last,
  spread,
}: {
  nights: Night[];
  last?: Night;
  spread?: number;
}) {
  const needSecs = SLEEP_NEED_SECS;
  const week = nights.slice(-7);
  const max = Math.max(needSecs * 1.15, ...week.map((n) => n.asleepSecs ?? 0));
  const y = (s: number) => 40 - (s / max) * 40;
  return (
    <Module title="Sleep" className="tile">
      <div className="mod-b">
        <div className="v num">{hm(last?.asleepSecs)}</div>
        <svg className="mini" viewBox="0 0 140 40" preserveAspectRatio="none" aria-hidden="true">
          {week.map((n, i) => (
            <rect
              key={n.date}
              x={i * 20}
              y={y(n.asleepSecs ?? 0)}
              width={12}
              height={40 - y(n.asleepSecs ?? 0)}
              rx={4}
              fill="var(--sleep)"
              fillOpacity={n.date === last?.date ? 1 : 0.4}
            />
          ))}
          <line
            x1={0}
            x2={140}
            y1={y(needSecs)}
            y2={y(needSecs)}
            stroke="rgba(255,255,255,.55)"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="say">
          {last?.asleepSecs
            ? `${Math.round((last.asleepSecs / needSecs) * 100)}% of your ${NEED} need.`
            : "No sleep recorded last night."}
          {spread !== undefined ? ` Bedtime spread ${spread} min this week.` : ""}
        </div>
      </div>
    </Module>
  );
}

export function RhrTile({ nights, last, date }: { nights: Night[]; last?: Night; date: string }) {
  const normal = rhrNormal(nights, date);
  const rhr = last?.rhr;
  const word = !rhr
    ? "–"
    : !normal
      ? ""
      : rhr > normal.high
        ? "Up"
        : rhr < normal.low
          ? "Low"
          : "Normal";
  return (
    <Module title="Resting HR" className="tile">
      <div className="mod-b">
        <div className="v num">
          {rhr ?? "–"}
          <small> bpm</small>
        </div>
        <div className="w">{word}</div>
        {rhr && normal ? (
          <Gauge
            value={rhr}
            min={normal.low - 6}
            max={normal.high + 6}
            color={`linear-gradient(90deg,rgba(255,255,255,.18) 0 30%,var(--rhr) 30% 70%,rgba(255,255,255,.18) 70%)`}
          />
        ) : null}
        <div className="say">
          {normal
            ? `Your normal: ${normal.low}–${normal.high} bpm.`
            : `Normal range after ${MIN_NIGHTS} nights.`}
        </div>
      </div>
    </Module>
  );
}

const STRESS_WORD = (v: number) =>
  v <= 25 ? "Relaxed" : v <= 50 ? "Low" : v <= 75 ? "Medium" : "High";

export function StressTile({ last: night }: { last?: Night }) {
  const last = night?.stress;
  return (
    <Module title="Stress" className="tile">
      <div className="mod-b">
        <div className="v num">{last ?? "–"}</div>
        <div className="w">{last != null ? STRESS_WORD(last) : ""}</div>
        {last != null && (
          <Gauge
            value={last}
            min={0}
            max={100}
            color="linear-gradient(90deg,#5be3a0,#f7c55a 50%,#ff8a5a 75%,#ff5a7a)"
          />
        )}
        <div className="say">COROS daily average, 0–100. Not part of readiness.</div>
      </div>
    </Module>
  );
}

const FORM_WORD = (tsb: number) =>
  tsb < -30
    ? "Very fatigued"
    : tsb < -10
      ? "Productive"
      : tsb <= 5
        ? "Maintaining"
        : tsb <= 25
          ? "Fresh"
          : "Detraining";

export function FormTile({ ctl, atl, tsb }: { ctl?: number; atl?: number; tsb?: number }) {
  const min = -40;
  const max = 30;
  const r = 46;
  const ang = (v: number) =>
    Math.PI + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * Math.PI;
  const pt = (v: number) => [70 + r * Math.cos(ang(v)), 56 + r * Math.sin(ang(v))] as const;
  const arc = (a: number, b: number) => {
    const [x0, y0] = pt(a);
    const [x1, y1] = pt(b);
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  return (
    <Module title="Form" className="tile">
      <div className="mod-b">
        {tsb === undefined ? (
          <div className="v">–</div>
        ) : (
          <svg
            className="mini"
            viewBox="0 0 140 64"
            style={{ height: 64 }}
            role="img"
            aria-label={`Form ${Math.round(tsb)}: ${FORM_WORD(tsb)}`}
          >
            <path
              d={arc(min, max)}
              stroke="#fff"
              strokeOpacity={0.16}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={arc(-30, -10)}
              stroke="var(--form)"
              strokeOpacity={0.9}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
            />
            <circle cx={pt(tsb)[0]} cy={pt(tsb)[1]} r={6} fill="#fff" />
            <text
              x={70}
              y={50}
              textAnchor="middle"
              fill="#fff"
              fontSize={26}
              fontFamily="-apple-system, system-ui, sans-serif"
            >
              {Math.round(tsb)}
            </text>
          </svg>
        )}
        <div className="say">
          {tsb === undefined
            ? "No fitness data today."
            : `${FORM_WORD(tsb)}. Fitness ${Math.round(ctl ?? 0)}, fatigue ${Math.round(atl ?? 0)}.`}
        </div>
      </div>
    </Module>
  );
}
