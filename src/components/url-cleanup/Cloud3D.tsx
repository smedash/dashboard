"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

export type CloudPoint = {
  id: string;
  url: string;
  c: string | null;
  l: string | null;
  s: string | null;
  gi: number;
  gc: number;
  av: number;
  ld: number;
  k: number;
  b: string;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function bandHex(b: string): string {
  if (b === "high") return "#ef4444";
  if (b === "medium") return "#f97316";
  if (b === "low") return "#f59e0b";
  if (b === "keep") return "#22c55e";
  return "#94a3b8";
}

function bandColor(b: string): THREE.Color {
  return new THREE.Color(bandHex(b));
}

const BAND_DRAW_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
  keep: 3,
};

const CLUSTER_RADIUS = 8;

function countryCodes(points: CloudPoint[]): string[] {
  return [...new Set(points.map((p) => p.c || "?"))];
}

function clusterCenter(countryIndex: number, countryCount: number): [number, number, number] {
  const angle = (countryIndex / Math.max(1, countryCount)) * Math.PI * 2;
  return [
    Math.cos(angle) * CLUSTER_RADIUS,
    2.6,
    Math.sin(angle) * CLUSTER_RADIUS,
  ];
}

function countryLabel(code: string): string {
  if (!code || code === "?") return "?";
  if (code.length <= 3) return code.toUpperCase();
  return code.charAt(0).toUpperCase() + code.slice(1);
}

function positionsFor(
  points: CloudPoint[],
  mode: "cluster" | "scatter",
  countries: string[]
): Float32Array {
  const arr = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (mode === "scatter") {
      arr[i * 3] = Math.log1p(p.gi) * 1.2 - 6;
      arr[i * 3 + 1] = Math.log1p(p.av) * 1.2 - 6;
      arr[i * 3 + 2] = Math.log1p(p.ld) * 2 - 2;
    } else {
      const ci = Math.max(0, countries.indexOf(p.c || "?"));
      const [cx, , cz] = clusterCenter(ci, countries.length);
      const langOff = ((hash(p.l || "") % 100) / 100 - 0.5) * 3;
      const secOff = ((hash(p.s || "") % 100) / 100 - 0.5) * 2;
      const jitter = ((hash(p.id) % 100) / 100 - 0.5) * 1.4;
      arr[i * 3] = cx + langOff + jitter;
      arr[i * 3 + 1] = secOff + ((hash(p.id + "y") % 100) / 100 - 0.5) * 2;
      arr[i * 3 + 2] = cz + ((hash(p.id + "z") % 100) / 100 - 0.5) * 1.4;
    }
  }
  return arr;
}

