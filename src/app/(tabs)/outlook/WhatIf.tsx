"use client";

import { useState } from "react";
import { type PowerFit, powerAt, projectFitness } from "@/lib/outlook";
import { FitnessChart } from "../FitnessChart";

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
  race,
}: {
  date: string;
  ctl: number;
  atl: number;
  rideCtl: number;
  ride: Rate;
  run: Rate;
  fit?: PowerFit;
  /** The next race, marked on the chart when the sliders reach it. */
  race?: { date: string; target?: { low: number; high: number } };
}) {
  const [ride, setRide] = useState(6);
  const [run, setRun] = useState(1);
  const [weeks, setWeeks] = useState(8);
  const days = weeks * 7;
  const daily = (ride * rideRate.rate + run * runRate.rate) / 7;
  const path = projectFitness(date, ctl, atl, Array(days).fill(daily));
  const rideLoads = Array(days).fill((ride * rideRate.rate) / 7);
  const rideEnd = projectFitness(date, rideCtl, rideCtl, rideLoads).at(-1)?.ctl ?? 0;
  const power = fit && powerAt(fit, rideEnd);

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
      {slider("Ride", ride, setRide, [0, 20, 0.5], "h/wk")}
      {slider("Run", run, setRun, [0, 10, 0.5], "h/wk")}
      {slider("For", weeks, setWeeks, [1, 16, 1], weeks === 1 ? "week" : "weeks")}
      <FitnessChart
        days={path}
        race={race}
        endLabel={`In ${weeks} ${weeks === 1 ? "week" : "weeks"}`}
      />
      {power && fit && (
        <div className="stats num">
          <span>
            <b>
              {Math.round(power * (1 - fit.p80))}–{Math.round(power * (1 + fit.p80))} W
            </b>
            typical 20-min power then
          </span>
        </div>
      )}
    </>
  );
}
