import type { Metadata, Viewport } from "next";
import "./globals.css";

// Launch screens for current iPhones: [CSS width, CSS height, pixel ratio].
const IPHONES = [
  [440, 956, 3],
  [430, 932, 3],
  [402, 874, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
] as const;

export const metadata: Metadata = {
  title: "pulse",
  description: "Training, sleep and recovery in one place.",
  appleWebApp: {
    capable: true,
    title: "pulse",
    statusBarStyle: "black-translucent",
    startupImage: IPHONES.map(([w, h, r]) => ({
      url: `/splash/${w * r}x${h * r}`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0b2843",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
