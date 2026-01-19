"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PropertyContextType {
  selectedProperty: string | null;
  setSelectedProperty: (property: string | null) => void;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const PROPERTY_STORAGE_KEY = "gsc-selected-property";

export function PropertyProvider({ children }: { children: ReactNode }) {
  // Initialize with value from localStorage immediately to avoid hydration issues
  const [selectedProperty, setSelectedPropertyState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(PROPERTY_STORAGE_KEY);
    }
    return null;
  });

  // Load from localStorage on mount (client-side only) - sync check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(PROPERTY_STORAGE_KEY);
      if (stored && stored !== selectedProperty) {
        setSelectedPropertyState(stored);
      }
    }
  }, [selectedProperty]);

  // Save to localStorage when property changes
  const setSelectedProperty = (property: string | null) => {
    setSelectedPropertyState(property);
    if (typeof window !== "undefined") {
      if (property) {
        localStorage.setItem(PROPERTY_STORAGE_KEY, property);
      } else {
        localStorage.removeItem(PROPERTY_STORAGE_KEY);
      }
    }
  };

  return (
    <PropertyContext.Provider value={{ selectedProperty, setSelectedProperty }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error("useProperty must be used within a PropertyProvider");
  }
  return context;
}
