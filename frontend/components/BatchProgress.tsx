"use client";

import React from "react";
import { ImageStatus, JobStatus } from "@/lib/api";
import {
  Clock, Loader2, CheckCircle2, XCircle,
  ScanLine, Sparkles,
} from "lucide-react";

interface Props {
  status: JobStatus | null;
}

const STATUS_CONFIG: Record<ImageStatus["status"], {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  pulse?: boolean;
}> = {
  queued:  { icon: <Clock className="w-3.5 h-3.5" />,        label: "Queued",           color: "text-on-surface-variant/50", bg: "bg-surface-container" },
  ocr:     { icon: <ScanLine className="w-3.5 h-3.5" />,     label: "Reading card…",    color: "text-primary",               bg: "bg-primary/5",        pulse: true },
  llm:     { icon: <Sparkles className="w-3.5 h-3.5" />,     label: "Fallback model…",  color: "text-secondary",             bg: "bg-secondary/5",      pulse: true },
  done:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Done",             color: "text-emerald-600",           bg: "bg-emerald-50"        },
  failed:  { icon: <XCircle className="w-3.5 h-3.5" />,      label: "Failed",           color: "text-red-600",               bg: "bg-red-50"            },
};

export default function BatchProgress({ status }: Props) {
  if (!status) return null;

  const pct = status.total > 0
    ? Math.round(((status.completed + status.failed) / status.total) * 100)
    : 0;

  return (
    <div className="w-full space-y-6">
      {/* Overall progress */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm font-body">
          <span className="text-on-surface-variant font-semibold">
            Processing {status.total} card{status.total > 1 ? "s" : ""}
          </span>
          <span className="text-on-surface font-bold tabular-nums">
            {status.completed + status.failed} / {status.total}
          </span>
        </div>
        <div className="h-3 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs font-semibold font-body">
          <span className="text-emerald-600">✓ {status.completed} done</span>
          {status.failed > 0 && <span className="text-red-600">✗ {status.failed} failed</span>}
          <span className="text-on-surface-variant/60">{status.total - status.completed - status.failed} remaining</span>
        </div>
      </div>

      {/* Per-card status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {status.images.map((img) => {
          const cfg = STATUS_CONFIG[img.status];
          return (
            <div
              key={img.filename}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border border-surface-border ${cfg.bg} shadow-sm`}
            >
              <div className={`shrink-0 ${cfg.color} ${cfg.pulse ? "animate-pulse" : ""}`}>
                {cfg.pulse
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface font-bold truncate font-body">{img.filename}</p>
                <p className={`text-[10px] ${cfg.color} font-semibold font-body`}>{cfg.label}</p>
              </div>
              {img.result && img.result.confidence > 0 && (
                <span className={`text-[10px] font-bold ${cfg.color} shrink-0`}>
                  {Math.round(img.result.confidence * 100)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
