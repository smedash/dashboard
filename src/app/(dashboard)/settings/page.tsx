"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface Property {
  siteUrl: string;
  permissionLevel?: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasGoogleConnection, setHasGoogleConnection] = useState(false);

  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch("/api/gsc/properties");
        const data = await response.json();

        if (data.needsConnection) {
          setHasGoogleConnection(false);
        } else {
          setHasGoogleConnection(true);
          setProperties(data.properties || []);
        }
      } catch {
        setHasGoogleConnection(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkConnection();
  }, []);

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Einstellungen</h1>

      {/* Account Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <div>
              <p className="text-sm text-slate-400">E-Mail</p>
              <p className="text-white">{session?.user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-slate-400">Name</p>
              <p className="text-white">{session?.user?.name || "Nicht angegeben"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Google Connection Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Google Search Console</h2>
        
        {isLoading ? (
          <div className="animate-pulse h-20 bg-slate-700 rounded-lg"></div>
        ) : hasGoogleConnection ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-emerald-400">Google-Konto verbunden</span>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">Verfügbare Properties ({properties.length})</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {properties.map((property) => (
                  <div
                    key={property.siteUrl}
                    className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
                  >
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="text-white text-sm">
                      {property.siteUrl.replace(/^(sc-domain:|https?:\/\/)/, "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => signIn("google")}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Mit anderem Google-Konto verbinden
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400">
              Verbinde Dein Google-Konto, um auf die Search Console Daten zuzugreifen.
            </p>
            <button
              onClick={() => signIn("google")}
              className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Mit Google verbinden
            </button>
          </div>
        )}
      </div>

      {/* Logout Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Sitzung</h2>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}

