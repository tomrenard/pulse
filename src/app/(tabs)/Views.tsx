"use client";

import { Children, useState } from "react";

/** One card, several views (Night / Week / 2 months): a segmented control over server-rendered children. */
export function Views({ labels, children }: { labels: string[]; children: React.ReactNode }) {
  const [i, setI] = useState(0);
  return (
    <>
      <fieldset className="seg-ctl" aria-label="View">
        {labels.map((label, k) => (
          <button key={label} type="button" aria-pressed={i === k} onClick={() => setI(k)}>
            {label}
          </button>
        ))}
      </fieldset>
      {Children.toArray(children)[i]}
    </>
  );
}
