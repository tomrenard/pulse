"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  ["/", "Today"],
  ["/training", "Training"],
  ["/health", "Health"],
  ["/races", "Races"],
] as const;

/** Weather-style bottom bar: refresh, page dots, next tab. Coming back to the app refreshes too. */
export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const [spin, setSpin] = useState(false);
  const i = Math.max(
    0,
    TABS.findIndex(([href]) => href === path),
  );
  const next = TABS[(i + 1) % TABS.length] ?? TABS[0];

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [router]);

  return (
    <nav className="bar" aria-label="Sections">
      <button
        type="button"
        className={`ib${spin ? " spin" : ""}`}
        aria-label="Refresh data"
        onClick={() => {
          setSpin((s) => !s);
          router.refresh();
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
      </button>
      <div className="dots">
        {TABS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={href === path ? "page" : undefined}
          >
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <Link href={next[0]} className="ib" aria-label={`Next: ${next[1]}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </nav>
  );
}
