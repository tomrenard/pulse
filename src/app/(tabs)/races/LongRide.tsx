"use client";

import { useState } from "react";
import { hm } from "@/lib/format";
import { rideTime, type Stretch, stretches } from "@/lib/races";

/** GPX route + target power → moving time, with your own stop time on top. Runs on the phone. */
export function LongRide({ ftp, kg }: { ftp?: number; kg?: number }) {
  const [route, setRoute] = useState<{ name: string; stretches: Stretch[] } | null>(null);
  const [error, setError] = useState("");
  const [watts, setWatts] = useState(Math.round((ftp ?? 220) * 0.65));
  const [gravel, setGravel] = useState(true);
  const [stops, setStops] = useState(2);

  async function load(file: File) {
    const doc = new DOMParser().parseFromString(await file.text(), "application/xml");
    const pts = [...doc.querySelectorAll("trkpt, rtept")].map(
      (p) =>
        [
          Number(p.getAttribute("lat")),
          Number(p.getAttribute("lon")),
          Number(p.querySelector("ele")?.textContent ?? 0),
        ] as [number, number, number],
    );
    if (pts.length < 2) {
      setError("No track points found in that file.");
      return;
    }
    setError("");
    setRoute({ name: file.name.replace(/\.gpx$/i, ""), stretches: stretches(pts) });
  }

  const est =
    route &&
    rideTime(route.stretches, {
      watts,
      kg: (kg ?? 68) + (gravel ? 11 : 9), // rider + bike, bottles, bags
      cda: gravel ? 0.34 : 0.3,
      crr: gravel ? 0.008 : 0.004,
    });

  return (
    <>
      <label className="field file">
        {route ? route.name : "Choose a GPX route"}
        <input
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
        />
      </label>
      {error && <p className="err">{error}</p>}
      <label className="slider">
        <span>
          Target power <b className="num">{watts} W</b>
          {ftp ? (
            <span className="dim">
              {" "}
              · {Math.round((watts / ftp) * 100)}% of FTP {ftp}
            </span>
          ) : null}
        </span>
        <input
          type="range"
          min={100}
          max={350}
          step={5}
          value={watts}
          onChange={(e) => setWatts(Number(e.target.value))}
        />
      </label>
      <label className="slider">
        <span>
          Stops <b className="num">{stops} h</b>
        </span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.5}
          value={stops}
          onChange={(e) => setStops(Number(e.target.value))}
        />
      </label>
      <fieldset className="seg-ctl" style={{ marginLeft: 0 }} aria-label="Surface">
        <button type="button" aria-pressed={gravel} onClick={() => setGravel(true)}>
          Gravel
        </button>
        <button type="button" aria-pressed={!gravel} onClick={() => setGravel(false)}>
          Road
        </button>
      </fieldset>
      {est && (
        <div className="stats num" style={{ marginTop: 12 }}>
          <span>
            <b>{hm(est.secs)}</b>moving
          </span>
          <span>
            <b>{hm(est.secs + stops * 3600)}</b>with stops
          </span>
          <span>
            <b>{((est.metres / est.secs) * 3.6).toFixed(1)}</b>km/h moving
          </span>
          <span>
            <b>{Math.round(est.metres / 1000)} km</b>
            {Math.round(est.climb)} m up
          </span>
        </div>
      )}
      <p className="say dim">
        Steady power, physics only:{" "}
        {gravel ? "gravel (rolling resistance 0.008, CdA 0.34)" : "road (0.004, CdA 0.30)"},{" "}
        {kg ? "your weight" : "an assumed 68 kg"} + bike and bags, descents capped at 55 km/h. No
        wind, no fatigue: over many hours you'll likely hold less power than you plan.
      </p>
    </>
  );
}
