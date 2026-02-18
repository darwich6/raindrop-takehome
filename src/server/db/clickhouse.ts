import { createClient } from "@clickhouse/client";
import { env } from "~/env.js";

const globalForClickHouse = globalThis as unknown as {
  clickhouse: ReturnType<typeof createClient> | undefined;
};

export const clickhouse =
  globalForClickHouse.clickhouse ??
  createClient({
    url: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
  });

if (process.env.NODE_ENV !== "production")
  globalForClickHouse.clickhouse = clickhouse;
