import Link from "next/link";
import type { night } from "@/db/schema";
import { addDays, weekday } from "@/lib/date";
import { MIN_NIGHTS, SLEEP_NEED_SECS } from "@/lib/readiness";
import { type PlanEvent, profile } from "@/lib/today";
import { sportOf } from "@/lib/volume";
import { Delta, Dot, hm, Module } from "./ui";

type Night = typeof night.$inferSelect & { tagged?: boolean };

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
  if (!event && notes.length === 0) return null;
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

/** Weather's forecast list: per night the overnight HRV range, the night's average, your normal. */
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
    <Module
      title="HRV · 7 nights"
      info={
        <p>
          Each bar is one night's heart-rate variability, low to high (10th–90th percentile); the
          dot is the night's average. The light band is your normal
          {normal
            ? `, ${Math.round(normal.low)}–${Math.round(normal.high)} ms`
            : ` (after ${MIN_NIGHTS} nights)`}
          . One night swings; readiness uses the 7-night average. ● marks a tagged night.
        </p>
      }
    >
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
    </Module>
  );
}

type Signal = {
  key: string;
  label: string;
  href: string;
  color: string;
  icon: React.ReactNode;
  value: string;
  state: "go" | "mid" | "stop";
  delta?: React.ReactNode;
};

const glyph = (children: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/**
 * The four readiness signals as glass tiles: value, a state dot, the change against your normal.
 * No words: the hero line says what matters, the tiles show where it comes from.
 */
export function Signals({
  hrv7,
  hrvNormal,
  last,
  rhr,
  tsb,
}: {
  hrv7?: number;
  hrvNormal?: { low: number; high: number };
  last?: Night;
  rhr?: { low: number; high: number };
  tsb?: number;
}) {
  const hrvMid = hrvNormal && Math.sqrt(hrvNormal.low * hrvNormal.high);
  const rhrMid = rhr && (rhr.low + rhr.high) / 2;
  const asleep = last?.asleepSecs;
  const signals: Signal[] = [
    {
      key: "hrv",
      label: "HRV",
      href: "/health",
      color: "var(--hrv)",
      icon: glyph(<path d="M2.5 12h4l2-5 3.5 10 2.5-7 1.5 2h5.5" />),
      value: hrv7 ? `${Math.round(hrv7)}` : "–",
      state: !hrv7 || !hrvNormal ? "go" : hrv7 < hrvNormal.low ? "mid" : "go",
      delta: hrv7 && hrvMid ? <Delta v={hrv7 - hrvMid} good="up" /> : null,
    },
    {
      key: "rhr",
      label: "Resting HR",
      href: "/health",
      color: "var(--rhr)",
      icon: glyph(
        <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
      ),
      value: last?.rhr ? `${last.rhr}` : "–",
      state: last?.rhr && rhr && last.rhr > rhr.high ? "stop" : "go",
      delta: last?.rhr && rhrMid ? <Delta v={last.rhr - rhrMid} good="down" /> : null,
    },
    {
      key: "sleep",
      label: "Sleep",
      href: "/health",
      color: "var(--sleep)",
      icon: glyph(<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />),
      value: asleep ? hm(asleep).replace(" ", "").replace("m", "") : "–",
      state: asleep && asleep < 0.85 * SLEEP_NEED_SECS ? "mid" : "go",
      delta: asleep ? <Delta v={(asleep - SLEEP_NEED_SECS) / 60} good="up" unit="′" /> : null,
    },
    {
      key: "form",
      label: "Form",
      href: "/training",
      color: "var(--form)",
      icon: glyph(<path d="M4 16a8 8 0 0 1 16 0M12 16l4-5" />),
      value: tsb === undefined ? "–" : `${Math.round(tsb)}`,
      state: tsb !== undefined && tsb < -30 ? "stop" : "go",
    },
  ];
  return (
    <nav className="signals" aria-label="Readiness signals">
      {signals.map((s) => (
        <Link key={s.key} href={s.href} className="signal" style={{ color: s.color }}>
          {s.icon}
          <b className="num">{s.value}</b>
          <span className="signal-foot">
            <Dot state={s.state} />
            {s.delta}
          </span>
          <span className="sr">{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}
