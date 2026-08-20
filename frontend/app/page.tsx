"use client";

import React, { useState, useCallback } from "react";
import { Zap, RotateCcw, BookUser, ChevronRight, Sparkles } from "lucide-react";

import UploadZone from "@/components/UploadZone";
import BatchProgress from "@/components/BatchProgress";
import ResultCard from "@/components/ResultCard";
import ExportPanel from "@/components/ExportPanel";
import ContactsView from "@/components/ContactsView";
import { useUpload } from "@/hooks/useUpload";
import { useJobPolling } from "@/hooks/useJobPolling";
import { CardResult, getResults, warmupBackend } from "@/lib/api";

type Stage = "upload" | "processing" | "results" | "contacts";

export default function HomePage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<CardResult[]>([]);

  const { upload, uploadPct, isUploading, error: uploadError } = useUpload();
  const { status, isDone } = useJobPolling(jobId);

  // Wake up the backend immediately on page load
  React.useEffect(() => {
    warmupBackend();
  }, []);

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
    <main className="min-h-screen flex flex-col relative overflow-x-hidden antialiased">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-surface-border text-on-surface font-body font-medium fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-8 h-20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-headline font-bold text-on-surface tracking-tight">CardScan AI</span>
        </div>

        <div className="flex items-center gap-4 md:gap-8 text-sm font-medium tracking-wide">
          {stage !== "upload" && stage !== "contacts" ? (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors font-bold font-body"
            >
              <RotateCcw className="w-4 h-4" /> New Batch
            </button>
          ) : (
            <button
              onClick={() => { reset(); setStage("upload"); }}
              className={`pb-1 font-bold font-body transition-colors ${stage === "upload" ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-primary"}`}
            >
              Upload
            </button>
          )}

          <button
            onClick={() => setStage(stage === "contacts" ? "upload" : "contacts")}
            className="bg-on-surface text-white px-5 py-2.5 rounded-full font-headline font-semibold text-xs md:text-sm hover:bg-on-surface/90 transition-all active:scale-95 shadow-md shadow-on-surface/10 flex items-center gap-1.5"
          >
            <BookUser className="w-4 h-4" />
            All Contacts
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-grow pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex flex-col items-center">
        
        {/* ── Hero (only on upload stage) ──────────────────────── */}
        {stage === "upload" && (
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm border border-surface-border text-primary font-bold text-xs tracking-wider uppercase mb-8 font-body">
              <Zap className="w-3.5 h-3.5 text-primary" />
              OCR + AI Hybrid Pipeline
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-bold text-on-surface mb-6 tracking-tight leading-tight">
              Extract contacts <br />
              <span className="text-primary italic font-semibold">instantly.</span>
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed font-body">
              Upload business cards or snap a photo. Our smart hybrid pipeline effortlessly pulls out names, numbers, and emails, ready for your workflow.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="px-4 py-2 rounded-full bg-white border border-surface-border text-on-surface-variant text-sm shadow-sm font-semibold font-body">Up to 25 cards</span>
              <span className="px-4 py-2 rounded-full bg-white border border-surface-border text-on-surface-variant text-sm shadow-sm font-semibold font-body">OCR-first, LLM fallback</span>
              <span className="px-4 py-2 rounded-full bg-white border border-surface-border text-on-surface-variant text-sm shadow-sm font-semibold font-body">Excel &amp; Google Sheets</span>
            </div>
          </div>
        )}

        {/* ── Upload Stage ─────────────────────────────────────── */}
        {stage === "upload" && (
          <div className="w-full max-w-6xl">
            <UploadZone
              onFiles={handleFiles}
              isUploading={isUploading}
              uploadPct={uploadPct}
              onViewAll={() => setStage("contacts")}
            />
            {uploadError && (
              <p className="mt-6 text-sm text-red-500 text-center font-semibold font-body">{uploadError}</p>
            )}
          </div>
        )}

        {/* ── Processing Stage ─────────────────────────────────── */}
        {stage === "processing" && (
          <div className="max-w-3xl w-full mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-headline font-bold text-on-surface">Processing your cards</h2>
              <p className="text-on-surface-variant/80 text-sm font-body font-semibold">Sit tight — extraction runs in parallel</p>
            </div>
            <div className="bg-white border border-surface-border rounded-3xl p-8 shadow-xl">
              <BatchProgress status={status} />
            </div>
          </div>
        )}

        {/* ── Results Stage ────────────────────────────────────── */}
        {stage === "results" && results.length > 0 && (
          <div className="space-y-8 w-full max-w-6xl">
            {/* Summary bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-6">
              <div>
                <h2 className="text-3xl font-headline font-bold text-on-surface">Extracted Results</h2>
                <p className="text-on-surface-variant/85 text-sm mt-0.5 font-body font-semibold">
                  {doneCount} cards extracted successfully
                  {llmCount > 0 && ` · ${llmCount} used LLM fallback`}
                </p>
              </div>

              {/* Aggregate stats */}
              <div className="flex flex-wrap gap-2.5">
                {[
                  { label: "Total", value: results.length, color: "text-on-surface" },
                  { label: "Success", value: doneCount, color: "text-emerald-600" },
                  { label: "LLM Used", value: llmCount, color: "text-secondary" },
                  { label: "Failed", value: results.filter(r => r.error).length, color: "text-red-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white border border-surface-border rounded-2xl px-4 py-2 text-center min-w-[76px] shadow-sm">
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-wider font-body">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Export panel */}
            <ExportPanel jobId={jobId!} results={results} />

            {/* Results grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-4">
              {results.map((r, i) => (
                <ResultCard
                  key={r.image + i}
                  result={r}
                  index={i}
                  onChange={(updated) => handleResultChange(i, updated)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Contacts Stage ────────────────────────────────────── */}
        {stage === "contacts" && (
          <div className="w-full max-w-6xl">
            <ContactsView onBack={() => setStage("upload")} />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-surface-border text-on-surface-variant font-body text-sm w-full py-10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-6 md:px-8 max-w-7xl mx-auto w-full">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              CardScan AI
            </div>
            <p className="text-xs text-on-surface-variant/60 font-semibold tracking-wide">© 2026 CardScan AI. Precision in curation.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm font-semibold">
            <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
            <a className="hover:text-primary transition-colors" href="#">Cookies</a>
            <a className="hover:text-primary transition-colors" href="#">Legal</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
