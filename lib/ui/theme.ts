export type Theme = "light" | "dark";

export const THEME_KEY = "pds-theme";

// Runs as the first child of the preview wrapper, before paint. Storage and system preference are read independently.
// No angle brackets or ampersands: it is rendered as raw script text.
export const THEME_SCRIPT = `(function(){var r=document.currentScript.parentElement,s=null;try{s=localStorage.getItem("${THEME_KEY}")}catch(e){}if(s!=="light"){if(s!=="dark"){try{s=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){s="dark"}}}r.dataset.theme=s})()`;
