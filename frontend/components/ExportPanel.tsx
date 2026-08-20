"use client";

import React, { useState } from "react";
import { CardResult, exportToExcel, exportToSheets } from "@/lib/api";
import {
  Download,
  Sheet,
  Loader2,
  ExternalLink,
  CheckCircle2,
  MessageSquare,
  Target,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  results: CardResult[];
}

export default function ExportPanel({ jobId, results }: Props) {
  const [excelLoading, setExcelLoading] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);

  // ── New fields ──────────────────────────────────────────────────────────
  const [remarks, setRemarks] = useState("");
  const [purpose, setPurpose] = useState("");

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await exportToExcel(jobId, results, remarks || undefined, purpose || undefined);
      toast.success("Excel file downloaded!");
    } catch (e: any) {
      toast.error(e.message || "Excel export failed");
    } finally {
      setExcelLoading(false);
    }
  };

  const handleSheets = async () => {
    setSheetsLoading(true);
    setSheetsUrl(null);
    try {
      const url = await exportToSheets(
        jobId,
        results,
        undefined,
        remarks || undefined,
        purpose || undefined
      );
      setSheetsUrl(url);
      toast.success("Data appended to Google Sheets!");
    } catch (e: any) {
      toast.error(e.message || "Google Sheets export failed");
    } finally {
      setSheetsLoading(false);
    }
  };

  const validCount = results.filter((r) => !r.error).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-white/5">
        <h3 className="text-base font-semibold text-white">Export Results</h3>
        <p className="text-xs text-white/50 mt-0.5">
          {validCount} of {results.length} cards ready to export
        </p>
      </div>

      {/* ── Chat-box inputs ─────────────────────────────────────────── */}
      <div className="px-5 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Remarks */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
            <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
            Remarks
          </label>
          <div
            className="relative rounded-xl border border-white/10 bg-white/[0.04]
              focus-within:border-violet-500/60 focus-within:bg-violet-500/5
              transition-all duration-200"
          >
            <textarea
              id="export-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any notes or observations about this batch…"
              rows={3}
              className="w-full bg-transparent resize-none px-4 py-3 text-sm text-white
                placeholder:text-white/25 outline-none leading-relaxed"
            />
            {remarks && (
              <span className="absolute bottom-2 right-3 text-[10px] text-white/25">
                {remarks.length} chars
              </span>
            )}
          </div>
        </div>

        {/* Purpose */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
            <Target className="w-3.5 h-3.5 text-fuchsia-400" />
            Purpose
          </label>
          <div
            className="relative rounded-xl border border-white/10 bg-white/[0.04]
              focus-within:border-fuchsia-500/60 focus-within:bg-fuchsia-500/5
              transition-all duration-200"
          >
            <textarea
              id="export-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What is the purpose of scanning these cards? (e.g. Sales meeting, Conference, Follow-up)"
              rows={3}
              className="w-full bg-transparent resize-none px-4 py-3 text-sm text-white
                placeholder:text-white/25 outline-none leading-relaxed"
            />
            {purpose && (
              <span className="absolute bottom-2 right-3 text-[10px] text-white/25">
                {purpose.length} chars
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Export Buttons ───────────────────────────────────────────── */}
      <div className="p-5 flex flex-col sm:flex-row gap-3">
        {/* Excel */}
        <button
          onClick={handleExcel}
          disabled={excelLoading || results.length === 0}
          className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-emerald-600 to-teal-600
            hover:from-emerald-500 hover:to-teal-500
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-[0.98] transition-all duration-200 shadow-lg shadow-emerald-500/20 text-white"
        >
          {excelLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />}
          Download Excel (.xlsx)
        </button>

        {/* Google Sheets */}
        <button
          onClick={handleSheets}
          disabled={sheetsLoading || results.length === 0}
          className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-blue-600 to-indigo-600
            hover:from-blue-500 hover:to-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-[0.98] transition-all duration-200 shadow-lg shadow-blue-500/20 text-white"
        >
          {sheetsLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sheet className="w-4 h-4" />}
          Push to Google Sheets
        </button>
      </div>

      {/* Sheets link after success */}
      {sheetsUrl && (
        <div className="mx-5 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm text-blue-300 flex-1">Appended successfully!</span>
          <a
            href={sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Open Sheet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
