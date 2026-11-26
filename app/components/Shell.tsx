"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { THEME_KEY, THEME_SCRIPT, otherTheme, resolveTheme, type Theme } from "../../lib/ui/theme";

export function Shell({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [names, setNames] = useState(true);

  // The inline script sets data-theme before paint, but not after a client-side navigation: resolve it here then.
  useEffect(() => {
    const el = root.current!;
    let t = el.dataset.theme as Theme;
    if (t !== "light" && t !== "dark") {
      let stored: string | null = null;
      let dark: boolean | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch {}
      try {
        dark = matchMedia("(prefers-color-scheme: dark)").matches;
      } catch {}
      t = resolveTheme(stored, dark);
      el.dataset.theme = t;
    }
    setTheme(t);
  }, []);

  function toggleTheme() {
    const next = otherTheme(theme ?? "dark");
    root.current!.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setTheme(next);
  }

  return (
    <div ref={root} className="pd" lang="ko" data-names={names ? "on" : "off"} suppressHydrationWarning>
      <script>{THEME_SCRIPT}</script>
      <header className="pd-bar">
        <button type="button" className="pd-pill" aria-pressed={names} aria-label="이름 표시" onClick={() => setNames(!names)}>
          Aa
        </button>
        <button type="button" className="pd-pill" aria-pressed={theme === "dark"} aria-label="다크 모드" onClick={toggleTheme}>
          <span className="pd-moon" aria-hidden="true">☾</span>
          <span className="pd-sun" aria-hidden="true">☀</span>
        </button>
      </header>
      <div className="pd-stack">{children}</div>
    </div>
  );
}

export function Section({ no, title, children }: { no: string; title: string; children: ReactNode }) {
  return (
    <section className="pd-card" aria-label={title}>
      <h2 className="pd-h">
        <span className="pd-no">{no}</span> {title}
      </h2>
      {children}
    </section>
  );
}
