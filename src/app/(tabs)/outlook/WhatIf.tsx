"use client";

import { useState } from "react";
import { formPct, projectFitness } from "@/lib/outlook";
import { Forecast } from "../charts";

type Fit = { a: number; b: number; p80: number; minCtl: number; maxCtl: number };

/** Sliders for weekly riding and running → fitness, form and typical 20-min power at the end. */
export function WhatIf({
  date,
  ctl,
  atl,
  rideCtl,
  rideRate,
  runRate,
  fit,
}: {
  date: string;
  ctl: number;
  atl: number;
  rideCtl: number;
  rideRate: number;
  runRate: number;
  fit?: Fit;
}) {
  const [ride, setRide] = useState(6);
  const [run, setRun] = useState(1);
  const [weeks, setWeeks] = useState(8);
  const days = weeks * 7;
  const daily = (ride * rideRate + run * runRate) / 7;
  const path = projectFitness(date, ctl, atl, Array(days).fill(daily));
  const end = path.at(-1);
  const rideEnd =
    projectFitness(date, rideCtl, rideCtl, Array(days).fill((ride * rideRate) / 7)).at(-1)?.ctl ??
    0;
  const clamped = fit ? Math.min(fit.maxCtl, Math.max(fit.minCtl, rideEnd)) : 0;
  const power = fit ? fit.a + fit.b * clamped : undefined;

  const slider = (
    label: string,
    value: number,
    set: (v: number) => void,
    max: number,
    step: number,
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
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );

  return (
    <>
      {slider("Riding", ride, setRide, 20, 0.5, "h/week")}
      {slider("Running", run, setRun, 10, 0.5, "h/week")}
      {slider("For", weeks, (v) => setWeeks(Math.max(1, v)), 16, 1, "weeks")}
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
        A scenario, not a forecast: it assumes you do exactly this, at your recent{" "}
        {Math.round(rideRate)} load/h riding and {Math.round(runRate)} load/h running.
        {power && fit
          ? ` The 20-min range is what you typically rode at ride fitness ${Math.round(clamped)} in your 2025–26 history (8 of 10 weeks inside it), not a test result.`
          : ""}
        {fit && rideEnd > fit.maxCtl
          ? ` You haven't been above ride fitness ${Math.round(fit.maxCtl)}, so power is shown at that level.`
          : ""}
      </p>
    </>
  );
}
