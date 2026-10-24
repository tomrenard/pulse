import { CorosCard } from "./CorosCard";
import { Soon } from "./Soon";

export default function TodayPage() {
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Berlin",
  });
  return (
    <>
      <Soon
        place={`Today · ${date}`}
        title="pulse"
        items={[
          "Readiness from HRV, resting HR, sleep and form",
          "Next 7 days of the plan and today's workout",
          "10-night HRV against your normal",
          "Sleep, resting HR, stress, form, VO₂max",
        ]}
      />
      <CorosCard />
    </>
  );
}
