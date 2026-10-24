import type { State } from "@/lib/readiness";

/** The full-screen sky whose colours follow readiness; children inherit the state's tints. */
export function Sky({ state, children }: { state: State; children: React.ReactNode }) {
  return (
    <div data-state={state === "building" ? "go" : state} style={{ display: "contents" }}>
      <div className="sky" aria-hidden="true" />
      <div className="statusbar" aria-hidden="true" />
      {children}
    </div>
  );
}
