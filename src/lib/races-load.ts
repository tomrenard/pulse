import { intervals } from "@/lib/intervals";
import { orNothing } from "@/lib/nights";
import { at, HOUR, type PaceCurve } from "@/lib/records";

/** Best 200 m and 400 m swims (all time), for critical swim speed. */
export async function loadSwim() {
  const swim = await orNothing(
    intervals<{ list: PaceCurve[] }>("/pace-curves.json?type=Swim&curves=all", HOUR),
    {
      list: [],
    },
  );
  const all = swim.list.find((c) => c.id === "all");
  return {
    swim200: at(all?.distance, all?.values, 200),
    swim400: at(all?.distance, all?.values, 400),
  };
}
