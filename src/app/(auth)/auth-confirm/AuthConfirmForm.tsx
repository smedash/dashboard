"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Loading-Komponente für Suspense
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <p className="text-slate-400">Wird geladen...</p>
      </div>
    </div>
  );
}

// Hauptinhalt der Seite - verwendet useSearchParams
function AuthConfirmContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Prüfe ob alle Parameter vorhanden sind
  useEffect(() => {
    if (!token || !email) {
      setError("Ungültiger Anmeldelink. Bitte fordere einen neuen Link an.");
    }
  }, [token, email]);

  const handleLogin = () => {
    if (!token || !email) return;

    setIsLoading(true);

    // Leite zum echten NextAuth Callback weiter
    // Dies ist der Moment, wo der Token tatsächlich "verbraucht" wird
    const callbackParams = new URLSearchParams({
      token,
      email,
      callbackUrl,
    });

    // Redirect zum NextAuth Resend Callback
    window.location.href = `/api/auth/callback/resend?${callbackParams.toString()}`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="w-full max-w-md p-8 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Ungültiger Link
          </h1>

          <p className="text-slate-400 mb-6">{error}</p>

          <a
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all duration-200"
          >
            Zurück zur Anmeldung
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Anmeldung bestätigen
        </h1>

        <p className="text-slate-400 mb-2">
          Du meldest Dich an als:
        </p>
        <p className="text-white font-medium mb-6">{email}</p>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Wird angemeldet...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              Jetzt anmelden
            </>
          )}
        </button>

        <p className="mt-6 text-xs text-slate-500">
          Klicke auf den Button, um die Anmeldung abzuschließen.
        </p>

        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <a
            href="/login"
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Das bist nicht Du? Andere E-Mail verwenden
          </a>
        </div>
      </div>
    </div>
  );
}

// Export mit Suspense-Boundary
export default function AuthConfirmForm() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AuthConfirmContent />
    </Suspense>
  );
}
