import { MIN_NIGHTS, rhrNormal, WORD } from "@/lib/readiness";
import { loadToday } from "@/lib/today";
import { CorosCard } from "./CorosCard";
import { Hero } from "./Hero";
import { Sky } from "./Sky";
import { HrvList, Signals, Workout } from "./Today";
import { Volume } from "./Volume";

const time = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export default async function TodayPage() {
  const t = await loadToday();
  const { ready } = t;
  const place = `Today · ${new Date(`${t.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;
  // One line: what matters today. The signal tiles below show where it comes from.
  const flagged = ready.reasons.find((r) => r.flag)?.label;
  const verdict = ready.stale
    ? "Too few nights this week to judge"
    : ready.state === "building"
      ? `Learning your normal · ${ready.nights} of ${MIN_NIGHTS} nights`
      : (flagged ?? "All signals in range") + (ready.provisional ? " · early read" : "");
  const syncFailed = t.lastSync?.detail?.startsWith("error");
  return (
    <Sky state={ready.state}>
      <Hero place={place} word={WORD[ready.state]} sub={verdict}>
        {t.lastSync && !syncFailed && <div className="synced">Synced {time(t.lastSync.at)}</div>}
      </Hero>
      <Signals
        hrv7={ready.hrv7}
        hrvNormal={ready.normal}
        last={t.lastNight}
        rhr={rhrNormal(t.nights, t.date)}
        tsb={t.tsb}
      />
      <Workout event={t.workout} notes={t.notes} ftp={t.ftp} />
      <Volume weeks={t.volume} href="/training" />
      <HrvList date={t.date} nights={t.nights} normal={ready.normal} />
      {/* The COROS card only when something needs you: not connected, or the sync broke. */}
      {(!t.corosConnected || syncFailed) && <CorosCard lastSync={t.lastSync} />}
    </Sky>
  );
}
