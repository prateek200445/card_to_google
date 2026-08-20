"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SheetContact, getSheetContacts } from "@/lib/api";
import {
  Search, User, Building2, Phone, Mail, MapPin,
  MessageSquare, Loader2, AlertCircle, RefreshCw,
  ChevronUp, ChevronDown, Contact, CheckSquare, Square,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
}

type SortKey = "latest" | "name" | "company";
type SortDir = "asc" | "desc";

// ── vCard helpers (same logic as ExportPanel) ───────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
function vcEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/\n/g, "\\n").replace(/;/g, "\\;");
}

function buildVcf(contacts: SheetContact[]): string {
  const seenPhones = new Set<string>();
  const vcards: string[] = [];

  for (const c of contacts) {
    const phones = c.phones.split(";").map((p) => p.trim()).filter(Boolean);
    const emails = c.emails.split(";").map((e) => e.trim()).filter(Boolean);

    const uniquePhones: string[] = [];
    for (const p of phones) {
      const norm = normalizePhone(p);
      if (!norm || seenPhones.has(norm)) continue;
      seenPhones.add(norm);
      uniquePhones.push(p);
    }

    const displayName = c.name || c.company || "Unknown Contact";
    const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcEscape(displayName)}`];

    if (c.name) {
      const parts = c.name.trim().split(/\s+/);
      const last  = parts.length > 1 ? parts[parts.length - 1] : "";
      const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
      lines.push(`N:${vcEscape(last)};${vcEscape(first)};;;`);
    }
    if (c.company) lines.push(`ORG:${vcEscape(c.company)}`);
    emails.forEach((e) => lines.push(`EMAIL;TYPE=WORK,INTERNET:${vcEscape(e)}`));
    uniquePhones.forEach((p) => lines.push(`TEL;TYPE=WORK,VOICE:${p}`));
    if (c.address) lines.push(`ADR;TYPE=WORK:;;${vcEscape(c.address)};;;;`);
    if (c.remarks) lines.push(`NOTE:${vcEscape(c.remarks)}`);

    lines.push("END:VCARD");
    vcards.push(lines.join("\r\n"));
  }
  return vcards.join("\r\n");
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ContactsView({ onBack }: Props) {
  const [contacts, setContacts]   = useState<SheetContact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [query, setQuery]         = useState("");
  const [sortKey, setSortKey]     = useState<SortKey>("latest");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [selected, setSelected]   = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      setContacts(await getSheetContacts());
    } catch (e: any) {
      setError(e.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "latest" ? "desc" : "asc");
    }
    setSelected(new Set()); // clear selection on sort change
  };

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const matched = contacts
      .map((c, originalIndex) => ({ c, originalIndex }))
      .filter(({ c }) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.phones.includes(q) ||
        c.emails.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );

    return matched.sort((a, b) => {
      if (sortKey === "latest") {
        // original sheet order = insertion order; higher index = more recent
        return sortDir === "desc"
          ? b.originalIndex - a.originalIndex
          : a.originalIndex - b.originalIndex;
      }
      const va = (a.c[sortKey as "name" | "company"] || "").toLowerCase();
      const vb = (b.c[sortKey as "name" | "company"] || "").toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [contacts, query, sortKey, sortDir]);

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleSelect = (filteredIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(filteredIdx) ? next.delete(filteredIdx) : next.add(filteredIdx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((_, i) => i)));
    }
  };

  const downloadSelected = () => {
    if (selected.size === 0) return;
    const chosen = [...selected].map((i) => filtered[i].c);
    const vcf = buildVcf(chosen);
    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `contacts_selected_${new Date().toISOString().slice(0, 10)}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${selected.size} contact${selected.size > 1 ? "s" : ""} saved to .vcf`);
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    ) : null;

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className={`space-y-5 ${selected.size > 0 ? "pb-24" : ""}`}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">All Contacts</h2>
          <p className="text-white/50 text-sm mt-0.5">
            {loading ? "Loading…" : `${contacts.length} saved in Google Sheet`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors disabled:opacity-30 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, company, phone, email…"
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4
            text-sm text-white placeholder:text-white/25 outline-none
            focus:border-violet-500/50 focus:bg-violet-500/5 transition-all duration-200"
        />
      </div>

      {/* ── Sort row ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {(["latest", "name", "company"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => toggleSort(k)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all capitalize text-xs
              ${sortKey === k
                ? "border-violet-500/60 bg-violet-500/15 text-violet-300"
                : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
              }`}
          >
            {k} <SortIcon k={k} />
          </button>
        ))}
        <span className="ml-auto text-white/30 text-xs shrink-0">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Select-all row (only when list has items) ──────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            {allSelected
              ? <CheckSquare className="w-4 h-4 text-violet-400" />
              : <Square className="w-4 h-4" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-fuchsia-400 font-medium">
              {selected.size} selected
            </span>
          )}
        </div>
      )}

      {/* ── States ────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/40">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <p className="text-sm">Loading contacts…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Could not load contacts</p>
            <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-2 text-white/30">
          <User className="w-10 h-10" />
          <p className="text-sm">
            {query ? "No contacts match your search" : "No contacts saved yet"}
          </p>
        </div>
      )}

      {/* ── Contact Cards ──────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(({ c }, i) => {
            const isOpen = expanded === i;
            const isSel  = selected.has(i);
            const phones = c.phones.split(";").map((p) => p.trim()).filter(Boolean);
            const emails = c.emails.split(";").map((e) => e.trim()).filter(Boolean);

            return (
              <div
                key={i}
                onClick={() => setExpanded(isOpen ? null : i)}
                className={`glass rounded-2xl p-5 cursor-pointer border transition-all duration-200 relative
                  ${isSel
                    ? "border-fuchsia-500/50 bg-fuchsia-500/5 shadow-lg shadow-fuchsia-500/10"
                    : isOpen
                    ? "border-violet-500/40 bg-violet-500/5 shadow-lg shadow-violet-500/10"
                    : "border-white/[0.06] hover:border-white/20"
                  }`}
              >
                {/* Select checkbox */}
                <button
                  onClick={(e) => toggleSelect(i, e)}
                  className="absolute top-4 right-4 text-white/30 hover:text-fuchsia-400 transition-colors z-10 p-1"
                  title={isSel ? "Deselect" : "Select"}
                >
                  {isSel
                    ? <CheckSquare className="w-4 h-4 text-fuchsia-400" />
                    : <Square className="w-4 h-4" />}
                </button>

                {/* Name & Company */}
                <div className="flex items-start gap-3 mb-3 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-violet-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">
                      {c.name || <span className="text-white/30 italic">No name</span>}
                    </p>
                    {c.company && (
                      <p className="text-xs text-white/50 truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 shrink-0" /> {c.company}
                      </p>
                    )}
                  </div>
                </div>

                {/* Primary phone + email */}
                {phones[0] && (
                  <div className="flex items-center gap-2 text-xs text-white/60 mb-1.5">
                    <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{phones[0]}</span>
                    {phones.length > 1 && (
                      <span className="text-white/30 shrink-0">+{phones.length - 1}</span>
                    )}
                  </div>
                )}
                {emails[0] && (
                  <div className="flex items-center gap-2 text-xs text-white/60 mb-1.5">
                    <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="truncate">{emails[0]}</span>
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    {phones.slice(1).map((p, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-white/60">
                        <Phone className="w-3 h-3 text-emerald-400 shrink-0" /> {p}
                      </div>
                    ))}
                    {emails.slice(1).map((e, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-white/60">
                        <Mail className="w-3 h-3 text-blue-400 shrink-0" /> {e}
                      </div>
                    ))}
                    {c.address && (
                      <div className="flex items-start gap-2 text-xs text-white/60">
                        <MapPin className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                        <span>{c.address}</span>
                      </div>
                    )}
                    {c.remarks && (
                      <div className="flex items-start gap-2 text-xs text-white/50 mt-1 pt-2 border-t border-white/[0.06]">
                        <MessageSquare className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                        <span className="italic">{c.remarks}</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-white/20 text-right mt-3">
                  {isOpen ? "tap to collapse" : "tap to expand"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Sticky bottom action bar (appears when items selected) ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">
                {selected.size} contact{selected.size > 1 ? "s" : ""} selected
              </p>
              <p className="text-white/40 text-xs">Tap Download to save as .vcf</p>
            </div>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1"
            >
              Clear
            </button>
            <button
              onClick={downloadSelected}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-fuchsia-600 to-violet-600
                hover:from-fuchsia-500 hover:to-violet-500
                text-white transition-all active:scale-95 shadow-lg shadow-fuchsia-500/30"
            >
              <Contact className="w-4 h-4" />
              Download (.vcf)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

