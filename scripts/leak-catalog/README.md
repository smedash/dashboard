# Google Leak Katalog Pipeline

Pipeline zum Parsen, Filtern und Klassifizieren der Google Content Warehouse API Leak-Daten (v0.4.0) fuer den SEO URL Checker.

## Uebersicht

```
HexDocs v0.4.0 → Scrape → Parse → Filter → Classify (Claude) → catalog.json
```

## Ausfuehrung

Komplett (alle Schritte):
```bash
npm run leak-catalog:full
```

Einzelne Schritte:
```bash
npm run leak-catalog:scrape     # 1. HTML-Seiten von HexDocs laden (~50 min)
npm run leak-catalog:parse      # 2. HTML zu JSON parsen
npm run leak-catalog:filter     # 3. Relevanz-Filter (ohne AI)
npm run leak-catalog:classify   # 4. Claude-Klassifizierung (braucht ANTHROPIC_API_KEY)
npm run leak-catalog:generate   # 5. Finalen Katalog erzeugen
```

## Optionen

### Scraper (01)
- `--resume` - Ueberspringe bereits heruntergeladene Dateien

### Parser (02)
- `--from-single-page path/to/file.html` - Parse eine einzelne API-Referenz-Datei

### Classifier (04)
- `--resume` - Setze bei letztem Fortschritt fort
- `--dry-run` - Zeige was gesendet wuerde (ohne API-Calls)
- `--batch-size N` - Module pro Batch (Standard: 30)

### Catalog Generator (05)
- `--include-not-measurable` - Auch nicht-messbare Attribute einschliessen

## Dateien

| Datei | Beschreibung |
|-------|-------------|
| `data/leak-raw/` | Rohe HTML-Dateien (gitignored) |
| `data/leak-catalog/raw-modules.json` | Alle Module mit Attributen |
| `data/leak-catalog/relevant-modules.json` | Search-relevante Module |
| `data/leak-catalog/excluded-modules.json` | Ausgeschlossene Module |
| `data/leak-catalog/classified-modules.json` | KI-klassifizierte Module |
| `src/lib/url-checker/catalog.json` | **Finaler Katalog** (452 Checks) |
| `src/lib/url-checker/catalog-index.json` | Kategorie-Index |
| `src/lib/url-checker/engine.ts` | Rule Engine (Integration) |

## Ergebnis-Statistik (aktuell)

- **452 auswertbare Checks** aus dem Google Leak
  - 253 direkt messbar (HTML/HTTP)
  - 172 heuristisch (KI-Bewertung)
  - 27 via externe APIs
- **15 Kategorien**: content_quality, structured_data, technical_indexing, ...
- **13 kritische + 80 hochrelevante** Checks

## Erweiterung

Wenn der Scraper fertig ist (alle 2.593 Module):
1. `npm run leak-catalog:parse` erneut ausfuehren
2. `npm run leak-catalog:filter` erneut ausfuehren
3. `npm run leak-catalog:classify` mit `--resume`
4. `npm run leak-catalog:generate`

Dies wird die Anzahl der Checks von ~452 auf geschaetzt ~2.000-3.000 erhoehen.
