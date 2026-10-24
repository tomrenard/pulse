"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

/** Route on a dark map (MapLibre + OpenFreeMap, no key). Loaded only on the detail screen. */
export function RouteMap({ line }: { line: [number, number][] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Map: MapLibre, LngLatBounds, setWorkerUrl }) => {
      if (cancelled || !box.current || line.length < 2) return;
      // Workers must come from our own origin; the build copies MapLibre's into public/.
      setWorkerUrl("/maplibre-gl-worker.mjs");
      const bounds = line.reduce((b, p) => b.extend(p), new LngLatBounds(line[0], line[0]));
      map = new MapLibre({
        container: box.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        bounds,
        fitBoundsOptions: { padding: 28 },
        attributionControl: { compact: true },

        interactive: true,
      });
      map.on("load", () => {
        map?.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: line },
          },
        });
        map?.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": "#7cbcff", "line-width": 3.5 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [line]);
  return <div ref={box} className="route-map" role="img" aria-label="Route map" />;
}
