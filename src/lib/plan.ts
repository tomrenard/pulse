/**
 * A planned workout's description: the coach's note, then the steps ("- 30m Z1 HR", "5x"), section
 * headers included ("Warmup", "Main Set 3x").
 */
export function splitPlan(description = "") {
  const lines = description
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const isStep = (l: string) =>
    l.startsWith("-") || /\b\d+x$/i.test(l) || /^(warm ?up|cool ?down|main set)\b/i.test(l);
  return {
    note: lines.filter((l) => !isStep(l)).join("\n"),
    steps: lines.filter(isStep).map((l) => l.replace(/^-\s*/, "")),
  };
}
