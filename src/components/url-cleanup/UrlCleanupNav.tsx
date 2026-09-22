"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/url-cleanup", label: "Übersicht" },
  { href: "/url-cleanup/inventar", label: "Inventar" },
  { href: "/url-cleanup/wolke", label: "3D-Wolke" },
  { href: "/url-cleanup/dimensionen", label: "Dimensionen" },
];

export function UrlCleanupNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
