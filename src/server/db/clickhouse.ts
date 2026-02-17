import { createClient } from "@clickhouse/client";
import { env } from "~/env.js";

export function createClickHouseClient() {
  return createClient({
    url: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
  });
}
