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

// ── vCard builder ────────────────────────────────────────────────────────────

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
      if (!norm) continue;
      if (!seenPhones.has(norm)) {
        seenPhones.add(norm);
        uniquePhones.push(p);
      }
    }

    const displayName = c.name || c.company || "Unknown Contact";
    const lines: string[] = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${vcEscape(displayName)}`,
    ];

    if (c.name) {
      const parts = c.name.trim().split(/\s+/);
      const last  = parts.length > 1 ? parts[parts.length - 1] : "";
      const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
      lines.push(`N:${vcEscape(last)};${vcEscape(first)};;;`);
    }

    if (c.company) lines.push(`ORG:${vcEscape(c.company)}`);

    emails.forEach((e) =>
      lines.push(`EMAIL;TYPE=WORK,INTERNET:${vcEscape(e)}`)
    );

    uniquePhones.forEach((p) =>
      lines.push(`TEL;TYPE=WORK,VOICE:${p}`)
    );

    if (c.address) lines.push(`ADR;TYPE=WORK:;;${vcEscape(c.address)};;;;`);

    const note = c.remarks ? c.remarks.trim() : "";
    if (note) lines.push(`NOTE:${vcEscape(note)}`);

    lines.push("END:VCARD");
    vcards.push(lines.join("\r\n"));
  }

  return vcards.join("\r\n");
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ContactsView({ onBack }: Props) {
  const [contacts, setContacts] = useState<SheetContact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [query, setQuery]       = useState("");
  const [sortKey, setSortKey]   = useState<SortKey>("latest");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");

  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Load from Sheets API
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSheetContacts();
      setContacts(data);
    } catch (e: any) {
      setError(e.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Clear selection on sort/query change to avoid index mismatch
  useEffect(() => {
    setSelected(new Set());
  }, [sortKey, sortDir, query]);

  // Toggle sorting
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "latest" ? "desc" : "asc");
    }
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
      sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
    ) : null;

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className={`space-y-6 ${selected.size > 0 ? "pb-24" : ""}`}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">All Contacts</h2>
          <p className="text-on-surface-variant/70 text-sm mt-0.5 font-body">
            {loading ? "Loading…" : `${contacts.length} saved in Google Sheet`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary transition-all disabled:opacity-30 shrink-0 font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, company, phone, email…"
          className="w-full bg-white border border-surface-border rounded-xl py-3 pl-11 pr-4
            text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none
            focus:border-primary/50 focus:bg-primary/[0.01] transition-all duration-200 font-body"
        />
      </div>

      {/* ── Sort row ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {(["latest", "name", "company"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => toggleSort(k)}
            className={`flex items-center gap-1 px-4.5 py-2 rounded-full border transition-all capitalize text-xs font-bold font-body
              ${sortKey === k
                ? "border-primary bg-primary/10 text-primary"
                : "border-surface-border bg-white text-on-surface-variant/75 hover:border-primary/40 hover:text-on-surface"
              }`}
          >
            {k} <SortIcon k={k} />
          </button>
        ))}
        <span className="ml-auto text-on-surface-variant/50 text-xs shrink-0 font-body font-semibold">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Select-all row ──────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-primary transition-colors font-bold font-body"
          >
            {allSelected
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-secondary font-bold font-body">
              {selected.size} selected
            </span>
          )}
        </div>
      )}

      {/* ── States ────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant/50">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold font-body">Loading contacts…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm font-body">Could not load contacts</p>
            <p className="text-xs text-red-600/80 mt-0.5 font-body">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-2 text-on-surface-variant/40">
          <User className="w-10 h-10 stroke-[1.5]" />
          <p className="text-sm font-semibold font-body">
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
                className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-200 relative shadow-sm hover:shadow-md
                  ${isSel
                    ? "border-secondary bg-secondary/[0.02] ring-1 ring-secondary/20 shadow-md shadow-secondary/5"
                    : isOpen
                    ? "border-primary bg-primary/[0.01] ring-1 ring-primary/10 shadow-md shadow-primary/5"
                    : "border-surface-border hover:border-primary/20"
                  }`}
              >
                {/* Select checkbox */}
                <button
                  onClick={(e) => toggleSelect(i, e)}
                  className="absolute top-4.5 right-4.5 text-on-surface-variant/40 hover:text-secondary transition-colors z-10 p-1"
                  title={isSel ? "Deselect" : "Select"}
                >
                  {isSel
                    ? <CheckSquare className="w-4 h-4 text-secondary" />
                    : <Square className="w-4 h-4" />}
                </button>

                {/* Name & Company */}
                <div className="flex items-start gap-3.5 mb-3 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface text-sm truncate font-body">
                      {c.name || <span className="text-on-surface-variant/30 italic font-semibold">No name</span>}
                    </p>
                    {c.company && (
                      <p className="text-xs text-on-surface-variant/70 truncate flex items-center gap-1 mt-0.5 font-body">
                        <Building2 className="w-3 h-3 shrink-0" /> {c.company}
                      </p>
                    )}
                  </div>
                </div>

                {/* Primary phone + email */}
                {phones[0] && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant/90 mb-1.5 font-body font-medium">
                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{phones[0]}</span>
                    {phones.length > 1 && (
                      <span className="text-on-surface-variant/40 shrink-0 font-bold">+{phones.length - 1}</span>
                    )}
                  </div>
                )}
                {emails[0] && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant/90 mb-1.5 font-body font-medium">
                    <Mail className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate">{emails[0]}</span>
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3.5 pt-3.5 border-t border-surface-border space-y-2">
                    {phones.slice(1).map((p, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-on-surface-variant/90 font-body font-medium">
                        <Phone className="w-3 h-3 text-emerald-600 shrink-0" /> {p}
                      </div>
                    ))}
                    {emails.slice(1).map((e, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-on-surface-variant/90 font-body font-medium">
                        <Mail className="w-3 h-3 text-primary shrink-0" /> {e}
                      </div>
                    ))}
                    {c.address && (
                      <div className="flex items-start gap-2 text-xs text-on-surface-variant/90 font-body font-medium">
                        <MapPin className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <span>{c.address}</span>
                      </div>
                    )}
                    {c.remarks && (
                      <div className="flex items-start gap-2 text-xs text-on-surface-variant/75 mt-1.5 pt-2.5 border-t border-surface-border">
                        <MessageSquare className="w-3 h-3 text-secondary shrink-0 mt-0.5" />
                        <span className="italic font-body">{c.remarks}</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-on-surface-variant/30 text-right mt-3 font-semibold font-body">
                  {isOpen ? "tap to collapse" : "tap to expand"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Sticky bottom action bar (appears when items selected) ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white/95 backdrop-blur-xl border-t border-surface-border shadow-2xl">
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <div className="flex-1">
              <p className="text-on-surface font-bold text-sm font-body">
                {selected.size} contact{selected.size > 1 ? "s" : ""} selected
              </p>
              <p className="text-on-surface-variant/60 text-xs font-semibold font-body">Tap Download to save as .vcf</p>
            </div>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-on-surface-variant/60 hover:text-primary transition-colors px-2 py-1 font-bold font-body"
            >
              Clear
            </button>
            <button
              onClick={downloadSelected}
              className="flex items-center gap-1.5 px-5 py-3 rounded-full text-sm font-bold
                bg-primary hover:bg-primary/95 text-white transition-all active:scale-95 shadow-md shadow-primary/20"
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
