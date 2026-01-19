"use client";

import { useEffect } from "react";

export function ThemeScript() {
  useEffect(() => {
    // Immer Dark-Mode erzwingen
    const theme = "dark";
    localStorage.setItem("theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, []);

  return null;
}
