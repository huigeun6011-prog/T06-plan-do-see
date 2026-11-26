import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "../components/Shell";
import "./preview.css";

export const metadata: Metadata = { title: "Plan-Do-See" };

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
