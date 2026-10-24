import { after } from "next/server";
import { syncCoros } from "@/lib/coros/sync";
import { MIN_NIGHTS, midpointSpreadMin, WORD } from "@/lib/readiness";
import { loadToday } from "@/lib/today";
import { CorosCard } from "./CorosCard";
import { Hero } from "./Hero";
import { Sky } from "./Sky";
import { FormTile, HrvList, PlanStrip, RhrTile, SleepTile, StressTile, Workout } from "./Today";
import { hm } from "./ui";
import { Volume } from "./Volume";

/** Opening the app before the 09:00 UTC cron pulls last night, at most every 20 minutes. */
const PULL_AFTER_MS = 20 * 60 * 1000;

export const maxDuration = 60;

export default async function TodayPage() {
  const t = await loadToday();
  if (!t.lastNight?.hrv && (!t.lastSync || Date.now() - t.lastSync.at.getTime() > PULL_AFTER_MS)) {
    after(() => syncCoros().catch(() => {})); // failures are logged and shown on the COROS card
  }
  const { ready } = t;
  const word = WORD[ready.state];
  const place = `Today · ${new Date(`${t.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;
  const cond = ready.stale
    ? "Too few nights this week to judge"
    : ready.state === "building"
      ? `Building your baseline · ${ready.nights} of ${MIN_NIGHTS} nights`
      : `${ready.reasons[0]?.label} · slept ${hm(t.lastNight?.asleepSecs)}`;
  const spread = midpointSpreadMin(t.nights.slice(-7));
  return (
    <Sky state={ready.state}>
      <Hero
        place={place}
        word={word}
        sub={ready.hrv7 ? `HRV ${Math.round(ready.hrv7)} ms · 7-night` : cond}
      >
        <div className="cond">{cond}</div>
        <div className="hl num">
          RHR {t.lastNight?.rhr ?? "–"} <span>·</span> Form{" "}
          {t.tsb === undefined ? "–" : Math.round(t.tsb)}
          {ready.provisional && ready.state !== "building" ? <span> · provisional</span> : null}
        </div>
        {ready.reasons.length > 0 && (
          <div className="chips">
            {ready.reasons.map((r) => (
              <span key={r.key} className={`chip${r.flag ? " flag" : ""}`}>
                {r.label}
              </span>
            ))}
          </div>
        )}
      </Hero>
      <Volume weeks={t.volume} />
      <PlanStrip date={t.date} plan={t.plan} />
      <Workout
        event={t.plan.find(
          (e) => e.start_date_local.startsWith(t.date) && e.category === "WORKOUT",
        )}
        notes={t.notes}
        ftp={t.ftp}
      />
      <HrvList date={t.date} nights={t.nights} normal={ready.normal} />
      <div className="tiles">
        <SleepTile nights={t.nights} last={t.lastNight} spread={spread} />
        <RhrTile nights={t.nights} last={t.lastNight} date={t.date} />
        <StressTile last={t.lastNight} />
        <FormTile ctl={t.ctl} atl={t.atl} tsb={t.tsb} />
      </div>
      <CorosCard lastSync={t.lastSync} />
    </Sky>
  );
}
