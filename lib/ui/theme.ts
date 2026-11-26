export type Theme = "light" | "dark";

export const THEME_KEY = "pds-theme";

// Runs as the first child of the preview wrapper, before paint. Storage and system preference are read independently.
// No angle brackets or ampersands: it is rendered as raw script text.
export const THEME_SCRIPT = `(function(){var r=document.currentScript.parentElement,s=null;try{s=localStorage.getItem("${THEME_KEY}")}catch(e){}if(s!=="light"){if(s!=="dark"){try{s=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){s="dark"}}}r.dataset.theme=s})()`;

// Mount-time twin of THEME_SCRIPT (used after client-side navigation, when the script did not run). A test keeps them in step.
export function resolveTheme(stored: string | null, prefersDark: boolean | null): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark === false ? "light" : "dark";
}

export const otherTheme = (t: Theme): Theme => (t === "dark" ? "light" : "dark");
