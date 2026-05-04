"use client";

import React, { useState } from "react";
import { CardResult } from "@/lib/api";
import { User, Building2, Mail, Phone, MapPin, ChevronDown, ChevronUp, Sparkles, ShieldCheck, Edit3, Check, X } from "lucide-react";

interface Props {
  result: CardResult;
  index: number;
  onChange: (updated: CardResult) => void;
}

type EF = "name" | "company" | "address";

export default function ResultCard({ result, index, onChange }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [editing, setEditing] = useState<EF | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (f: EF) => { setDraft(result[f] as string); setEditing(f); };
  const commit = () => { if (!editing) return; onChange({ ...result, [editing]: draft }); setEditing(null); };
  const cancel = () => setEditing(null);

  const pct = Math.round(result.confidence * 100);
  const isLLM = result.method === "llm";

  return (
    <div className={`rounded-2xl border bg-white/5 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:bg-white/[0.08] ${result.error ? "border-red-500/30" : "border-white/10"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
          <p className="text-xs text-white/60 truncate max-w-[180px]">{result.image}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${isLLM ? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
            {isLLM ? <><Sparkles className="w-2.5 h-2.5" />LLM</> : <><ShieldCheck className="w-2.5 h-2.5" />Rules</>}
          </span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${pct >= 70 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : pct >= 40 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>{pct}%</span>
        </div>
      </div>

      {result.error ? (
        <div className="px-5 py-5 text-red-400 text-sm flex items-center gap-2"><X className="w-4 h-4 shrink-0" />{result.error}</div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          <InlineField icon={<User className="w-3.5 h-3.5" />} label="Name" value={result.name} field="name" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} />
          <InlineField icon={<Building2 className="w-3.5 h-3.5" />} label="Company" value={result.company} field="company" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} />

          <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-violet-400 shrink-0"><Mail className="w-3.5 h-3.5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Email</p>
              {result.emails.length > 0 ? result.emails.map((e) => <p key={e} className="text-sm text-white/80 font-mono break-all">{e}</p>) : <p className="text-sm text-white/25 italic">Not found</p>}
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-violet-400 shrink-0"><Phone className="w-3.5 h-3.5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Phone</p>
              {result.phones.length > 0 ? result.phones.map((p) => <p key={p} className="text-sm text-white/80 font-mono">{p}</p>) : <p className="text-sm text-white/25 italic">Not found</p>}
            </div>
          </div>

          <InlineField icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={result.address} field="address" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} multiline />

          {result.raw_text && (
            <div>
              <button onClick={() => setShowRaw(s => !s)} className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors">
                {showRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showRaw ? "Hide" : "Show"} raw OCR text
              </button>
              {showRaw && <pre className="mt-2 text-[11px] text-white/50 bg-black/30 rounded-xl p-3 overflow-auto max-h-36 font-mono whitespace-pre-wrap">{result.raw_text}</pre>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InlineField({ icon, label, value, field, editing, draft, onStart, onChange, onCommit, onCancel, multiline = false }: {
  icon: React.ReactNode; label: string; value: string; field: EF;
  editing: EF | null; draft: string;
  onStart: (f: EF) => void; onChange: (v: string) => void;
  onCommit: () => void; onCancel: () => void; multiline?: boolean;
}) {
  const isEditing = editing === field;
  return (
    <div className="flex gap-3 items-start group">
      <div className="mt-0.5 text-violet-400 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{label}</p>
        {isEditing ? (
          <div className="space-y-1.5">
            {multiline
              ? <textarea autoFocus value={draft} onChange={e => onChange(e.target.value)} className="w-full bg-white/10 text-white text-sm rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 resize-none" rows={3} />
              : <input autoFocus value={draft} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }} className="w-full bg-white/10 text-white text-sm rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-violet-500" />}
            <div className="flex gap-2">
              <button onClick={onCommit} className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Check className="w-3 h-3" /></button>
              <button onClick={onCancel} className="p-1 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30"><X className="w-3 h-3" /></button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className={`text-sm flex-1 break-words ${value ? "text-white/80" : "text-white/25 italic"}`}>{value || "Not found"}</p>
            {editing === null && (
              <button onClick={() => onStart(field)} className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-white/10 text-white/40 hover:text-white/70 transition-all shrink-0 mt-0.5">
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
