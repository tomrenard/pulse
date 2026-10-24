"use client";

/** Shown when the database can't be reached; the tab bar stays usable. */
export default function TabError({ reset }: { reset: () => void }) {
  return (
    <section className="mod mod-b" style={{ marginTop: 60, display: "grid", gap: 12 }}>
      <span>Couldn't load your data. Check your connection, then try again.</span>
      <button type="button" className="btn" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
