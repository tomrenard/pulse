import { notFound } from "next/navigation";
import { shortDate } from "@/lib/date";
import { clock, hm } from "@/lib/format";
import { activity as icuActivity } from "@/lib/intervals";
import { orNothing } from "@/lib/nights";
import { type Activity, zoneTotals } from "@/lib/training";
import { Zones } from "../../charts";
import { Hero } from "../../Hero";
import { Sky } from "../../Sky";
import { Module } from "../../ui";
import { RouteMap } from "./RouteMap";

type Stream = { type: string; data?: number[]; data2?: number[] };
type Lap = {
  moving_time?: number;
  distance?: number;
  average_watts?: number;
  average_heartrate?: number;
  label?: string;
};

/** One activity: stats, route on a map, laps and zones. */
export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^i?\d+$/.test(id)) notFound();
  const [activity, streams, laps] = await Promise.all([
    // No fallback: an outage should show the error page, not "not found".
    icuActivity<Activity>(id).catch((e: Error) =>
      e.message.includes(" 404") ? undefined : Promise.reject(e),
    ),
    orNothing(icuActivity<Stream[]>(id, "/streams.json?types=latlng"), []),
    orNothing(icuActivity<{ icu_intervals?: Lap[] }>(id, "/intervals"), {}),
  ]);
  if (!activity) notFound();
  const ll = streams.find((s) => s.type === "latlng");
  // Every 10th point is plenty for a phone-sized map.
  const line = (ll?.data ?? [])
    .map((lat, i) => [ll?.data2?.[i] as number, lat] as [number, number])
    .filter(
      (p, i, all) =>
        (i % 10 === 0 || i === all.length - 1) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    );
  const zones = zoneTotals([activity]);
  const lapsList = (laps.icu_intervals ?? []).filter((l) => l.moving_time);
  const date = shortDate(activity.start_date_local, true);
  return (
    <Sky state="go">
      <Hero
        place={date}
        word={hm(activity.moving_time).replace(" ", "")}
        sub={activity.name ?? activity.type ?? ""}
      >
        <div className="cond">{activity.name ?? activity.type}</div>
        <div className="hl num">
          {activity.distance ? `${(activity.distance / 1000).toFixed(1)} km` : ""}
          {activity.total_elevation_gain ? (
            <span> · {Math.round(activity.total_elevation_gain)} m up</span>
          ) : null}
          {activity.icu_training_load ? <span> · load {activity.icu_training_load}</span> : null}
        </div>
      </Hero>

      {line.length > 1 && (
        <section className="mod map-mod" aria-label="Route">
          <RouteMap line={line} />
        </section>
      )}

      <Module title="Effort">
        <div className="mod-b stats num">
          {activity.icu_weighted_avg_watts ? (
            <span>
              <b>{activity.icu_weighted_avg_watts} W</b>normalised power
            </span>
          ) : null}
          {activity.average_heartrate ? (
            <span>
              <b>{Math.round(activity.average_heartrate)}</b>avg HR
            </span>
          ) : null}
          {activity.distance && activity.moving_time ? (
            <span>
              <b>{((activity.distance / activity.moving_time) * 3.6).toFixed(1)}</b>km/h
            </span>
          ) : null}
        </div>
      </Module>

      {lapsList.length > 1 && (
        <Module title="Laps">
          <table className="records num">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Time</th>
                <th scope="col">km</th>
                <th scope="col">W</th>
                <th scope="col">HR</th>
              </tr>
            </thead>
            <tbody>
              {lapsList.map((l, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: laps are in a fixed order
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  <td>{clock(l.moving_time)}</td>
                  <td>{l.distance ? (l.distance / 1000).toFixed(1) : "–"}</td>
                  <td>{l.average_watts ?? "–"}</td>
                  <td>{l.average_heartrate ? Math.round(l.average_heartrate) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Module>
      )}

      {(zones.power.some(Boolean) || zones.hr.some(Boolean)) && (
        <Module title="Zones">
          <div className="mod-b">
            <Zones secs={zones.power} label="Power" />
            <Zones secs={zones.hr} label="Heart rate" />
          </div>
        </Module>
      )}
    </Sky>
  );
}
