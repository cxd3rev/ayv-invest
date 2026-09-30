"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeSync({ theme }: { theme: "dark" | "light" | "system" }) {
  const { setTheme, theme: active } = useTheme();

  useEffect(() => {
    if (active !== theme) setTheme(theme);
  }, [active, setTheme, theme]);

  return null;
}
