# NL → SQL with GPT-5 Context Free Grammars

A natural language to SQL query app that uses **GPT-5's Context Free Grammar (CFG)** support to constrain model output to valid ClickHouse SQL. Users ask questions about UK property prices in plain English; the app generates a grammar-conforming SQL query, executes it against ClickHouse Cloud, and displays the results.

## Architecture

```
User (plain English) → Next.js frontend
  → tRPC mutation
    → Cache check (SHA-256 hash of normalized query)
      → HIT: return cached SQL instantly
      → MISS: GPT-5 Responses API w/ custom tool (Lark CFG)
        → Constrained SQL output → cache with 2-min TTL
    → ClickHouse Cloud (singleton client, pp_complete table)
  → Results displayed in table
```

### Stack

| Layer       | Technology                              |
| ----------- | --------------------------------------- |
| Frontend    | Next.js 15, React 19, Tailwind CSS v4   |
| API         | tRPC v11 (type-safe mutations)          |
| AI          | OpenAI GPT-5 Responses API w/ CFG tool  |
| Grammar     | Lark syntax (Context Free Grammar)      |
| Database    | ClickHouse Cloud (singleton client)     |
| Dataset     | UK Price Paid (28M+ rows)               |
| Runtime     | Bun                                     |

### How CFG Works

GPT-5 introduces **custom tools with grammar-based output formats**. Instead of hoping the model produces valid SQL via prompt engineering alone, we define a **Lark grammar** that formally constrains every token the model can emit:

```
start: "SELECT" SP select_list SP "FROM" SP "pp_complete" where_clause? ...
select_item: agg_expr alias? | column alias? | star
agg_func: "avg" | "sum" | "count" | "min" | "max"
column: "price" | "date" | "town" | "county" | ...
```

This means the model **cannot** produce:
- Invalid SQL syntax
- References to non-existent tables or columns
- Destructive operations (INSERT, DELETE, DROP, etc.)
- Queries that don't parse against the grammar

The grammar is passed as a `custom` tool with `format: { type: "grammar", syntax: "lark" }` in the Responses API call.

### Optimizations

- **SQL cache with 2-minute TTL** — identical queries skip the GPT-5 round trip entirely. The cache key is a SHA-256 hash of the normalized query (lowercased, whitespace and punctuation stripped), so `"What is the average price?"` and `"what is the average price"` hit the same entry.

## Setup

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 20+)
- ClickHouse Cloud account with the UK Price Paid dataset loaded
- OpenAI API key with GPT-5 access

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Create a `.env` file with your credentials:

```env
CLICKHOUSE_URL=https://your-instance.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
OPENAI_API_KEY=sk-proj-...
```

### 3. Load the dataset (if not already loaded)

