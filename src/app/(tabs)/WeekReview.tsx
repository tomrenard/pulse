import { shortDate } from "@/lib/date";
import { hmm } from "@/lib/format";
import type { weeklyReview } from "@/lib/review";
import { Module } from "./ui";

const signed = (v?: number, unit = "") =>
  v === undefined ? "–" : `${v > 0 ? "+" : ""}${Math.round(v)}${unit}`;

/** Last week in four numbers and one suggestion. */
export function WeekReview({ r }: { r: ReturnType<typeof weeklyReview> }) {
  return (
    <Module
      title="Week in review"
      value={`to ${shortDate(r.sunday)}`}
      info={
        <>
          <p>
            Hours done against hours planned in intervals.icu, fitness (42-day load) change over the
            week, and the change in your 7-night HRV mean against the week before.
          </p>
          <p>
            The suggestion is a fixed rule, first match wins: HRV below normal → ease off; fitness
            up more than 7 → lighter week; under 70 % or over 120 % of plan; fitness slipping with
            no plan.
          </p>
        </>
      }
    >
      <div className="mod-b">
        <div className="stats num">
          <span>
            <b>{hmm(r.doneHours * 3600)}</b>
            {r.plannedHours > 0 ? `of ${hmm(r.plannedHours * 3600)} planned` : "trained"}
          </span>
          <span>
            <b>{signed(r.fitness)}</b>fitness
          </span>
          <span>
            <b>{signed(r.hrvTrend, " %")}</b>HRV
          </span>
        </div>
        <div className="caption">{r.suggestion}</div>
      </div>
    </Module>
  );
}
