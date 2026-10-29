import { addDays } from "@/lib/date";
import { hmm, signed } from "@/lib/format";
import { loadHealth, TAGS } from "@/lib/health";
import {
  bedtimeWord,
  HRV_TONE,
  hrvStatus,
  MIN_NIGHTS,
  MIN_TAGGED,
  mean,
  midpointSpreadMin,
  rhrWord,
  SLEEP_NEED_SECS,
  sleepWord,
} from "@/lib/readiness";
import { MIN_EVENTS, type recoveryResponse, SOLID_NIGHTS } from "@/lib/recovery";
import { Bars, Line } from "../charts";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { HrvWeek, NightBar, nightInfo } from "../Today";
import { Delta, Module } from "../ui";
import { Views } from "../Views";
import { saveWeight, toggleTag } from "./actions";

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? mean(v) : undefined;
};
const STRESS_WORD = (v: number) =>
  v <= 25 ? "relaxed" : v <= 50 ? "low" : v <= 75 ? "medium" : "high";

/** Your HRV after big days, night by night. Hidden until 5 big days: an empty card says nothing. */
function Recovery({ r }: { r: ReturnType<typeof recoveryResponse> }) {
  if (r.events < MIN_EVENTS || r.nights === undefined) return null;
  const nights = (n: number) => (n > r.profile.length ? `${r.profile.length}+` : String(n));
  return (
    <Module
      title="Recovery response"
      value={`≈ ${nights(r.nights as number)} nights`}
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
      </div>
    </Module>
  );
}

type Row = {
  label: string;
  value: string | React.ReactNode;
  word?: { word: string; tone: string };
};

/** Oura's contributors: what sits behind today's readiness, one line each with its state word. */
function Why({ rows }: { rows: Row[] }) {
  return (
    <Module title="What's behind it">
      <ul className="why" id="why">
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <span className="num">{r.value}</span>
            <span className={`signal-word ${r.word?.tone ?? ""}`}>{r.word?.word ?? "No data"}</span>
          </li>
        ))}
      </ul>
    </Module>
  );
}

