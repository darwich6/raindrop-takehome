"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

type EvalResult = {
  id: string;
  name: string;
  category: string;
  description: string;
  query: string;
  sql: string | null;
  generationError: string | null;
  executionError: string | null;
  rowCount: number;
  durationMs: number;
  assertions: { name: string; passed: boolean }[];
  passed: boolean;
};

const CATEGORY_STYLE: Record<string, string> = {
  grammar: "text-blue-400 bg-blue-400/10",
  semantic: "text-violet-400 bg-violet-400/10",
  safety: "text-amber-400 bg-amber-400/10",
  result: "text-emerald-400 bg-emerald-400/10",
};

export default function EvalsPage() {
  const { data: evalCases, isLoading } = api.eval.list.useQuery();
  const [results, setResults] = useState<Record<string, EvalResult>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);

  const runEval = api.eval.run.useMutation();

  const handleRun = async (id: string) => {
    setRunning((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await runEval.mutateAsync({ id });
      setResults((prev) => ({ ...prev, [id]: result }));
    } catch (error) {
      console.error("Error running eval", error);
    } finally {
      setRunning((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleRunAll = async () => {
    if (!evalCases) return;
    setRunningAll(true);
    await Promise.all(evalCases.map((evalCase) => handleRun(evalCase.id)));
    setRunningAll(false);
  };

  const completedResults = Object.values(results);
  const totalPassed = completedResults.filter((r) => r.passed).length;
  const totalRun = completedResults.length;

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <Link
            href="/"
            className="mb-4 inline-block text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            ← Query
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
                Pipeline Verification
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Evaluations
              </h1>
            </div>
            <button
              onClick={handleRunAll}
              disabled={runningAll || isLoading}
              className="rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:bg-white disabled:opacity-40"
            >
              {runningAll ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-900" />
                  Running
                </span>
              ) : (
                "Run All"
              )}
            </button>
          </div>
        </div>

        {/* Summary */}
        {totalRun > 0 && (
          <div
            className={`mb-8 rounded-lg border px-4 py-3 text-center text-sm font-medium ${
              totalPassed === totalRun
                ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-400"
                : "border-amber-800/50 bg-amber-950/30 text-amber-400"
            }`}
          >
            {totalPassed}/{totalRun} passed
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-zinc-600">Loading...</p>
        )}

        {/* Cards */}
        <div className="space-y-4">
          {evalCases?.map((evalCase) => {
            const result = results[evalCase.id];
            const isRunning = running[evalCase.id];

            return (
              <div
                key={evalCase.id}
                className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/30"
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    {result && (
                      <div
                        className={`h-2 w-2 rounded-full ${
                          result.passed ? "bg-emerald-400" : "bg-red-400"
                        }`}
                      />
                    )}
                    <h2 className="text-sm font-medium">{evalCase.name}</h2>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        CATEGORY_STYLE[evalCase.category] ?? ""
                      }`}
                    >
                      {evalCase.category}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRun(evalCase.id)}
                    disabled={isRunning ?? false}
                    className="text-xs text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
                  >
                    {isRunning ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
                        Running
                      </span>
                    ) : (
                      "Run"
                    )}
                  </button>
                </div>

                {/* Description + Query */}
                <div className="border-t border-zinc-800/50 px-5 py-3">
                  <p className="text-xs leading-relaxed text-zinc-500">
                    {evalCase.description}
                  </p>
                  <p className="mt-2 font-mono text-xs text-zinc-400">
                    &ldquo;{evalCase.query}&rdquo;
                  </p>
                </div>

                {/* Results */}
                {result && (
                  <>
                    {/* SQL */}
                    <div className="border-t border-zinc-800/50 px-5 py-3">
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                        SQL
                      </p>
                      {result.sql ? (
                        <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-emerald-400">
                          {result.sql}
                        </pre>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          No SQL generated — {result.generationError}
                        </p>
                      )}
                    </div>

                    {/* Assertions */}
                    <div className="border-t border-zinc-800/50 px-5 py-3">
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                        Checks
                      </p>
                      <div className="grid gap-1">
                        {result.assertions.map((a, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={
                                a.passed ? "text-emerald-500" : "text-red-500"
                              }
                            >
                              {a.passed ? "✓" : "✗"}
                            </span>
                            <span className="text-zinc-400">{a.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer meta */}
                    <div className="flex gap-4 border-t border-zinc-800/50 px-5 py-2.5 text-[10px] text-zinc-600">
                      <span>{result.rowCount} rows</span>
                      <span>{(result.durationMs / 1000).toFixed(1)}s</span>
                      {result.executionError && (
                        <span className="text-red-500">
                          {result.executionError}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
