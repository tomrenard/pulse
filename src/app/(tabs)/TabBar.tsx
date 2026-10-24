"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ICON = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  training: <path d="M4 20V11M9.3 20V5M14.7 20v-7M20 20V8" />,
  health: (
    <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
  ),
  races: (
    <>
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.3M17 6h2.5a2.5 2.5 0 0 1-2.6 3.3M12 13.5V17M8.5 20h7" />
    </>
  ),
  outlook: <path d="M3.5 17.5 9 12l3.5 3.5L20.5 7.5M15.5 7.5h5v5" />,
};

const TABS = [
  ["/", "Today", "today"],
  ["/training", "Training", "training"],
  ["/health", "Health", "health"],
  ["/races", "Races", "races"],
  ["/outlook", "Outlook", "outlook"],
] as const;

const svg = (children: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

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
  const index = Math.max(
    0,
    TABS.findIndex(([href]) => href === active),
  );

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [router]);

  return (
    <nav className="dock" aria-label="Sections">
      <div className="glass tabs" style={{ "--i": index } as React.CSSProperties}>
        <span className="pill" aria-hidden="true" />
        {TABS.map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            // Whole page and its data, kept 5 min: switching tabs is instant.
            prefetch={true}
            className="tab"
            aria-current={href === active ? "page" : undefined}
            onClick={() => setTapped(href)}
          >
            {svg(ICON[icon])}
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
        {svg(
          <>
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 4v7h-7" />
          </>,
        )}
      </button>
    </nav>
  );
}
