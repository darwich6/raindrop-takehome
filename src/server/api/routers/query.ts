import { createHash } from "crypto";
import { z } from "zod";
import OpenAI from "openai";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env.js";
import { TRPCError } from "@trpc/server";

const openAIClient = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const GRAMMAR = `
start: "SELECT" SP select_list SP "FROM" SP "pp_complete" where_clause? group_by_clause? order_by_clause? limit_clause? ";"

SP: " "

select_list: select_item ("," SP select_item)*

select_item: agg_expr alias? | column alias? | star

star: "*"

agg_expr: agg_func "(" column ")" | agg_func "(" star ")" | "toYear(" column ")"

agg_func: "avg" | "sum" | "count" | "min" | "max"

alias: SP "AS" SP IDENTIFIER

column: "price" | "date" | "postcode1" | "postcode2" | "type" | "is_new" | "duration" | "addr1" | "addr2" | "street" | "locality" | "town" | "district" | "county"

where_clause: SP "WHERE" SP condition (SP logic_op SP condition)*

logic_op: "AND" | "OR"

condition: column SP comp_op SP value | column SP "IN" SP "(" value ("," SP value)* ")" | "toYear(" column ")" SP comp_op SP NUMBER

comp_op: "=" | "!=" | ">" | "<" | ">=" | "<="

value: STRING | NUMBER

STRING: /'[A-Za-z0-9 \\-]{1,50}'/

NUMBER: /[0-9]{1,10}/

IDENTIFIER: /[a-z_]{1,30}/

group_by_clause: SP "GROUP" SP "BY" SP group_list

group_list: group_item ("," SP group_item)*

group_item: column | "toYear(" column ")"

order_by_clause: SP "ORDER" SP "BY" SP order_item ("," SP order_item)*

order_item: (column | agg_expr | IDENTIFIER) (SP sort_dir)?

sort_dir: "ASC" | "DESC"

limit_clause: SP "LIMIT" SP NUMBER
  `;

const TOOL = {
  type: "custom" as const,
  name: "clickhouse_query",
  description:
    "Generates read-only ClickHouse SELECT queries against the pp_complete table. " +
    "Only SELECT statements are allowed — no INSERT, UPDATE, DELETE, DROP, ALTER, or any DDL/DML. " +
    "Results are limited to 1000 rows maximum. " +
    "Available columns: " +
    "price (UInt32), " +
    "date (Date), " +
    "postcode1 (LowCardinality String), " +
    "postcode2 (LowCardinality String), " +
    "type (Enum8: 'other'=0, 'terraced'=1, 'semi-detached'=2, 'detached'=3, 'flat'=4), " +
    "is_new (UInt8: 0 or 1), " +
    "duration (Enum8: 'unknown'=0, 'freehold'=1, 'leasehold'=2), " +
    "addr1 (String), " +
    "addr2 (String), " +
    "street (LowCardinality String), " +
    "locality (LowCardinality String), " +
    "town (LowCardinality String), " +
    "district (LowCardinality String), " +
    "county (LowCardinality String). " +
    "Town, district, county, street, and locality values are UPPERCASE in the data. " +
    "YOU MUST REASON HEAVILY ABOUT THE QUERY AND MAKE SURE IT OBEYS THE GRAMMAR.",
  format: {
    type: "grammar" as const,
    syntax: "lark" as const,
    definition: GRAMMAR,
  },
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const sqlCache = new Map<string, { sql: string; expiresAt: number }>();

function cacheKey(query: string): string {
  const normalized = query.trim().toLowerCase().replace(/[\s\p{P}]/gu, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function generateSQL(query: string): Promise<string> {
  const key = cacheKey(query);
  const cached = sqlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.sql;

  const resp = await openAIClient.responses.create({
    model: "gpt-5",
    input: [
      {
        role: "developer",
        content:
          "You are a SQL assistant. Convert the user's natural language query into a valid ClickHouse SQL query against the pp_complete table. Call the clickhouse_query tool with the generated SQL. " +
          "The table contains UK property price paid data with columns: price, date, postcode1, postcode2, type, is_new, duration, addr1, addr2, street, locality, town, district, county. " +
          "All town, district, county, street, and locality values are UPPERCASE. " +
          "Always include a LIMIT clause (max 1000) unless the user asks for an aggregate with no detail rows. " +
          "You MUST reason heavily about the query and make sure it obeys the grammar.",
      },
      {
        role: "user",
        content: query,
      },
    ],
    tools: [TOOL],
    parallel_tool_calls: false,
    text: { format: { type: "text" } },
  });

  const toolCall = resp.output.find(
    (item) => item.type === "custom_tool_call"
  );

  if (!toolCall || toolCall.type !== "custom_tool_call") {
    throw new Error("Model did not generate a SQL query with custom tool call");
  }

  const sql = toolCall.input;
  if (!sql?.trim().toUpperCase().startsWith("SELECT")) {
    throw new Error("Only SELECT queries are allowed");
  }

  sqlCache.set(key, { sql, expiresAt: Date.now() + CACHE_TTL_MS });
  return sql;
}

export const queryRouter = createTRPCRouter({
  execute: publicProcedure
    .input(z.object({
      query: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const sql = await generateSQL(input.query);

      const result = await ctx.clickhouse.query({
        query: sql,
        format: "JSONEachRow",
      });

      const rows = await result.json<Record<string, unknown>>();

      return {
        sql,
        results: rows,
      };
    }),
});