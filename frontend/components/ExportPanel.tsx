"use client";

import React, { useState } from "react";
import { CardResult, exportToExcel, exportToSheets } from "@/lib/api";
import { Download, Sheet, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  results: CardResult[];
}

export default function ExportPanel({ jobId, results }: Props) {
  const [excelLoading, setExcelLoading] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await exportToExcel(jobId, results);
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
      const url = await exportToSheets(jobId, results);
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
      <div className="px-6 py-4 border-b border-white/10 bg-white/5">
        <h3 className="text-base font-semibold text-white">Export Results</h3>
        <p className="text-xs text-white/50 mt-0.5">{validCount} of {results.length} cards ready to export</p>
      </div>

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
          <a href={sheetsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            Open Sheet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
