import { ImageResponse } from "next/og";

// iOS ignores SVG home-screen icons; this draws the same mark as icon.svg to a PNG (full bleed:
// iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(180deg, #0b2843, #14506e 55%, #2b7d86)",
      }}
    >
      <svg viewBox="0 0 64 64" width="180" height="180" role="img" aria-label="pulse">
        <path
          d="M10 34h11l4-11 7 20 5-13 3 4h14"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    size,
  );
}
