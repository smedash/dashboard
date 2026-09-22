"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
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

function bandColor(b: string): THREE.Color {
  if (b === "high") return new THREE.Color("#ef4444");
  if (b === "medium") return new THREE.Color("#f97316");
  if (b === "low") return new THREE.Color("#f59e0b");
  return new THREE.Color("#94a3b8");
}

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
  mode: "cluster" | "scatter"
): Float32Array {
  const arr = new Float32Array(points.length * 3);
  const countries = countryCodes(points);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (mode === "scatter") {
      arr[i * 3] = Math.log1p(p.gi) * 1.2 - 6;
      arr[i * 3 + 1] = Math.log1p(p.av) * 1.2 - 6;
      arr[i * 3 + 2] = Math.log1p(p.ld) * 2 - 2;
    } else {
      const ci = countries.indexOf(p.c || "?");
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
  const pos = useMemo(() => positionsFor(points, mode), [points, mode]);
  const colors = useMemo(() => {
    const c = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      const col = bandColor(points[i].b);
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    }
    return c;
  }, [points]);

  return (
    <points
      onClick={(e) => {
        e.stopPropagation();
        const idx = e.index;
        if (idx == null || !points[idx]) return;
        onSelect({
          point: points[idx],
          position: [e.point.x, e.point.y, e.point.z],
        });
      }}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors sizeAttenuation />
    </points>
  );
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => {
            setMode("cluster");
            setSelected(null);
          }}
          className={`px-3 py-1.5 text-sm rounded-lg ${mode === "cluster" ? "bg-blue-600 text-white" : "border border-slate-300 dark:border-slate-600"}`}
        >
          Pfad-Cluster
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("scatter");
            setSelected(null);
          }}
          className={`px-3 py-1.5 text-sm rounded-lg ${mode === "scatter" ? "bg-blue-600 text-white" : "border border-slate-300 dark:border-slate-600"}`}
        >
          Metrik-Scatter
        </button>
        <span className="text-xs text-slate-500">
          {points.length.toLocaleString("de-CH")} Punkte · rot = high Konfidenz
        </span>
      </div>
      <div className="h-[calc(100vh-13rem)] min-h-[720px] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-950">
        <Canvas
          camera={{ position: [0, 4, 18], fov: 55 }}
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
                <div className="font-medium break-all text-slate-900 dark:text-white">
                  {selected.point.url.replace("https://www.ubs.com", "")}
                </div>
                <div className="mt-1.5 space-y-0.5 text-slate-500 dark:text-slate-400">
                  <div>Konfidenz {selected.point.k} ({selected.point.b})</div>
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
