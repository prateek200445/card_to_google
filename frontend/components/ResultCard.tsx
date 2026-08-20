"use client";

import React, { useState } from "react";
import { CardResult } from "@/lib/api";
import { User, Building2, Briefcase, Mail, Phone, MapPin, ChevronDown, ChevronUp, Sparkles, ShieldCheck, Edit3, Check, X } from "lucide-react";

interface Props {
  result: CardResult;
  index: number;
  onChange: (updated: CardResult) => void;
}

type EF = "name" | "company" | "address" | "city" | "job_title";

export default function ResultCard({ result, index, onChange }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [editing, setEditing] = useState<EF | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (f: EF) => {
    setDraft((result[f] as string) || "");
    setEditing(f);
  };
  
  const commit = () => {
    if (!editing) return;
    onChange({ ...result, [editing]: draft });
    setEditing(null);
  };
  
  const cancel = () => setEditing(null);

  const pct = Math.round(result.confidence * 100);
  const isLLM = result.method === "llm";

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${result.error ? "border-red-500/20" : "border-surface-border"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border bg-surface-container/10">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
          <p className="text-xs text-on-surface-variant font-semibold truncate max-w-[180px] font-body">{result.image}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 font-body ${isLLM ? "bg-secondary/10 border-secondary/20 text-secondary" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            {isLLM ? <><Sparkles className="w-2.5 h-2.5" />LLM</> : <><ShieldCheck className="w-2.5 h-2.5" />Rules</>}
          </span>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border font-body ${pct >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : pct >= 40 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}`}>{pct}%</span>
        </div>
      </div>

      {result.error ? (
        <div className="px-5 py-6 text-red-500 text-sm flex items-center gap-2 font-body"><X className="w-4 h-4 shrink-0" />{result.error}</div>
      ) : (
        <div className="px-5 py-5 space-y-4">
          <InlineField icon={<User className="w-4 h-4" />} label="Name" value={result.name} field="name" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} />
          <InlineField icon={<Briefcase className="w-4 h-4" />} label="Job Title" value={result.job_title || ""} field="job_title" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} />
          <InlineField icon={<Building2 className="w-4 h-4" />} label="Company" value={result.company} field="company" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} />

          <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-primary shrink-0"><Mail className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider font-bold font-body">Email</p>
              {result.emails.length > 0 ? (
                result.emails.map((e) => <p key={e} className="text-sm text-on-surface font-mono break-all mt-0.5">{e}</p>)
              ) : (
                <p className="text-sm text-on-surface-variant/40 italic font-body mt-0.5">Not found</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-primary shrink-0"><Phone className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider font-bold font-body">Phone</p>
              {result.phones.length > 0 ? (
                result.phones.map((p) => <p key={p} className="text-sm text-on-surface font-mono mt-0.5">{p}</p>)
              ) : (
                <p className="text-sm text-on-surface-variant/40 italic font-body mt-0.5">Not found</p>
              )}
            </div>
          </div>

          <InlineField icon={<MapPin className="w-4 h-4" />} label="Address" value={result.address} field="address" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} multiline />
          <InlineField icon={<MapPin className="w-4 h-4" />} label="City" value={result.city || ""} field="city" editing={editing} draft={draft} onStart={startEdit} onChange={setDraft} onCommit={commit} onCancel={cancel} />

          {result.raw_text && (
            <div className="pt-1">
              <button onClick={() => setShowRaw(s => !s)} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/60 hover:text-primary transition-colors font-bold font-body">
                {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {showRaw ? "Hide" : "Show"} raw OCR text
              </button>
              {showRaw && <pre className="mt-2 text-[11px] text-on-surface-variant/75 bg-surface-container/50 rounded-xl p-3 overflow-auto max-h-36 font-mono whitespace-pre-wrap border border-surface-border">{result.raw_text}</pre>}
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
      <div className="mt-0.5 text-primary shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider font-bold font-body">{label}</p>
        {isEditing ? (
          <div className="space-y-1.5 mt-1">
            {multiline ? (
              <textarea
                autoFocus
                value={draft}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-surface-container/30 border border-surface-border text-on-surface text-sm rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary resize-none font-body"
                rows={3}
              />
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }}
                className="w-full bg-surface-container/30 border border-surface-border text-on-surface text-sm rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary font-body"
              />
            )}
            <div className="flex gap-1.5">
              <button onClick={onCommit} className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={onCancel} className="p-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 mt-0.5">
            <p className={`text-sm flex-1 break-words font-body font-semibold ${value ? "text-on-surface" : "text-on-surface-variant/40 italic"}`}>{value || "Not found"}</p>
            {editing === null && (
              <button onClick={() => onStart(field)} className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-surface-container/40 text-on-surface-variant/50 hover:text-primary transition-all shrink-0">
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
