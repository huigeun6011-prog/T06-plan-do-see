export type Theme = "light" | "dark";

export const THEME_KEY = "pds-theme";

// A stored choice beats the system preference.
export function chooseTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

// Runs before first paint (no flash). Keep in sync with chooseTheme; no < > & characters allowed.
export const THEME_SCRIPT = `try{var s=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=s==="light"||s==="dark"?s:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}`;
