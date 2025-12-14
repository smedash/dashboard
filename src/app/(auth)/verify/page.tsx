import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          Überprüfe Dein Postfach
        </h1>
        
        <p className="text-slate-400 mb-6">
          Ein Anmeldelink wurde an Deine E-Mail-Adresse gesendet. 
          Klicke auf den Link in der E-Mail, um Dich anzumelden.
        </p>

        <div className="p-4 bg-slate-700/30 rounded-lg mb-6">
          <p className="text-sm text-slate-300">
            <strong className="text-white">Tipp:</strong> Schau auch im Spam-Ordner nach, 
            falls Du die E-Mail nicht findest.
          </p>
        </div>

        <Link 
          href="/login"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Zurück zur Anmeldung
        </Link>
      </div>
    </div>
  );
}

