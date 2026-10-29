"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/i18n/I18nProvider";
import { commonMessages } from "@/i18n/messages/common";

const LINKS = [
  { href: "/url-cleanup", labelKey: "overview" },
  { href: "/url-cleanup/inventar", labelKey: "inventory" },
  { href: "/url-cleanup/wolke", labelKey: "cloud3d" },
  { href: "/url-cleanup/dimensionen", labelKey: "dimensions" },
] as const;

export function UrlCleanupNav() {
  const pathname = usePathname();
  const t = useMessages(commonMessages);
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
            {t.nav[l.labelKey]}
          </Link>
        );
      })}
    </div>
  );
}
