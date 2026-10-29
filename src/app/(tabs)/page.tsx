import { today, weekday } from "@/lib/date";
import { ACTION, hrvStatus, MIN_NIGHTS, rhrNormal, WORD } from "@/lib/readiness";
import { loadReview } from "@/lib/review-load";
import { loadToday } from "@/lib/today";
import { CorosCard } from "./CorosCard";
import { Hero } from "./Hero";
import { Info } from "./Info";
import { PushToggle } from "./PushToggle";
import { Sky } from "./Sky";
import { ComingUp, LastNight, Signals, WeekLoad, Workout } from "./Today";
import { Glyph } from "./ui";
import { Volume } from "./Volume";
import { WeekReview } from "./WeekReview";

const time = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export default async function TodayPage() {
  // Sunday and Monday only: the week just ending or just ended.
  const date = today();
  const [t, review] = await Promise.all([
    loadToday(),
    ["Sun", "Mon"].includes(weekday(date)) ? loadReview(date) : undefined,
  ]);
  const { ready } = t;
  const place = `Today · ${new Date(`${t.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;
  // What to do, then why: the flagged signal, or last night's HRV when it dipped on its own.
  const flagged = ready.reasons.find((r) => r.flag)?.label;
  const night =
    t.lastNight?.hrv && ready.normal ? hrvStatus(t.lastNight.hrv, ready.normal) : undefined;
  const why =
    flagged ??
    (night === "Low" || night === "Reduced"
      ? "last night's HRV dipped, check tomorrow"
      : undefined);
  const verdict = ready.stale
    ? "Too few nights this week to judge"
    : ready.state === "building"
      ? `Learning your normal · ${ready.nights} of ${MIN_NIGHTS} nights`
      : [ACTION[ready.state], why].filter(Boolean).join(" · ") +
        (ready.provisional ? " · early read" : "");
  const syncFailed = t.lastSync?.detail?.startsWith("error");
  return (
    <Sky state={ready.state}>
      <Hero place={place} word={WORD[ready.state]} sub={verdict} href="/health#why">
        {t.lastSync && !syncFailed && <div className="synced">Synced {time(t.lastSync.at)}</div>}
        <div className="hero-tools">
          <Info
            title="Settings"
            icon={
              <Glyph>
                <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
                <circle cx="15" cy="7" r="2" />
                <circle cx="9" cy="17" r="2" />
              </Glyph>
            }
          >
            <PushToggle />
            <p>A short note each morning after the sync: readiness and today's workout.</p>
          </Info>
        </div>
      </Hero>
      <Signals
        hrv7={ready.hrv7}
        hrvNormal={ready.normal}
        last={t.lastNight}
        rhr={rhrNormal(t.nights, t.date)}
        trend={t.trend}
      />
      <LastNight hrv={t.lastNight?.hrv} hrv7={ready.hrv7} normal={ready.normal} />
      <Workout event={t.workout} notes={t.notes} ftp={t.ftp} />
      <ComingUp date={t.date} events={t.coming} ftp={t.ftp} />
      <WeekLoad {...t.week} />
      {review && <WeekReview r={review} />}
      <Volume weeks={t.volume} planned={t.plannedHours} href="/training" />
      {/* The COROS card only when something needs you: not connected, or the sync broke. */}
      {(!t.corosConnected || syncFailed) && <CorosCard lastSync={t.lastSync} />}
    </Sky>
  );
}
