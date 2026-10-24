"use client";

import { useRef } from "react";

/** The one "explain" affordance: an ⓘ that opens a bottom sheet. Paragraphs live here, not in modules. */
export function Info({ title, children }: { title: string; children: React.ReactNode }) {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="info-btn"
        aria-label={`About ${title}`}
        onClick={() => sheet.current?.showModal()}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M8 7.2v3.8M8 5v.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop tap is a pointer shortcut; Escape and Done close it from the keyboard */}
      <dialog
        ref={sheet}
        className="sheet"
        aria-label={title}
        onClick={(e) => e.target === sheet.current && sheet.current?.close()}
      >
        <div className="sheet-body">
          <b>{title}</b>
          {children}
          <button type="button" className="btn" onClick={() => sheet.current?.close()}>
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
