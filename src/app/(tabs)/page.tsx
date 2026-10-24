import { after } from "next/server";
import { syncCoros } from "@/lib/coros/sync";
import { midpointSpreadMin, SLEEP_NEED_SECS, WORD } from "@/lib/readiness";
import { loadToday } from "@/lib/today";
import { CorosCard } from "./CorosCard";
import { Hero } from "./Hero";
import { Sky } from "./Sky";
import { FormTile, HrvList, hm, PlanStrip, RhrTile, SleepTile, StressTile, Workout } from "./Today";

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
  const cond =
    ready.state === "building"
      ? `Building your baseline · ${ready.nights} of 14 nights`
      : `${ready.reasons[0]?.label} · slept ${hm(t.lastNight?.asleepSecs)}`;
  const spread = midpointSpreadMin(
    t.nights
      .slice(-7)
      .filter((n) => n.sleepStart && n.sleepEnd)
      .map((n) => ({ start: n.sleepStart as string, end: n.sleepEnd as string })),
  );
  return (
    <Sky state={ready.state}>
      <Hero
        place={place}
        word={word}
        sub={"hrv7" in ready && ready.hrv7 ? `HRV ${Math.round(ready.hrv7)} ms · 7-night` : cond}
      >
        <div className="cond">{cond}</div>
        <div className="hl num">
          RHR {t.lastNight?.rhr ?? "–"} <span>·</span> Form{" "}
          {t.tsb === undefined ? "–" : Math.round(t.tsb)}
          {"provisional" in ready && ready.provisional ? <span> · provisional</span> : null}
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
      <PlanStrip date={t.date} plan={t.plan} />
      <Workout
        event={t.plan.find(
          (e) => e.start_date_local.startsWith(t.date) && e.category === "WORKOUT",
        )}
        notes={t.notes}
        ftp={t.ftp}
      />
      <HrvList nights={t.nights} normal={"normal" in ready ? ready.normal : undefined} />
      <div className="tiles">
        <SleepTile nights={t.nights} needSecs={SLEEP_NEED_SECS} spread={spread} />
        <RhrTile nights={t.nights} />
        <StressTile nights={t.nights} />
        <FormTile ctl={t.ctl} atl={t.atl} tsb={t.tsb} />
      </div>
      <CorosCard />
    </Sky>
  );
}
