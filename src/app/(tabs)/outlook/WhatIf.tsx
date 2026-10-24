"use client";

import { useState } from "react";
import { clampCtl, formPct, type PowerFit, powerAt, projectFitness } from "@/lib/outlook";
import { Forecast } from "../charts";

type Rate = { rate: number; typical: boolean };

/** Sliders for weekly riding and running → fitness, form and typical 20-min power at the end. */
export function WhatIf({
  date,
  ctl,
  atl,
  rideCtl,
  ride: rideRate,
  run: runRate,
  fit,
}: {
  date: string;
  ctl: number;
  atl: number;
  rideCtl: number;
  ride: Rate;
  run: Rate;
  fit?: PowerFit;
}) {
  const [ride, setRide] = useState(6);
  const [run, setRun] = useState(1);
  const [weeks, setWeeks] = useState(8);
  const days = weeks * 7;
  const daily = (ride * rideRate.rate + run * runRate.rate) / 7;
  const path = projectFitness(date, ctl, atl, Array(days).fill(daily));
  const end = path.at(-1);
  const rideLoads = Array(days).fill((ride * rideRate.rate) / 7);
  const rideEnd = projectFitness(date, rideCtl, rideCtl, rideLoads).at(-1)?.ctl ?? 0;
  const power = fit && powerAt(fit, rideEnd);
  const rate = (r: Rate, sport: string) =>
    r.typical
      ? `a typical ${Math.round(r.rate)} load/h ${sport} (too little recent ${sport} to use yours)`
      : `your recent ${Math.round(r.rate)} load/h ${sport}`;

  const slider = (
    label: string,
    value: number,
    set: (v: number) => void,
    [min, max, step]: [number, number, number],
    unit: string,
  ) => (
    <label className="slider">
      <span>
        {label}{" "}
        <b className="num">
          {value} {unit}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );

  return (
    <>
      {slider("Riding", ride, setRide, [0, 20, 0.5], "h/week")}
      {slider("Running", run, setRun, [0, 10, 0.5], "h/week")}
      {slider("For", weeks, setWeeks, [1, 16, 1], weeks === 1 ? "week" : "weeks")}
      <Forecast days={path} />
      {end && (
        <div className="stats num">
          <span>
            <b>{Math.round(end.ctl)}</b>fitness
          </span>
          <span>
            <b>{Math.round(formPct(end))}%</b>form
          </span>
          {power && fit && (
            <span>
              <b>
                {Math.round(power * (1 - fit.p80))}–{Math.round(power * (1 + fit.p80))} W
              </b>
              typical 20-min
            </span>
          )}
        </div>
      )}
      <p className="say dim">
        A scenario, not a forecast: it assumes you do exactly this, at {rate(rideRate, "riding")}{" "}
        and {rate(runRate, "running")}.
        {power && fit
          ? ` The 20-min range is what you typically rode at ride fitness ${Math.round(clampCtl(fit, rideEnd))} in your history (8 of 10 weeks inside it), not a test result.`
          : ""}
        {fit && rideEnd > fit.maxCtl
          ? ` You haven't been above ride fitness ${Math.round(fit.maxCtl)}, so power is shown there.`
          : fit && rideEnd < fit.minCtl
            ? ` You haven't been below ride fitness ${Math.round(fit.minCtl)}, so power is shown there.`
            : ""}
      </p>
    </>
  );
}
