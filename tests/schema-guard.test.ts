import { describe, expect, it } from "vitest";
import { selectSchemaDatabase } from "../scripts/schema.mjs";

const DEV_URL = "postgres://fake:fake@dev.example.invalid/db";
const TEST_URL = "postgres://fake:fake@test.example.invalid/db";
const PRODUCTION_URL = "postgres://fake:fake@production.example.invalid/db";

describe("dev schema guard", () => {
  it.each(["production", "test", "Dev"])("refuses the %s marker by default", (marker) => {
    expect(() => selectSchemaDatabase({
      NEON_BRANCH: marker,
      DATABASE_URL_UNPOOLED: PRODUCTION_URL,
    })).toThrow(/^NEON_BRANCH must be exactly "dev"\.$/);
  });

  it("refuses a missing dev marker", () => {
    expect(() => selectSchemaDatabase({
      DATABASE_URL_UNPOOLED: DEV_URL,
    })).toThrow(/^NEON_BRANCH is missing from \.env\.local\.$/);
  });

  it("accepts the dev marker", () => {
    expect(selectSchemaDatabase({
      NEON_BRANCH: "dev",
      DATABASE_URL_UNPOOLED: DEV_URL,
    })).toEqual({ mode: "dev", url: DEV_URL });
  });
});

describe("test schema guard", () => {
  const env = {
    NEON_BRANCH: "dev",
    DATABASE_URL_UNPOOLED: DEV_URL,
    TEST_DATABASE_URL_UNPOOLED: TEST_URL,
  };

  it("refuses a missing test marker", () => {
    expect(() => selectSchemaDatabase(env, { test: true }))
      .toThrow(/^TEST_NEON_BRANCH is missing from \.env\.local\.$/);
  });

  it("refuses the wrong test marker", () => {
    expect(() => selectSchemaDatabase({ ...env, TEST_NEON_BRANCH: "dev" }, { test: true }))
      .toThrow(/^TEST_NEON_BRANCH must be exactly "test"\.$/);
  });

  it.each([
    undefined,
    DEV_URL,
    "postgres://different:fake@DEV.example.invalid./other",
    "postgres://fake:fake@test-pooler.example.invalid/db",
    "postgres://fake:fake@dev-pooler.example.invalid/db",
  ])("refuses an unsafe test URL (%s)", (url) => {
    expect(() => selectSchemaDatabase({
      ...env,
      TEST_NEON_BRANCH: "test",
      TEST_DATABASE_URL_UNPOOLED: url,
    }, { test: true })).toThrow(/^TEST_DATABASE_URL_UNPOOLED must be a direct Postgres URL on a different host from DATABASE_URL_UNPOOLED\.$/);
  });

  it("accepts a direct test host that differs from dev", () => {
    expect(selectSchemaDatabase({ ...env, TEST_NEON_BRANCH: "test" }, { test: true }))
      .toEqual({ mode: "test", url: TEST_URL });
  });
});

describe("production schema guard", () => {
  const env = { NEON_BRANCH: "production", DATABASE_URL_UNPOOLED: PRODUCTION_URL };

  it("refuses a production marker without the production flag", () => {
    expect(() => selectSchemaDatabase(env, { production: false }))
      .toThrow(/^NEON_BRANCH must be exactly "dev"\.$/);
  });

  it("refuses the production flag with a dev marker", () => {
    expect(() => selectSchemaDatabase({
      NEON_BRANCH: "dev",
      DATABASE_URL_UNPOOLED: DEV_URL,
    }, { production: true })).toThrow(/^NEON_BRANCH must be exactly "production"\.$/);
  });

  it("accepts the production marker with the production flag", () => {
    expect(selectSchemaDatabase(env, { production: true }))
      .toEqual({ mode: "production", url: PRODUCTION_URL });
  });
});