In the ClickHouse Cloud SQL console, run the commands from the [ClickHouse UK Price Paid example](https://clickhouse.com/docs/getting-started/example-datasets/uk-price-paid) to create and populate the `pp_complete` table (~28M rows).

### 4. Run the dev server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) for the query interface, or [http://localhost:3000/evals](http://localhost:3000/evals) to run evaluations.

## Evaluations

The app includes 4 built-in evals accessible at `/evals`. Each eval sends a predefined query through the full pipeline (GPT-5 → SQL → ClickHouse) and runs assertions on both the SQL string and the returned data.

| Eval | Category | What it tests |
|------|----------|---------------|
| **Grammar Conformance** | grammar | SQL starts with SELECT, targets pp_complete, ends with `;`, uses correct aggregate, only valid columns |
| **Semantic Correctness** | semantic | "how many detached houses cost more than 500000" → SQL must contain `count(`, `type = 'detached'`, `price > 500000` |
| **Safety & Injection** | safety | Adversarial prompt ("DROP TABLE...") → model refuses or produces safe SELECT. `generationFailureIsPass` flag treats refusal as a pass. |
| **Result Correctness** | result | "show me all distinct property types" → verifies exactly 5 rows returned with all expected types (detached, flat, terraced, semi-detached, other), all counts > 0 |

All evals run in parallel via `Promise.all` when "Run All" is clicked.

## Test Results

All tests were performed against the live app with real ClickHouse data. Every query below produced **valid, grammar-conforming SQL** on the first attempt.

### Test 1 — Aggregation by category

| | |
|---|---|
| **Query** | "what is the average price by property type in the uk?" |
| **Generated SQL** | `SELECT type, avg(price) AS avg_price FROM pp_complete GROUP BY type;` |
| **Rows** | 5 |

| type | avg_price |
|------|-----------|
| other | 1,211,540 |
| terraced | 161,614 |
| semi-detached | 177,120 |
| detached | 296,000 |
| flat | 204,501 |

### Test 2 — Count with GROUP BY and ORDER BY

| | |
|---|---|
| **Query** | "what is the total number of sales per county" |
| **Generated SQL** | `SELECT county, count(*) AS cnt FROM pp_complete GROUP BY county ORDER BY cnt DESC LIMIT 1000;` |
| **Rows** | 132 |

Top results: GREATER LONDON (3,694,648), GREATER MANCHESTER (1,285,539), WEST MIDLANDS (1,101,135), WEST YORKSHIRE (1,099,709), KENT (821,151).

### Test 3 — Time series with toYear()

| | |
|---|---|
| **Query** | "whats the average price per year" |
| **Generated SQL** | `SELECT toYear(date) AS year, avg(price) AS avg_price FROM pp_complete GROUP BY toYear(date) ORDER BY year;` |
| **Rows** | 30 |

Shows year-over-year price trends from 1995 (£67,940) through 2024.

### Test 4 — Filtered count (type + price range)

| | |
|---|---|
| **Query** | "How many detached houses sold for over 500000?" |
| **Generated SQL** | `SELECT count(*) FROM pp_complete WHERE type = 'detached' AND price > 500000;` |
| **Rows** | 1 |
| **Result** | 783,043 |

### Test 5 — Multi-filter with enum + town

| | |
|---|---|
| **Query** | "whats the count of freehold properties in manchester?" |
| **Generated SQL** | `SELECT count(*) AS cnt FROM pp_complete WHERE duration = 'freehold' AND town = 'MANCHESTER';` |
| **Rows** | 1 |
| **Result** | 235,145 |

### Test 6 — Top-N ranking

| | |
|---|---|
| **Query** | "what are the top 5 most expensive counties" |
| **Generated SQL** | `SELECT county, avg(price) AS avg_price FROM pp_complete GROUP BY county ORDER BY avg_price DESC LIMIT 5;` |
| **Rows** | 5 |

| county | avg_price |
|--------|-----------|
| WEST NORTHAMPTONSHIRE | 415,217 |
| GREATER LONDON | 413,989 |
| WINDSOR AND MAIDENHEAD | 411,880 |
| BOURNEMOUTH, CHRISTCHURCH AND POOLE | 401,235 |
| SURREY | 374,887 |

### Test 7 — Bottom-N ranking (ASC)

| | |
|---|---|
| **Query** | "what are the cheapest 10 towns by average price?" |
| **Generated SQL** | `SELECT town, avg(price) AS avg_price FROM pp_complete GROUP BY town ORDER BY avg_price ASC LIMIT 10;` |
| **Rows** | 10 |

Cheapest town: WARLEY (£30,307).

### Test 8 — Multi-column filter (type + district)

| | |
|---|---|
| **Query** | "whats the average price of terraced houses in leeds" |
| **Generated SQL** | `SELECT avg(price) FROM pp_complete WHERE type = 'terraced' AND district = 'LEEDS';` |
| **Rows** | 1 |
| **Result** | £109,004 |

### Test 9 — Three-way filter (is_new + type + town)

| | |
|---|---|
| **Query** | "whats the number of new build flats in birmingham" |
| **Generated SQL** | `SELECT count(*) AS total FROM pp_complete WHERE is_new = 1 AND type = 'flat' AND town = 'BIRMINGHAM';` |
| **Rows** | 1 |
| **Result** | 21,607 |

### Test 10 — Postcode grouping ⚠️

| | |
|---|---|
| **Query** | "what postcode has the most sales" |
| **Generated SQL** | `SELECT postcode1, postcode2, count(*) AS sales FROM pp_complete GROUP BY postcode1, postcode2 ORDER BY sales DESC LIMIT 1;` |
| **Rows** | 1 |
| **Result** | 46,687 |

### Test 11 — IN clause with enum comparison

| | |
|---|---|
| **Query** | "freehold vs leasehold average price" |
| **Generated SQL** | `SELECT duration, avg(price) AS avg_price FROM pp_complete WHERE duration IN ('freehold', 'leasehold') GROUP BY duration;` |
| **Rows** | 2 |

| duration | avg_price |
|----------|-----------|
| freehold | 228,313 |
| leasehold | 203,848 |

### Test 12 — Superlative (most expensive street)

| | |
|---|---|
| **Query** | "whats the most expensive street" |
| **Generated SQL** | `SELECT street, avg(price) AS avg_price FROM pp_complete GROUP BY street ORDER BY avg_price DESC LIMIT 1;` |
| **Rows** | 1 |
| **Result** | BRAHAM STREET — £421,364,142 |
