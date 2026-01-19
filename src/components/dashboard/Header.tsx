"use client";

import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { PropertySelector } from "@/components/ui/PropertySelector";
import { useProperty } from "@/contexts/PropertyContext";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [hasGoogleConnection, setHasGoogleConnection] = useState<boolean | null>(null);
  const { selectedProperty, setSelectedProperty } = useProperty();

  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch("/api/gsc/properties");
        const data = await response.json();
        setHasGoogleConnection(!data.needsConnection);
      } catch {
        setHasGoogleConnection(false);
      }
    }
    checkConnection();
  }, []);

  const handleLinkGoogle = () => {
    window.location.href = "/api/auth/link-google";
  };

  const showFallback = !user.image || imageError;

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center gap-x-4">
          {/* Property Selector in Header */}
          <PropertySelector value={selectedProperty} onChange={setSelectedProperty} />
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Google Connection Button */}
          {hasGoogleConnection === false && (
            <button
              onClick={handleLinkGoogle}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="hidden sm:inline">Connect with Google</span>
            </button>
          )}
          {/* Direct Logout Button */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Abmelden</span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-x-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {!showFallback ? (
                <Image
                  src={user.image!}
                  alt={user.name || "Profilbild"}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700"
                  onError={() => setImageError(true)}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user.email?.[0].toUpperCase() || "U"}
                  </span>
                </div>
              )}
                <span className="hidden lg:flex lg:items-center">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {user.name || user.email}
                </span>
                <svg
                  className="ml-2 h-5 w-5 text-slate-500 dark:text-slate-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-slate-700 shadow-lg ring-1 ring-slate-200 dark:ring-slate-600 py-1">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Angemeldet als</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Abmelden
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
