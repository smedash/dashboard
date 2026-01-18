"use client";

import { useEffect } from "react";

export function ThemeScript() {
  useEffect(() => {
    // Setze Theme beim ersten Laden
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(savedTheme);
  }, []);

  return null;
}
