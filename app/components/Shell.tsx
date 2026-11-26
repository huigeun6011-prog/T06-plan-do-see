"use client";
import { useEffect, useState, type ReactNode } from "react";
import { THEME_KEY, type Theme } from "../../lib/ui/theme";

export function Shell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [names, setNames] = useState(true);

  // The inline script already set data-theme before paint; just read it.
  useEffect(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"), []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setTheme(next);
  }

  return (
    <div className="pd" data-names={names ? "on" : "off"}>
      <header className="pd-bar">
        <button type="button" className="pd-pill" aria-pressed={names} aria-label="이름 표시" onClick={() => setNames(!names)}>
          Aa
        </button>
        <button type="button" className="pd-pill" aria-label="테마 전환" title={theme ?? ""} onClick={toggleTheme}>
          {theme === "light" ? "☀" : "☾"}
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
