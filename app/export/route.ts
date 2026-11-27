import { connectDatabase } from "../../db/client";
import { buildResponse, exportErrorResponse } from "../../db/export";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return await buildResponse(connectDatabase(), new Date());
  } catch {
    return exportErrorResponse();
  }
}
