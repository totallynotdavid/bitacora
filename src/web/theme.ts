export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_TITLES: Record<Theme, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

/** The localStorage key. The inline script in index.html reads the same key before first paint. */
const KEY = "bitacora.theme";

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Pins the page to a theme and remembers the choice. "system" removes both. */
export function saveTheme(theme: Theme) {
  const root = document.documentElement;
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be blocked. The choice then lasts until the page reloads.
  }
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}
