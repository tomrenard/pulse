"use client";

import type { ExpressionSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { ZONE_COLORS } from "../../charts";

/** Route on a dark map (MapLibre + OpenFreeMap, no key). Loaded only on the detail screen. */
export function RouteMap({
  line,
  segments,
}: {
  line: [number, number][];
  /** Runs of the same power zone; the route is drawn in zone colours when present. */
  segments: { zone: number; coords: [number, number][] }[];
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map: MapLibre, LngLatBounds, setWorkerUrl }) => {
      if (cancelled || !box.current) return;
      // Workers must come from our own origin; the build copies MapLibre's into public/.
      setWorkerUrl("/maplibre-gl-worker.mjs");
      const bounds = line.reduce((b, p) => b.extend(p), new LngLatBounds(line[0], line[0]));
      map = new MapLibre({
        container: box.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        bounds,
        fitBoundsOptions: { padding: 28 },
        attributionControl: { compact: true },
      });
      map.on("load", () => {
        const features = segments.map((s) => ({
          type: "Feature" as const,
          properties: { zone: s.zone },
          geometry: { type: "LineString" as const, coordinates: s.coords },
        }));
        map?.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features } });
        map?.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: {
            // Zone 0 = no power data: the ride colour.
            "line-color": [
              "match",
              ["get", "zone"],
              ...ZONE_COLORS.flatMap((c, i) => [i + 1, c]),
              "#7cbcff",
            ] as unknown as ExpressionSpecification,
            "line-width": 4,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [line, segments]);
  // Named by the surrounding section ("Route"); no role, so the map controls stay reachable.
  return <div ref={box} className="route-map" />;
}
