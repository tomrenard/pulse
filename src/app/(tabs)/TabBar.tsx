"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pullIfStale } from "./actions";
import { Glyph } from "./ui";

const TABS = [
  [
    "/",
    "Today",
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>,
  ],
  [
    "/training",
    "Training",
    <>
      <rect x="3.5" y="11" width="3.6" height="9" rx="1.2" />
      <rect x="10.2" y="4" width="3.6" height="16" rx="1.2" />
      <rect x="16.9" y="8" width="3.6" height="12" rx="1.2" />
    </>,
  ],
  [
    "/health",
    "Health",
    <path
      key="heart"
      d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"
    />,
  ],
  [
    "/records",
    "Records",
    <>
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.3M17 6h2.5a2.5 2.5 0 0 1-2.6 3.3M12 13.5V17M8.5 20h7" />
    </>,
  ],
  [
    "/outlook",
    "Outlook",
    <>
      <path d="M4 18.5 9.2 12l3.4 3.2 7.4-8.2" />
      <path d="M15.5 7h4.5v4.5" />
    </>,
  ],
] as const;

/**
 * iOS 26-style floating glass tab bar: equal-width tabs with labels (nothing shifts when the
 * tab changes), a glass pill that slides to the tapped tab at once, and refresh as its own round
 * glass island. Coming back to the app refreshes too.
 */
export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const [tapped, setTapped] = useState<string | null>(null);
  const [shown, setShown] = useState(path);
  const [spin, setSpin] = useState(false);
  // The page caught up with the tap (or the URL changed another way): follow the URL again.
  if (shown !== path) {
    setShown(path);
    setTapped(null);
  }
  const active = tapped ?? path;
  // A tab owns its sub-pages too (/training/i123 is Training).
  const owns = (href: string) => (href === "/" ? active === "/" : active.startsWith(href));
  const index = Math.max(
    0,
    TABS.findIndex(([href]) => owns(href)),
  );

  useEffect(() => {
    // Offline copies of opened pages and push both need the service worker.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Opening the app: pull last night from COROS if it's missing, then show it.
    const pull = () => pullIfStale().then((fresh) => fresh && router.refresh());
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      pull();
    };
    pull();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [router]);

  return (
    <nav className="dock" aria-label="Sections">
      {/* Liquid Glass icon fill: bright top edge fading to clear, shared by every tab glyph. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="glass-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
          </linearGradient>
        </defs>
      </svg>
      <div className="glass tabs" style={{ "--i": index } as React.CSSProperties}>
        <span className="pill" aria-hidden="true" />
        {TABS.map(([href, label, glyph]) => (
          <Link
            key={href}
            href={href}
            // Whole page and its data, kept 5 min: switching tabs is instant.
            prefetch={true}
            className="tab"
            aria-current={owns(href) ? "page" : undefined}
            onClick={() => setTapped(href)}
          >
            <Glyph>{glyph}</Glyph>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <button
        type="button"
        className={`glass island${spin ? " spin" : ""}`}
        aria-label="Refresh data"
        onClick={() => {
          setSpin((s) => !s);
          router.refresh();
        }}
      >
        <Glyph>
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </Glyph>
      </button>
    </nav>
  );
}
