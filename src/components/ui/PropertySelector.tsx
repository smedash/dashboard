"use client";

import { useEffect, useState } from "react";

interface Property {
  siteUrl: string;
  permissionLevel?: string;
}

interface PropertySelectorProps {
  value: string | null;
  onChange: (value: string) => void;
}

// Erlaubte Properties - kann über Umgebungsvariable erweitert werden
const ALLOWED_PROPERTIES = [
  "https://www.raiffeisen.ch/rch/de/privatkunden/",
  "sc-domain:raiffeisen.ch",
];

export function PropertySelector({ value, onChange }: PropertySelectorProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchProperties() {
      try {
        const response = await fetch("/api/gsc/properties");
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        // Filtere nur erlaubte Properties
        const allProperties = data.properties || [];
        const filteredProperties = allProperties.filter((p: Property) =>
          ALLOWED_PROPERTIES.some(
            (allowed) =>
              p.siteUrl.includes(allowed) || allowed.includes(p.siteUrl)
          )
        );

        // Falls keine gefilterten Properties, zeige alle (Fallback)
        const finalProperties =
          filteredProperties.length > 0 ? filteredProperties : allProperties;

        setProperties(finalProperties);

        // Auto-select first property if none selected
        if (!value && finalProperties?.length > 0) {
          onChange(finalProperties[0].siteUrl);
        }
      } catch {
        setError("Fehler beim Laden der Properties");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProperties();
  }, [value, onChange]);

  if (isLoading) {
    return (
      <div className="h-10 w-64 bg-slate-700 rounded-lg animate-pulse"></div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-2 bg-amber-500/20 text-amber-400 text-sm rounded-lg">
        {error}
      </div>
    );
  }

  const selectedProperty = properties.find((p) => p.siteUrl === value);

  // Wenn nur eine Property, zeige sie als statischen Text
  if (properties.length === 1) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg text-white">
        <svg
          className="w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
        <span className="truncate">
          {properties[0].siteUrl.replace(/^(sc-domain:|https?:\/\/)/, "")}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors min-w-[200px]"
      >
        <svg
          className="w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
        <span className="truncate flex-1 text-left">
          {selectedProperty?.siteUrl?.replace(/^(sc-domain:|https?:\/\/)/, "") ||
            "Property wählen"}
        </span>
        <svg
          className="w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-50">
          {properties.map((property) => (
            <button
              key={property.siteUrl}
              onClick={() => {
                onChange(property.siteUrl);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-600 transition-colors ${
                value === property.siteUrl ? "text-blue-400" : "text-white"
              }`}
            >
              {property.siteUrl.replace(/^(sc-domain:|https?:\/\/)/, "")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
