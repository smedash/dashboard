"use client";

import { useState, useEffect } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Immer Dark-Mode erzwingen
    const currentTheme: Theme = "dark";
    localStorage.setItem("theme", currentTheme);
    setThemeState(currentTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(currentTheme);
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Immer Dark-Mode erzwingen, ignoriere andere Themes
    const forcedTheme: Theme = "dark";
    setThemeState(forcedTheme);
    localStorage.setItem("theme", forcedTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(forcedTheme);
  };

  return { theme, setTheme, mounted };
}
