import { connectDatabase } from "../db/client";
import { loadWeek } from "../db/week";
import { Section, Shell } from "./components/Shell";
import "./preview/preview.css";
import "./week/week.css";
import type { WeekData } from "./week/types";
import { WeekView } from "./week/WeekView";
import { NOTICE } from "../lib/ui/week-ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  let data: WeekData | null = null;
  try {
    data = await loadWeek(connectDatabase(), new Date());
  } catch {}
  return (
    <Shell wide notice={NOTICE}>
      {data ? (
        <WeekView data={data} />
      ) : (
        <Section no="01" title="오류">
          <p role="alert">불러오지 못했습니다. 새로고침하세요.</p>
        </Section>
      )}
    </Shell>
  );
}