function CountryLabels({
  points,
  activeCountry,
  onCountryClick,
}: {
  points: CloudPoint[];
  activeCountry?: string;
  onCountryClick?: (code: string) => void;
}) {
  const labels = useMemo(() => {
    const countries = countryCodes(points);
    const counts = new Map<string, number>();
    for (const p of points) {
      const key = p.c || "?";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return countries.map((code, i) => ({
      code,
      count: counts.get(code) ?? 0,
      position: clusterCenter(i, countries.length),
    }));
  }, [points]);

  return (
    <>
      {labels.map((l) => {
        const active = activeCountry === l.code;
        const clickable = Boolean(onCountryClick) && l.code !== "?";
        return (
          <Html
            key={l.code}
            position={l.position}
            sprite
            zIndexRange={[20, 0]}
            style={{ pointerEvents: clickable ? "auto" : "none" }}
          >
            <button
              type="button"
              disabled={!clickable}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onCountryClick?.(l.code);
              }}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-center shadow-md ring-1 transition-colors ${
                clickable ? "cursor-pointer hover:ring-white/60" : "cursor-default"
              } ${
                active
                  ? "bg-blue-600 ring-blue-300"
                  : "bg-slate-900/85 ring-white/25 hover:bg-slate-800"
              }`}
              title={clickable ? `Nach ${countryLabel(l.code)} filtern` : undefined}
            >
              <div className="text-[11px] font-semibold tracking-wide text-white">{countryLabel(l.code)}</div>
              <div className="text-[9px] tabular-nums text-slate-200">
                {l.count.toLocaleString("de-CH")}
              </div>
            </button>
          </Html>
        );
      })}
    </>
  );
}

type Selection = {
  point: CloudPoint;
  position: [number, number, number];
};

function PointCloud({
  points,
  mode,
  onSelect,
}: {
  points: CloudPoint[];
  mode: "cluster" | "scatter";
  onSelect: (selection: Selection) => void;
}) {
  const { camera, size } = useThree();
  const countries = useMemo(() => countryCodes(points), [points]);
  const drawn = useMemo(
    () =>
      [...points].sort(
        (a, b) => (BAND_DRAW_RANK[a.b] ?? 4) - (BAND_DRAW_RANK[b.b] ?? 4)
      ),
    [points]
  );
  const pos = useMemo(() => positionsFor(drawn, mode, countries), [drawn, mode, countries]);
  const colors = useMemo(() => {
    const c = new Float32Array(drawn.length * 3);
    for (let i = 0; i < drawn.length; i++) {
      const col = bandColor(drawn[i].b);
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    }
    return c;
  }, [drawn]);

  const drawnRef = useRef(drawn);
  const posRef = useRef(pos);
  drawnRef.current = drawn;
  posRef.current = pos;

  const pick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const pts = drawnRef.current;
      const p = posRef.current;
      const v = new THREE.Vector3();
      const maxNdc = (14 * 2) / Math.max(1, size.width);
      const maxD = maxNdc * maxNdc;
      let best = -1;
      let bestD = maxD;
      for (let i = 0; i < pts.length; i++) {
        v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).project(camera);
        if (v.z < -1 || v.z > 1) continue;
        const dx = v.x - e.pointer.x;
        const dy = v.y - e.pointer.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) return;
      onSelect({
        point: pts[best],
        position: [p[best * 3], p[best * 3 + 1], p[best * 3 + 2]],
      });
    },
    [camera, onSelect, size.width]
  );

  return (
    <points onClick={pick} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors sizeAttenuation toneMapped={false} />
    </points>
  );
}

function fullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function Cloud3D({
  points,
  country,
  onCountryFilter,
}: {
  points: CloudPoint[];
  country?: string;
  onCountryFilter?: (code: string) => void;
}) {
  const [mode, setMode] = useState<"cluster" | "scatter">("cluster");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const exitFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (el && fullscreenElement() === el) {
      const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      await (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
    }
    setFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen) {
      await exitFullscreen();
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    try {
      const req =
        el.requestFullscreen ??
        (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
      if (req) await req.call(el);
      setFullscreen(true);
    } catch {
      setFullscreen(true);
    }
  }, [exitFullscreen, fullscreen]);

  useEffect(() => {
    const onChange = () => {
      const el = rootRef.current;
      if (fullscreenElement() === el) setFullscreen(true);
      else if (fullscreenElement()) return;
      else setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    if (!fullscreenElement()) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [exitFullscreen, fullscreen]);

  return (
    <div
      ref={rootRef}
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex h-dvh flex-col gap-3 bg-slate-950 p-3"
          : "flex flex-col gap-3"
      }
    >
      <div className={`flex flex-wrap gap-2 items-center ${fullscreen ? "text-slate-200" : ""}`}>
        <button
          type="button"
          onClick={() => {
            setMode("cluster");
            setSelected(null);
          }}
          className={`px-3 py-1.5 text-sm rounded-lg ${mode === "cluster" ? "bg-blue-600 text-white" : `border ${fullscreen ? "border-slate-500 text-slate-100" : "border-slate-300 dark:border-slate-600"}`}`}
        >
          Pfad-Cluster
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("scatter");
            setSelected(null);
          }}
          className={`px-3 py-1.5 text-sm rounded-lg ${mode === "scatter" ? "bg-blue-600 text-white" : `border ${fullscreen ? "border-slate-500 text-slate-100" : "border-slate-300 dark:border-slate-600"}`}`}
        >
          Metrik-Scatter
        </button>
        <span className="text-xs text-slate-500">
          {points.length.toLocaleString("de-CH")} Punkte · rot = high Konfidenz · grün = keep
        </span>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className={`ml-auto px-3 py-1.5 text-sm rounded-lg border ${fullscreen ? "border-slate-500 text-slate-100" : "border-slate-300 dark:border-slate-600"}`}
          title={fullscreen ? "Esc zum Beenden" : "Wolke im Vollbild öffnen"}
        >
          {fullscreen ? "Vollbild beenden" : "Vollbild"}
        </button>
      </div>
      <div
        className={
          fullscreen
            ? "min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
            : "h-[calc(100vh-13rem)] min-h-[720px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950"
        }
      >
        <Canvas
          camera={{ position: [0, 4, 18], fov: 55 }}
          raycaster={{ params: { Points: { threshold: 0.2 } } }}
          onPointerMissed={() => setSelected(null)}
        >
          <ambientLight intensity={0.8} />
          <PointCloud points={points} mode={mode} onSelect={setSelected} />
          {mode === "cluster" && (
            <CountryLabels
              points={points}
              activeCountry={country}
              onCountryClick={onCountryFilter}
            />
          )}
          <OrbitControls enableDamping makeDefault />
          {selected && (
            <Html position={selected.position} sprite zIndexRange={[100, 0]}>
              <div className="pointer-events-auto translate-x-3 -translate-y-2 w-72 max-w-[70vw] rounded-lg bg-white/95 dark:bg-slate-800/95 p-3 text-xs shadow-lg ring-1 ring-black/10 dark:ring-white/10">
                <a
                  href={selected.point.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium break-all text-blue-600 dark:text-blue-400 hover:underline"
                  title={selected.point.url}
                >
                  {selected.point.url.replace("https://www.ubs.com", "")}
                </a>
                <div className="mt-1.5 space-y-0.5 text-slate-500 dark:text-slate-400">
                  <div>
                    Konfidenz {selected.point.k} ({selected.point.b})
                  </div>
                  <div>GSC Impressions {selected.point.gi.toLocaleString("de-CH")}</div>
                  <div>GSC Klicks {selected.point.gc.toLocaleString("de-CH")}</div>
                  <div>Adobe Visits {selected.point.av.toLocaleString("de-CH")}</div>
                  <div>Leads {selected.point.ld.toLocaleString("de-CH")}</div>
                </div>
              </div>
            </Html>
          )}
        </Canvas>
      </div>
    </div>
  );
}
