"use client";

import { useEffect, useRef } from "react";

/** Weather-style hero that fades into a compact header as the page scrolls. */
export function Hero({
  place,
  word,
  sub,
  children,
}: {
  place: string;
  word: string;
  sub: string;
  children: React.ReactNode;
}) {
  const hero = useRef<HTMLElement>(null);
  const compact = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const p = Math.min(1, Math.max(0, window.scrollY / 150));
      if (hero.current) {
        hero.current.style.opacity = String(1 - p);
        hero.current.style.transform = `translateY(${p * -18}px) scale(${1 - p * 0.06})`;
      }
      if (compact.current) compact.current.style.opacity = String(p > 0.85 ? (p - 0.85) / 0.15 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="compact" ref={compact} aria-hidden="true">
        <b>{word}</b>
        <small>{sub}</small>
      </div>
      <section className="hero" ref={hero} aria-label="Readiness">
        <div className="place">{place}</div>
        <div className="big">{word}</div>
        {children}
      </section>
    </>
  );
}