export default async function HealthPage() {
  const h = await loadHealth();
  const { nights, ready, lastNight: last } = h;
  const recent = (days: number) => nights.filter((n) => n.date > addDays(h.date, -days));
  const sleep7 = avg(recent(7).map((n) => n.asleepSecs));
  const spread = midpointSpreadMin(recent(7));
  const series = (days: number, key: "hrv" | "rhr" | "stress" | "asleepSecs") =>
    recent(days).flatMap((n) => (n[key] == null ? [] : [{ date: n.date, value: n[key] }]));
  const sub = !ready.normal
    ? `Learning your normal · ${ready.nights} of ${MIN_NIGHTS} nights`
    : !ready.hrv7
      ? "Too few nights this week"
      : `7-night HRV · ${hrvStatus(ready.hrv7, ready.normal)}`;

  return (
    <Sky state={ready.state}>
      <Hero
        place="Health"
        word={ready.hrv7 ? `${Math.round(ready.hrv7)} ms` : "–"}
        sub={sub}
      ></Hero>

      <Why
        rows={[
          {
            label: "HRV last night",
            value: last?.hrv ? `${Math.round(last.hrv)} ms` : "–",
            word:
              last?.hrv && ready.normal
                ? (() => {
                    const word = hrvStatus(last.hrv, ready.normal);
                    return { word, tone: HRV_TONE[word] };
                  })()
                : undefined,
          },
          {
            label: "Resting HR",
            value: last?.rhr ? `${last.rhr} bpm` : "–",
            word: rhrWord(last?.rhr, h.rhr),
          },
          {
            label: "Sleep",
            value: last?.asleepSecs ? hmm(last.asleepSecs) : "–",
            word: sleepWord(last?.asleepSecs),
          },
          {
            label: "Bedtime, 7 nights",
            value: spread !== undefined ? `±${spread} min` : "–",
            word: bedtimeWord(spread),
          },
          {
            label: "Load trend",
            value: h.trend ? `${h.trend.pct} %` : "–",
            word: h.trend && { word: h.trend.zone, tone: h.trend.state },
          },
        ]}
      />

      <Module
        title="HRV"
        info={
          ready.normal ? (
            <>
              {nightInfo(ready.normal, ready.hrv7)}
              <p>
                7 nights: each bar is one night low to high (10th–90th percentile), the dot its
                average. ● marks a tagged night. 2 months: the nightly average on your normal band.
              </p>
            </>
          ) : (
            <p>Overnight heart-rate variability. Your normal appears after {MIN_NIGHTS} nights.</p>
          )
        }
      >
        <div className="mod-b">
          <Views labels={["Last night", "7 nights", "2 months"]}>
            {last?.hrv && ready.normal ? (
              <NightBar hrv={last.hrv} hrv7={ready.hrv7} normal={ready.normal} />
            ) : (
              <p className="dim">No HRV last night.</p>
            )}
            <HrvWeek date={h.date} nights={nights} normal={ready.normal} />
            <Line
              points={series(60, "hrv")}
              color="var(--hrv)"
              band={ready.normal}
              label="Overnight HRV"
              unit="ms"
            />
          </Views>
        </div>
      </Module>

      <Recovery r={h.recovery} />

      <Module
        title="Tag last night"
        info={
          <p>
            Tags apply to the night that ended this morning. Tagged nights stay out of your HRV
            normal, so a few bad nights don't drag your baseline down. From {MIN_TAGGED} tagged
            nights, each tag shows its HRV against untagged nights (no adjustment for training).
          </p>
        }
      >
        <div className="mod-b">
          <div className="chips start">
            {TAGS.map((kind) => (
              <form key={kind} action={toggleTag}>
                <input type="hidden" name="date" value={h.date} />
                <input type="hidden" name="kind" value={kind} />
                <button
                  type="submit"
                  className={`chip${h.lastTags.includes(kind) ? " flag" : ""}`}
                  aria-pressed={h.lastTags.includes(kind)}
                >
                  {kind}
                </button>
              </form>
            ))}
          </div>
          {h.tagEffects.length > 0 && (
            <ul className="why tag-effects">
              {h.tagEffects.map((e) => (
                <li key={e.kind}>
                  <span>{e.kind[0]?.toUpperCase() + e.kind.slice(1)}</span>
                  <span className="num dim">
                    {e.n} nights{e.early ? " · early" : ""}
                  </span>
                  <span
                    className={`signal-word ${e.pct <= -10 ? "stop" : e.pct < 0 ? "mid" : "go"}`}
                  >
                    HRV {e.pct > 0 ? "+" : ""}
                    {e.pct} %
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Module>

      <Module
        title="Sleep · 30 nights"
        value={
          <>
            {sleep7 ? hmm(sleep7) : "–"}{" "}
            <Delta v={sleep7 ? (sleep7 - SLEEP_NEED_SECS) / 60 : undefined} good="up" unit="′" />
          </>
        }
        info={
          <>
            <p>
              Bars: time asleep per night; the dashed line is your 8 h 30 need. The header shows
              your 7-night average and how far it is from that need.
            </p>
            <p>
              Bedtime spread: how much your sleep midpoint moved over 7 nights. Lower is more
              regular.
            </p>
            {last?.sleepScore != null && <p>COROS sleep score last night: {last.sleepScore}.</p>}
            <p>Stages are wrist estimates: treat them as rough.</p>
          </>
        }
      >
        <div className="mod-b">
          <Bars
            points={series(30, "asleepSecs")}
            color="var(--sleep)"
            target={SLEEP_NEED_SECS}
            format={hmm}
            label="Sleep per night, last 30 nights"
          />
          {last?.deepPct != null && (
            <div
              className="stages labelled"
              role="img"
              aria-label={`Last night: deep ${last.deepPct}%, light ${last.lightPct}%, REM ${last.remPct}%`}
            >
              {(
                [
                  ["Deep", last.deepPct, "#5b4bd6"],
                  ["Light", last.lightPct, "var(--sleep)"],
                  ["REM", last.remPct, "#d9a6ff"],
                ] as const
              ).map(([name, pct, bg]) => (
                // Full label when it fits, the number alone on a narrow segment, nothing on a sliver.
                <i key={name} style={{ flex: pct ?? 0, background: bg }}>
                  {(pct ?? 0) >= 18 ? `${name} ${pct}` : (pct ?? 0) >= 8 ? pct : ""}
                </i>
              ))}
            </div>
          )}
          {spread !== undefined && <div className="caption num">±{spread} min bedtime</div>}
        </div>
      </Module>

      <Module
        title="Resting HR · 60 nights"
        info={
          <p>
            Your lowest heart rate while asleep each night
            {last?.corosRhr ? ` (COROS's own figure: ${last.corosRhr} bpm)` : ""}. The band is your
            normal{h.rhr ? `, ${h.rhr.low}–${h.rhr.high} bpm` : ", after 14 nights"}.
          </p>
        }
      >
        <div className="mod-b">
          <Line
            points={series(60, "rhr")}
            color="var(--rhr)"
            band={h.rhr}
            label="Resting heart rate"
            unit="bpm"
          />
        </div>
      </Module>

      <Module
        title="Stress · 30 days"
        value={last?.stress != null ? `${last.stress} · ${STRESS_WORD(last.stress)}` : undefined}
        info={
          <p>
            COROS daily average, 0–100, worked out from your heart-rate variability through the day.
            Not part of readiness, since it repeats HRV.
          </p>
        }
      >
        <div className="mod-b">
          <Bars
            points={series(30, "stress")}
            color="var(--stress)"
            label="COROS daily average stress, last 30 days"
          />
        </div>
      </Module>

      <Module title="Weight" value={h.weight ? `${h.weight.toFixed(1)} kg` : "–"}>
        <div className="mod-b">
          {h.weights.length > 1 && (
            <Line
              points={h.weights}
              color="#fff"
              label="Weight"
              unit="kg"
              format={(v) => v.toFixed(1)}
            />
          )}
          <details className="more add">
            <summary>+ Log today</summary>
            <form action={saveWeight} className="inline">
              <input
                name="kg"
                inputMode="decimal"
                pattern="\d{2,3}([.,]\d{1,2})?"
                title="Weight in kg, like 67.4"
                placeholder="kg"
                aria-label="Today's weight in kg"
                className="field"
                required
              />
              <button type="submit" className="btn">
                Save
              </button>
            </form>
          </details>
        </div>
      </Module>
    </Sky>
  );
}
