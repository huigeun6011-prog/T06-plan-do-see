"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { THEME_KEY, THEME_SCRIPT, type Theme } from "../../lib/ui/theme";

export function Shell({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [names, setNames] = useState(true);

  // The inline script already set data-theme on the wrapper before paint; just read it.
  useEffect(() => setTheme(root.current?.dataset.theme === "light" ? "light" : "dark"), []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
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
