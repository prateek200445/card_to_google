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
  Contact,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  results: CardResult[];
}

// ── vCard helpers ────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function vcEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/\n/g, "\\n").replace(/;/g, "\\;");
}

function generateVcf(results: CardResult[], remarks: string): { vcf: string; contactCount: number; skippedPhones: number } {
  const seenPhones = new Set<string>();
  const vcards: string[] = [];
  let skippedPhones = 0;

  for (const r of results) {
    if (r.error) continue;

    const uniquePhones: string[] = [];
    for (const p of r.phones) {
      const norm = normalizePhone(p);
      if (!norm) continue;
      if (seenPhones.has(norm)) {
        skippedPhones++;
      } else {
        seenPhones.add(norm);
        uniquePhones.push(p);
      }
    }

    const displayName = r.name || r.company || "Unknown Contact";

    const lines: string[] = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${vcEscape(displayName)}`,
    ];

    if (r.name) {
      const parts = r.name.trim().split(/\s+/);
      const last  = parts.length > 1 ? parts[parts.length - 1] : "";
      const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
      lines.push(`N:${vcEscape(last)};${vcEscape(first)};;;`);
    }

    if (r.company) lines.push(`ORG:${vcEscape(r.company)}`);

    r.emails.forEach((e) =>
      lines.push(`EMAIL;TYPE=WORK,INTERNET:${vcEscape(e)}`)
    );

    uniquePhones.forEach((p) =>
      lines.push(`TEL;TYPE=WORK,VOICE:${p}`)
    );

    if (r.address) lines.push(`ADR;TYPE=WORK:;;${vcEscape(r.address)};;;;`);

    const note = remarks.trim();
    if (note) lines.push(`NOTE:${vcEscape(note)}`);

    lines.push("END:VCARD");
    vcards.push(lines.join("\r\n"));
  }

  return { vcf: vcards.join("\r\n"), contactCount: vcards.length, skippedPhones };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ExportPanel({ jobId, results }: Props) {
  const [excelLoading, setExcelLoading]   = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsUrl, setSheetsUrl]         = useState<string | null>(null);
  const [remarks, setRemarks]             = useState("");

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await exportToExcel(jobId, results, remarks || undefined);
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
      const url = await exportToSheets(jobId, results, undefined, remarks || undefined, undefined);
      setSheetsUrl(url);
      toast.success("Data appended to Google Sheets!");
    } catch (e: any) {
      toast.error(e.message || "Google Sheets export failed");
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleVcf = () => {
    const valid = results.filter((r) => !r.error);
    if (valid.length === 0) {
      toast.error("No valid contacts to export.");
      return;
    }
    const { vcf, contactCount, skippedPhones } = generateVcf(valid, remarks);
    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `contacts_${new Date().toISOString().slice(0, 10)}.vcf`;
    a.click();
    URL.revokeObjectURL(url);

    const msg = skippedPhones > 0
      ? `${contactCount} contacts saved · ${skippedPhones} duplicate number${skippedPhones > 1 ? "s" : ""} removed`
      : `${contactCount} contacts saved to .vcf`;
    toast.success(msg);
  };

  const validCount = results.filter((r) => !r.error).length;

  return (
    <div className="rounded-2xl border border-surface-border bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-border bg-surface-container/20">
        <h3 className="text-base font-bold text-on-surface">Export Results</h3>
        <p className="text-xs text-on-surface-variant font-medium mt-0.5 font-body">
          {validCount} of {results.length} cards ready to export
        </p>
      </div>

      {/* ── Remarks ───────────────────────────────────────────────────── */}
      <div className="px-5 pt-5">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider font-body">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            Remarks
          </label>
          <div
            className="relative rounded-xl border border-surface-border bg-surface-container/20
              focus-within:border-primary/50 focus-within:bg-primary/5
              transition-all duration-200"
          >
            <textarea
              id="export-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any notes or observations about this batch…"
              rows={3}
              className="w-full bg-transparent resize-none px-4 py-3 text-sm text-on-surface
                placeholder:text-on-surface-variant/40 outline-none leading-relaxed font-body"
            />
            {remarks && (
              <span className="absolute bottom-2 right-3 text-[10px] text-on-surface-variant/40 font-body">
                {remarks.length} chars
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Export Buttons ────────────────────────────────────────────── */}
      <div className="p-5 flex flex-col sm:flex-row gap-3">
        {/* Excel */}
        <button
          onClick={handleExcel}
          disabled={excelLoading || results.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-full font-bold text-sm
            bg-emerald-600 hover:bg-emerald-500 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-[0.98] transition-all duration-200 shadow-md shadow-emerald-500/10"
        >
          {excelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download Excel (.xlsx)
        </button>

        {/* Google Sheets */}
        <button
          onClick={handleSheets}
          disabled={sheetsLoading || results.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-full font-bold text-sm
            bg-primary hover:bg-primary/95 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-[0.98] transition-all duration-200 shadow-md shadow-primary/10"
        >
          {sheetsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4" />}
          Push to Google Sheets
        </button>

        {/* vCard / Contacts */}
        <button
          onClick={handleVcf}
          disabled={validCount === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-full font-bold text-sm
            bg-secondary hover:bg-secondary/95 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-[0.98] transition-all duration-200 shadow-md shadow-secondary/10"
        >
          <Contact className="w-4 h-4" />
          Save to Contacts (.vcf)
        </button>
      </div>

      {/* Sheets link after success */}
      {sheetsUrl && (
        <div className="mx-5 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-on-surface-variant font-medium flex-1 font-body">Appended successfully!</span>
          <a
            href={sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline transition-colors font-body"
          >
            Open Sheet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
