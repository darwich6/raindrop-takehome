"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

export default function Home() {
  const [query, setQuery] = useState("");
  const execute = api.query.execute.useMutation();

  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;
    execute.mutate({ query: query.trim() });
  };

  const handleCopy = async (sql: string) => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
              GPT-5 CFG
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              UK Property Price Query
            </h1>
          </div>
          <Link
            href="/evals"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Evals →
          </Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything — e.g. What is the average price in London?"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600"
            />
            <button
              type="submit"
              disabled={execute.isPending || !query.trim()}
              className="rounded-lg bg-zinc-100 px-5 py-3 text-sm font-medium text-zinc-900 transition-all hover:bg-white disabled:opacity-40"
            >
              {execute.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-900" />
                  Querying
                </span>
              ) : (
                "Query"
              )}
            </button>
          </div>
        </form>

        {/* Error */}
        {execute.error && (
          <div className="mb-8 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {execute.error.message}
          </div>
        )}

        {/* Results */}
        {execute.data && (
          <div className="space-y-6">
            {/* SQL */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                  Generated SQL
                </p>
                <button
                  onClick={() => handleCopy(execute.data!.sql)}
                  className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 font-mono text-sm leading-relaxed text-emerald-400">
                {execute.data.sql}
              </pre>
            </div>

            {/* Table */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                Results
                <span className="ml-2 text-zinc-600">
                  {execute.data.results.length} row
                  {execute.data.results.length !== 1 && "s"}
                </span>
              </p>

              {execute.data.results.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80">
                        {Object.keys(
                          execute.data.results[0] as Record<string, unknown>,
                        ).map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-500"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {execute.data.results.map((row, i) => (
                        <tr
                          key={i}
                          className="transition-colors hover:bg-zinc-900/50"
                        >
                          {Object.values(
                            row as Record<string, unknown>,
                          ).map((val, j) => (
                            <td
                              key={j}
                              className="px-4 py-2.5 font-mono text-sm text-zinc-300"
                            >
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">No results returned.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
