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

const CATEGORY_COLORS: Record<string, string> = {
  grammar: "bg-blue-900/50 text-blue-300 border-blue-700",
  semantic: "bg-purple-900/50 text-purple-300 border-purple-700",
  safety: "bg-red-900/50 text-red-300 border-red-700",
  result: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
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
    for (const evalCase of evalCases) {
      await handleRun(evalCase.id);
    }
    setRunningAll(false);
  };

  const completedResults = Object.values(results);
  const totalPassed = completedResults.filter((r) => r.passed).length;
  const totalRun = completedResults.length;

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/"
              className="mb-2 inline-block text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to Query
            </Link>
            <h1 className="text-3xl font-bold">Evaluations</h1>
            <p className="mt-1 text-zinc-400">
              Run evals to verify grammar conformance, semantic correctness, and
              safety of the GPT-5 CFG pipeline.
            </p>
          </div>
          <button
            onClick={handleRunAll}
            disabled={runningAll || isLoading}
            className="rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {runningAll ? "Running..." : "Run All Evals"}
          </button>
        </div>

        {totalRun > 0 && (
          <div
            className={`rounded-lg border p-4 text-center text-lg font-semibold ${
              totalPassed === totalRun
                ? "border-green-700 bg-green-900/30 text-green-300"
                : "border-yellow-700 bg-yellow-900/30 text-yellow-300"
            }`}
          >
            {totalPassed}/{totalRun} evals passed
            {totalPassed === totalRun && " ✓"}
          </div>
        )}

        {isLoading && <p className="text-zinc-500">Loading eval cases...</p>}

        {evalCases?.map((evalCase) => {
          const result = results[evalCase.id];
          const isRunning = running[evalCase.id];

          return (
            <div
              key={evalCase.id}
              className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 p-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">{evalCase.name}</h2>
                    <span
                      className={`rounded-full border px-3 py-0.5 text-xs font-medium ${
                        CATEGORY_COLORS[evalCase.category] ?? ""
                      }`}
                    >
                      {evalCase.category}
                    </span>
                    {result && (
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                          result.passed
                            ? "bg-green-900/50 text-green-300"
                            : "bg-red-900/50 text-red-300"
                        }`}
                      >
                        {result.passed ? "PASSED" : "FAILED"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">
                    {evalCase.description}
                  </p>
                </div>
                <button
                  onClick={() => handleRun(evalCase.id)}
                  disabled={isRunning ?? false}
                  className="shrink-0 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-50"
                >
                  {isRunning ? "Running..." : "Run"}
                </button>
              </div>

              <div className="border-b border-zinc-800/50 px-5 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Input Query
                </span>
                <p className="mt-1 text-sm text-zinc-300">
                  &ldquo;{evalCase.query}&rdquo;
                </p>
              </div>

              {result && (
                <>
                  <div className="border-b border-zinc-800/50 px-5 py-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Generated SQL
                    </span>
                    {result.sql ? (
                      <pre className="mt-1 overflow-x-auto text-sm text-green-400">
                        {result.sql}
                      </pre>
                    ) : (
                      <p className="mt-1 text-sm text-red-400">
                        Generation failed: {result.generationError}
                      </p>
                    )}
                  </div>

                  <div className="border-b border-zinc-800/50 px-5 py-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Assertions
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {result.assertions.map((assertion, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span
                            className={
                              assertion.passed ? "text-green-400" : "text-red-400"
                            }
                          >
                            {assertion.passed ? "✓" : "✗"}
                          </span>
                          <span
                            className={
                              assertion.passed ? "text-zinc-300" : "text-red-300"
                            }
                          >
                            {assertion.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-6 px-5 py-3 text-xs text-zinc-500">
                    <span>Rows returned: {result.rowCount}</span>
                    <span>Duration: {(result.durationMs / 1000).toFixed(1)}s</span>
                    {result.executionError && (
                      <span className="text-red-400">
                        Execution error: {result.executionError}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

