"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

export default function Home() {
  const [query, setQuery] = useState("");

  const execute = api.query.execute.useMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    execute.mutate({ query: query.trim() });
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">UK Property Price Query</h1>
            <p className="mt-1 text-zinc-400">
              Ask a question about UK property prices in plain English.
            </p>
          </div>
          <Link
            href="/evals"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            View Evals →
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. What is the average price in London?"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={execute.isPending}
            className="rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {execute.isPending ? "Running..." : "Query"}
          </button>
        </form>

        {execute.error && (
          <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
            {execute.error.message}
          </div>
        )}

        {execute.data && (
          <div className="space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-medium text-zinc-400">
                Generated SQL
              </h2>
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-green-400">
                {execute.data.sql}
              </pre>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium text-zinc-400">
                Results ({execute.data.results.length} rows)
              </h2>
              {execute.data.results.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-800 bg-zinc-900">
                      <tr>
                        {Object.keys(
                          execute.data.results[0] as Record<string, unknown>,
                        ).map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2 font-medium text-zinc-300"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {execute.data.results.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-800/50">
                          {Object.values(
                            row as Record<string, unknown>,
                          ).map((val, j) => (
                            <td key={j} className="px-4 py-2 text-zinc-300">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-zinc-500">No results returned.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
