"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SheetContact, getSheetContacts } from "@/lib/api";
import {
  Search, User, Building2, Phone, Mail, MapPin,
  MessageSquare, Loader2, AlertCircle, RefreshCw,
  ChevronUp, ChevronDown,
} from "lucide-react";

interface Props {
  onBack: () => void;
}

type SortKey = "name" | "company";
type SortDir = "asc" | "desc";

export default function ContactsView({ onBack }: Props) {
  const [contacts, setContacts]   = useState<SheetContact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [query, setQuery]         = useState("");
  const [sortKey, setSortKey]     = useState<SortKey>("name");
  const [sortDir, setSortDir]     = useState<SortDir>("asc");
  const [expanded, setExpanded]   = useState<number | null>(null);

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

  useEffect(() => { load(); }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return contacts
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.phones.includes(q) ||
        c.emails.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const va = (a[sortKey] || "").toLowerCase();
        const vb = (b[sortKey] || "").toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [contacts, query, sortKey, sortDir]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortDir === "asc"
        ? <ChevronUp className="w-3 h-3" />
        : <ChevronDown className="w-3 h-3" />
      : null;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">All Contacts</h2>
          <p className="text-white/50 text-sm mt-0.5">
            Saved in Google Sheet · {loading ? "loading…" : `${contacts.length} total`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, company, phone, email…"
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4
            text-sm text-white placeholder:text-white/25 outline-none
            focus:border-violet-500/50 focus:bg-violet-500/5 transition-all duration-200"
        />
      </div>

      {/* ── Sort pills ──────────────────────────────────────────────── */}
      <div className="flex gap-2 text-xs">
        {(["name", "company"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => toggleSort(k)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all capitalize
              ${sortKey === k
                ? "border-violet-500/60 bg-violet-500/15 text-violet-300"
                : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
              }`}
          >
            {k} <SortIcon k={k} />
          </button>
        ))}
        <span className="ml-auto text-white/30 self-center">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── States ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/40">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <p className="text-sm">Loading contacts from Google Sheet…</p>
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
          <p className="text-sm">{query ? "No contacts match your search" : "No contacts saved yet"}</p>
        </div>
      )}

      {/* ── Contact Cards ────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const isOpen = expanded === i;
            const phones = c.phones.split(";").map((p) => p.trim()).filter(Boolean);
            const emails = c.emails.split(";").map((e) => e.trim()).filter(Boolean);
            return (
              <div
                key={i}
                onClick={() => setExpanded(isOpen ? null : i)}
                className={`glass rounded-2xl p-5 cursor-pointer border transition-all duration-200
                  ${isOpen
                    ? "border-violet-500/40 bg-violet-500/5 shadow-lg shadow-violet-500/10"
                    : "border-white/[0.06] hover:border-white/20"
                  }`}
              >
                {/* Name & Company */}
                <div className="flex items-start gap-3 mb-3">
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

                {/* Always visible: primary phone + email */}
                {phones[0] && (
                  <div className="flex items-center gap-2 text-xs text-white/60 mb-1.5">
                    <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{phones[0]}</span>
                    {phones.length > 1 && (
                      <span className="text-white/30">+{phones.length - 1}</span>
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

                {/* Tap hint */}
                <p className="text-[10px] text-white/20 text-right mt-3">
                  {isOpen ? "tap to collapse" : "tap to expand"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
