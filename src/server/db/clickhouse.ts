import { createClient } from "@clickhouse/client";
import { env } from "~/env.js";

/**
 * Create a ClickHouse Cloud client.
 *
 * Uses `@clickhouse/client-web` which works in Node.js and
 * Next.js edge/serverless runtimes (Fetch API under the hood).
 */
export function createClickHouseClient() {
  return createClient({
    url: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
  });
}
