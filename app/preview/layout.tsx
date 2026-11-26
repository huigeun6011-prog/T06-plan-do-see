import type { Metadata } from "next";
import type { ReactNode } from "react";
import { THEME_SCRIPT } from "../../lib/ui/theme";
import { Shell } from "../components/Shell";
import "./preview.css";

export const metadata: Metadata = { title: "Plan-Do-See" };

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script>{THEME_SCRIPT}</script>
      <Shell>{children}</Shell>
    </>
  );
}
