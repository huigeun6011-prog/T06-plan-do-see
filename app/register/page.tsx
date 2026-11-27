import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCatalog, type CatalogRow } from "../../lib/catalog";
import { connectDatabase } from "../../db/client";
import { loadRegistration } from "../../db/register";
import { Section } from "../components/Shell";
import { RegisterView } from "./RegisterView";
import type { RegistrationData } from "./types";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  let data: RegistrationData;
  try {
    data = await loadRegistration(connectDatabase());
  } catch {
    return (
      <Section no="01" title="오류">
        <p role="alert">불러오지 못했습니다. 새로고침하세요.</p>
      </Section>
    );
  }
  let catalogRows: CatalogRow[] = [];
  try {
    catalogRows = parseCatalog(readFileSync(join(process.cwd(), "data", "boss-catalog.csv"), "utf8"));
  } catch {} // without a catalog the typed boss form is used
  return <RegisterView data={data} catalogRows={catalogRows} />;
}
