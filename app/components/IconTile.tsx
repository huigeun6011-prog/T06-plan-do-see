import { httpsSrc } from "../../lib/ui/imageSrc";

// Image slot: an <img> only for https URLs, otherwise a generated placeholder. Size comes from CSS (--pd-icon), so a real image changes nothing.
function hue(label: string): number {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

export function IconTile({ src, label, round = false, size = 48 }: { src?: string; label: string; round?: boolean; size?: number }) {
  const cls = round ? "pd-icon pd-round" : "pd-icon";
  const url = httpsSrc(src);
  if (url) {
    return <img className={cls} src={url} alt="" title={label} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
  }
  // Placeholder skips the difficulty word so "노말 진힐라" shows 진, not 노.
  const word = label.trim().split(/\s+/).at(-1) ?? "";
  return (
    <span className={cls} style={{ background: `hsl(${hue(label)} 35% 42%)` }} title={label} aria-hidden="true">
      {[...word][0] ?? ""}
    </span>
  );
}
