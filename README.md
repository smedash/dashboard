# GSC Dashboard

Ein modernes Dashboard zur Visualisierung und Analyse von Google Search Console Daten.

## Features

- **Magic Link Authentifizierung** - Passwordless Login via E-Mail
- **Google Search Console Integration** - Direkter Zugriff auf GSC-Daten via OAuth
- **Umfassende Analysen**:
  - Suchanfragen (Keywords)
  - Seiten-Performance
  - Länder-Statistiken
  - Geräte-Verteilung
- **Zeitraum-Vergleich** - Vergleiche verschiedene Zeiträume
- **Trend-Indikatoren** - Sehe prozentuale Änderungen auf einen Blick

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Datenbank**: Neon PostgreSQL (Serverless)
- **ORM**: Prisma
- **Authentifizierung**: NextAuth.js
- **E-Mail**: Resend
- **Charts**: Recharts
- **Styling**: Tailwind CSS

## Setup

### 1. Umgebungsvariablen

Erstelle eine `.env.local` Datei mit folgenden Variablen:

```env
# Neon Database
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="dein-geheimer-schluessel"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

# Resend
RESEND_API_KEY="re_..."

# Google OAuth
GOOGLE_CLIENT_ID="deine-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="dein-client-secret"

# Admin Users (komma-separierte Liste von E-Mail-Adressen)
ADMIN_EMAILS="admin@example.com,admin2@example.com"
```

### 2. Google Cloud Console Setup

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes
3. Aktiviere die "Google Search Console API"
4. Erstelle OAuth 2.0 Credentials:
   - Anwendungstyp: Webanwendung
   - Autorisierte Redirect-URIs: `http://localhost:3000/api/auth/callback/google`
5. Kopiere Client-ID und Client-Secret in die `.env.local`

### 3. Neon Datenbank Setup

1. Erstelle einen Account auf [neon.tech](https://neon.tech)
2. Erstelle ein neues Projekt
3. Kopiere den Connection String in die `.env.local`

### 4. Installation

```bash
# Abhängigkeiten installieren
npm install

# Datenbank-Schema anwenden
npx prisma db push

# Entwicklungsserver starten
npm run dev
```

### 5. Resend Setup

1. Erstelle einen Account auf [resend.com](https://resend.com)
2. Verifiziere deine Domain (z.B. tasketeer.com)
3. Erstelle einen API-Key und füge ihn zur `.env.local` hinzu

## Projektstruktur

```
gsc-dashboard/
├── prisma/
│   └── schema.prisma          # Datenbankschema
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth-Seiten (Login, Verify)
│   │   ├── (dashboard)/       # Dashboard-Seiten
│   │   └── api/               # API-Routes
│   ├── components/
│   │   ├── charts/            # Chart-Komponenten
│   │   ├── dashboard/         # Dashboard-Komponenten
│   │   └── ui/                # UI-Komponenten
│   └── lib/
│       ├── auth.ts            # NextAuth Konfiguration
│       ├── gsc.ts             # GSC API Client
│       ├── prisma.ts          # Prisma Client
│       └── resend.ts          # Resend E-Mail Client
├── .env.local                 # Umgebungsvariablen
└── package.json
```

## Deployment

Das Dashboard kann auf Vercel deployed werden:

```bash
# Vercel CLI installieren
npm i -g vercel

# Deployen
vercel
```

Vergiss nicht, die Umgebungsvariablen in Vercel zu konfigurieren und die Google OAuth Redirect-URI zu aktualisieren.

## Lizenz

MIT
