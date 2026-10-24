import { addDays } from "@/lib/date";
import { hmm } from "@/lib/format";
import { loadHealth, TAGS } from "@/lib/health";
import { mean, midpointSpreadMin, SLEEP_NEED_SECS } from "@/lib/readiness";
import { Bars, Line } from "../charts";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { Delta, Module } from "../ui";
import { saveWeight, toggleTag } from "./actions";

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? mean(v) : undefined;
};
const STRESS_WORD = (v: number) =>
  v <= 25 ? "relaxed" : v <= 50 ? "low" : v <= 75 ? "medium" : "high";

export default async function HealthPage() {
  const h = await loadHealth();
  const { nights, ready, lastNight: last } = h;
  const recent = (days: number) => nights.filter((n) => n.date > addDays(h.date, -days));
  const sleep7 = avg(recent(7).map((n) => n.asleepSecs));
  const spread = midpointSpreadMin(recent(7));
  const series = (days: number, key: "hrv" | "rhr" | "stress" | "asleepSecs") =>
    recent(days).flatMap((n) => (n[key] == null ? [] : [{ date: n.date, value: n[key] }]));
  const hrvMid = ready.normal && Math.sqrt(ready.normal.low * ready.normal.high);
  const rhrMid = h.rhr && (h.rhr.low + h.rhr.high) / 2;
  const sub = !ready.normal
    ? `Learning your normal · ${ready.nights} of 14 nights`
    : !ready.hrv7
      ? "Too few nights this week"
      : ready.hrv7 < ready.normal.low
        ? "7-night HRV below normal"
        : "7-night HRV in normal";

  return (
    <Sky state={ready.state}>
      <Hero place="Health" word={ready.hrv7 ? `${Math.round(ready.hrv7)} ms` : "–"} sub={sub}>
        <div className="verdict">{sub}</div>
      </Hero>

      <Module
        title="Tag last night"
        info={
          <p>
            Tags apply to the night that ended this morning. Tagged nights stay out of your HRV
            normal, so a few bad nights don't drag your baseline down.
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
            label="Sleep per night, last 30 nights"
          />
          {last?.deepPct != null && (
            <div
              className="stages labelled"
              role="img"
              aria-label={`Last night: deep ${last.deepPct}%, light ${last.lightPct}%, REM ${last.remPct}%`}
            >
              <i style={{ flex: last.deepPct, background: "#5b4bd6" }}>Deep {last.deepPct}</i>
              <i style={{ flex: last.lightPct ?? 0, background: "var(--sleep)" }}>
                Light {last.lightPct}
              </i>
              <i style={{ flex: last.remPct ?? 0, background: "#d9a6ff" }}>REM {last.remPct}</i>
            </div>
          )}
          {spread !== undefined && <div className="caption num">±{spread} min bedtime</div>}
        </div>
      </Module>

      <Module
        title="HRV · 60 nights"
        value={
          last?.hrv ? (
            <>
              {Math.round(last.hrv)} ms{" "}
              <Delta v={hrvMid ? last.hrv - hrvMid : undefined} good="up" />
            </>
          ) : undefined
        }
        info={
          <p>
            Overnight heart-rate variability. The band is your normal
            {ready.normal
              ? ` (${Math.round(ready.normal.low)}–${Math.round(ready.normal.high)} ms)`
              : ", after 14 nights"}
            . Single nights swing; readiness uses the 7-night average.
          </p>
        }
      >
        <div className="mod-b">
          <Line
            points={series(60, "hrv")}
            color="var(--hrv)"
            band={ready.normal}
            label="Overnight HRV"
            unit="ms"
          />
        </div>
      </Module>

      <Module
        title="Resting HR · 60 nights"
        value={
          last?.rhr ? (
            <>
              {last.rhr} bpm <Delta v={rhrMid ? last.rhr - rhrMid : undefined} good="down" />
            </>
          ) : undefined
        }
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
            <Line points={h.weights} color="#fff" label="Weight" unit="kg" />
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
