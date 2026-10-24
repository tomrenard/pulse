import { ImageResponse } from "next/og";

/** Launch screen for one iPhone size ("1179x2556"): the sky with the glass mark, as iOS shows it. */
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const [w, h] = (await params).size.split("x").map(Number);
  if (!w || !h || w > 1600 || h > 3000) return new Response("bad size", { status: 400 });
  const mark = Math.round(w * 0.32);
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
          width: mark,
          height: Math.round(mark * 0.78),
          borderRadius: mark,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,.1))",
          border: "3px solid rgba(255,255,255,.5)",
        }}
      >
        <svg
          viewBox="0 0 46 22"
          width={Math.round(mark * 0.8)}
          height={Math.round(mark * 0.38)}
          role="img"
          aria-label="pulse"
        >
          <path
            d="M2 12h7l3.5-8 6 16 4.5-11 2.5 3h18"
            fill="none"
            stroke="#fff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>,
    { width: w, height: h, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
