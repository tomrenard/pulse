import { ImageResponse } from "next/og";

// iOS ignores SVG home-screen icons; this draws the same glass mark as icon.svg to a PNG (full
// bleed: iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #0b2843, #14506e 55%, #2b7d86)",
      }}
    >
      <div
        style={{
          width: 132,
          height: 104,
          borderRadius: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background:
            "linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,.12) 50%, rgba(255,255,255,.05))",
          border: "2px solid rgba(255,255,255,.5)",
          boxShadow: "0 10px 30px rgba(0,0,0,.3)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 22,
            width: 64,
            height: 14,
            borderRadius: 14,
            background: "rgba(255,255,255,.35)",
          }}
        />
        <svg viewBox="0 0 46 22" width="112" height="54" role="img" aria-label="pulse">
          <path
            d="M2 12h7l3.5-8 6 16 4.5-11 2.5 3h18"
            fill="none"
            stroke="#fff"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>,
    size,
  );
}
