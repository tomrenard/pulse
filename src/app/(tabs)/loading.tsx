import { Sky } from "./Sky";

/** Shown at once when a tab wasn't prefetched yet: the sky and empty modules, no spinner. */
export default function Loading() {
  return (
    <Sky state="go">
      <section className="hero" aria-busy="true">
        <div className="place">&nbsp;</div>
        <div className="big">&nbsp;</div>
      </section>
      <section className="mod skeleton" />
      <section className="mod skeleton" />
    </Sky>
  );
}
