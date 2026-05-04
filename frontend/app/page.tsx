"use client";

import React, { useState, useCallback } from "react";
import { Scan, ChevronRight, RotateCcw } from "lucide-react";

import UploadZone from "@/components/UploadZone";
import BatchProgress from "@/components/BatchProgress";
import ResultCard from "@/components/ResultCard";
import ExportPanel from "@/components/ExportPanel";
import { useUpload } from "@/hooks/useUpload";
import { useJobPolling } from "@/hooks/useJobPolling";
import { CardResult, getResults } from "@/lib/api";

type Stage = "upload" | "processing" | "results";

export default function HomePage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<CardResult[]>([]);

  const { upload, uploadPct, isUploading, error: uploadError } = useUpload();
  const { status, isDone } = useJobPolling(jobId);

  // When processing finishes, fetch final results
  const prevDone = React.useRef(false);
  React.useEffect(() => {
    if (isDone && !prevDone.current && jobId) {
      prevDone.current = true;
      getResults(jobId).then((r) => {
        setResults(r);
        setStage("results");
      });
    }
  }, [isDone, jobId]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      prevDone.current = false;
      const resp = await upload(files);
      if (resp) {
        setJobId(resp.job_id);
        setStage("processing");
      }
    },
    [upload]
  );

  const handleResultChange = (idx: number, updated: CardResult) => {
    setResults((prev) => prev.map((r, i) => (i === idx ? updated : r)));
  };

  const reset = () => {
    setStage("upload");
    setJobId(null);
    setResults([]);
    prevDone.current = false;
  };

  const doneCount = results.filter((r) => !r.error).length;
  const llmCount = results.filter((r) => r.method === "llm").length;

  return (
    <main className="min-h-screen relative z-10">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Scan className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">CardScan <span className="gradient-text">AI</span></span>
          </div>

          <div className="flex items-center gap-3">
            {stage !== "upload" && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> New Batch
              </button>
            )}
            {/* Stage breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/30">
              <span className={stage === "upload" ? "text-violet-400 font-semibold" : ""}>Upload</span>
              <ChevronRight className="w-3 h-3" />
              <span className={stage === "processing" ? "text-violet-400 font-semibold" : ""}>Processing</span>
              <ChevronRight className="w-3 h-3" />
              <span className={stage === "results" ? "text-violet-400 font-semibold" : ""}>Results</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">

        {/* ── Hero (only on upload stage) ──────────────────────── */}
        {stage === "upload" && (
          <div className="text-center space-y-4 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-2">
              <Scan className="w-3 h-3" /> OCR + AI Hybrid Pipeline
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Extract contacts from<br />
              <span className="gradient-text">visiting cards instantly</span>
            </h1>
            <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Upload up to 25 business cards. Our hybrid pipeline uses OCR + rule-based extraction
              first — LLM only kicks in when confidence is low. Export to Excel or Google Sheets.
            </p>

            {/* Stats pills */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {[
                { label: "Up to 25 cards", color: "violet" },
                { label: "OCR-first, LLM fallback", color: "fuchsia" },
                { label: "Excel & Google Sheets", color: "blue" },
              ].map(({ label, color }) => (
                <span key={label} className={`px-3 py-1 rounded-full text-xs font-medium border
                  bg-${color}-500/10 border-${color}-500/20 text-${color}-300`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Upload Stage ─────────────────────────────────────── */}
        {stage === "upload" && (
          <div className="max-w-3xl mx-auto">
            <div className="glass rounded-3xl p-8 shadow-2xl shadow-black/50">
              <UploadZone
                onFiles={handleFiles}
                isUploading={isUploading}
                uploadPct={uploadPct}
              />
              {uploadError && (
                <p className="mt-4 text-sm text-red-400 text-center">{uploadError}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Processing Stage ─────────────────────────────────── */}
        {stage === "processing" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">Processing your cards</h2>
              <p className="text-white/50 text-sm">Sit tight — extraction runs in parallel</p>
            </div>
            <div className="glass rounded-3xl p-8 shadow-2xl shadow-black/50">
              <BatchProgress status={status} />
            </div>
          </div>
        )}

        {/* ── Results Stage ────────────────────────────────────── */}
        {stage === "results" && results.length > 0 && (
          <div className="space-y-8">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Extracted Results</h2>
                <p className="text-white/50 text-sm mt-0.5">
                  {doneCount} cards extracted successfully
                  {llmCount > 0 && ` · ${llmCount} used LLM fallback`}
                </p>
              </div>

              {/* Aggregate stats */}
              <div className="flex gap-3">
                {[
                  { label: "Total", value: results.length, color: "white/60" },
                  { label: "Success", value: doneCount, color: "emerald-400" },
                  { label: "LLM Used", value: llmCount, color: "fuchsia-400" },
                  { label: "Failed", value: results.filter(r => r.error).length, color: "red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="glass rounded-xl px-4 py-2.5 text-center">
                    <p className={`text-lg font-bold text-${color}`}>{value}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Export panel */}
            <ExportPanel jobId={jobId!} results={results} />

            {/* Results grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((r, i) => (
                <ResultCard
                  key={r.image + i}
                  result={r}
                  index={i}
                  onChange={(updated) => handleResultChange(i, updated)}
                />
              ))}
            </div>

            {/* Bottom export panel */}
            <ExportPanel jobId={jobId!} results={results} />
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white/30 text-sm">
            <Scan className="w-3.5 h-3.5" />
            <span>CardScan AI — OCR + LLM Hybrid Pipeline</span>
          </div>
          <p className="text-white/20 text-xs">
            Data processed locally. LLM used only when confidence &lt; 70%.
          </p>
        </div>
      </footer>
    </main>
  );
}
