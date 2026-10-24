import { addDays } from "@/lib/date";
import { loadHealth, TAGS } from "@/lib/health";
import { mean, midpointSpreadMin, SLEEP_NEED_SECS } from "@/lib/readiness";
import { Bars, Line } from "../charts";
import { Hero } from "../Hero";
import { Sky } from "../Sky";
import { hm, Module } from "../ui";
import { saveWeight, toggleTag } from "./actions";

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? mean(v) : undefined;
};

export default async function HealthPage() {
  const h = await loadHealth();
  const { nights, ready, lastNight: last } = h;
  const recent = (days: number) => nights.filter((n) => n.date > addDays(h.date, -days));
  const sleep7 = avg(recent(7).map((n) => n.asleepSecs));
  const sleep30 = avg(recent(30).map((n) => n.asleepSecs));
  const spread = midpointSpreadMin(recent(7));
  const series = (days: number, key: "hrv" | "rhr" | "stress" | "asleepSecs") =>
    recent(days).flatMap((n) => (n[key] == null ? [] : [{ date: n.date, value: n[key] }]));
  const hrvState = !ready.normal
    ? `Normal after 14 nights · ${ready.nights} so far`
    : !ready.hrv7
      ? "Too few nights this week to judge"
      : ready.hrv7 < ready.normal.low
        ? "7-night HRV below your normal"
        : "7-night HRV in your normal";

  return (
    <Sky state={ready.state}>
      <Hero place="Health" word={ready.hrv7 ? `${Math.round(ready.hrv7)} ms` : "–"} sub={hrvState}>
        <div className="cond">{hrvState}</div>
        <div className="hl num">
          Sleep {hm(sleep7)} <span>avg</span> · RHR {last?.rhr ?? "–"}
        </div>
      </Hero>

      <Module title="Tag last night">
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
          <p className="say dim">
            The night that ended this morning. Tagged nights stay out of your HRV normal.
          </p>
        </div>
      </Module>

      <Module title="Sleep">
        <div className="mod-b">
          <div className="stats num">
            <span>
              <b>{hm(sleep7)}</b>7-night
            </span>
            <span>
              <b>{hm(sleep30)}</b>30-night
            </span>
            <span>
              <b>{spread === undefined ? "–" : `${spread} min`}</b>bedtime spread
            </span>
          </div>
          <Bars
            points={series(30, "asleepSecs")}
            color="var(--sleep)"
            target={SLEEP_NEED_SECS}
            label="Sleep per night, last 30 nights, dashed line at your 8 h 30 need"
          />
          {last?.deepPct != null && (
            <>
              <div className="stages" aria-hidden="true">
                <i style={{ flex: last.deepPct, background: "#5b4bd6" }} />
                <i style={{ flex: last.lightPct ?? 0, background: "var(--sleep)" }} />
                <i style={{ flex: last.remPct ?? 0, background: "#d9a6ff" }} />
                <i
                  style={{
                    flex: 100 - (last.deepPct + (last.lightPct ?? 0) + (last.remPct ?? 0)),
                    background: "rgba(255,255,255,.3)",
                  }}
                />
              </div>
              <p className="say dim">
                Last night (estimate): deep {last.deepPct}%, light {last.lightPct}%, REM{" "}
                {last.remPct}%, awake {last.awakeMin} min. COROS sleep score{" "}
                {last.sleepScore ?? "–"}.
              </p>
            </>
          )}
        </div>
      </Module>

      <Module title="HRV · 60 nights">
        <div className="mod-b">
          <Line
            points={series(60, "hrv")}
            color="var(--hrv)"
            band={ready.normal}
            label="Overnight HRV"
            unit="ms"
          />
          <p className="say dim">
            {ready.normal
              ? `Band: your normal, ${Math.round(ready.normal.low)}–${Math.round(ready.normal.high)} ms. Single nights swing; the 7-night average decides.`
              : "Your normal appears after 14 nights."}
          </p>
        </div>
      </Module>

      <Module title="Resting HR · 60 nights">
        <div className="mod-b">
          <Line
            points={series(60, "rhr")}
            color="var(--rhr)"
            band={h.rhr}
            label="Resting heart rate"
            unit="bpm"
          />
          <p className="say dim">
            {h.rhr
              ? `Band: your normal, ${h.rhr.low}–${h.rhr.high} bpm.`
              : "Your normal appears after 14 nights."}
          </p>
        </div>
      </Module>

      <Module title="Stress · 30 days">
        <div className="mod-b">
          <Bars
            points={series(30, "stress")}
            color="var(--stress)"
            label="COROS daily average stress, last 30 days"
          />
          <p className="say dim">
            COROS daily average, 0–100, from HRV through the day. Not part of readiness.
          </p>
        </div>
      </Module>

      <Module title="Weight">
        <div className="mod-b">
          <div className="stats num">
            <span>
              <b>{h.weight ? `${h.weight.toFixed(1)} kg` : "–"}</b>latest
            </span>
          </div>
          {h.weights.length > 1 && (
            <Line points={h.weights} color="#fff" label="Weight" unit="kg" />
          )}
          <form action={saveWeight} className="inline">
            <input
              name="kg"
              inputMode="decimal"
              pattern="\d{2,3}([.,]\d{1,2})?"
              title="Weight in kg, like 67.4"
              placeholder="Today, kg"
              aria-label="Today's weight in kg"
              className="field"
              required
            />
            <button type="submit" className="btn">
              Save
            </button>
          </form>
        </div>
      </Module>
    </Sky>
  );
}
