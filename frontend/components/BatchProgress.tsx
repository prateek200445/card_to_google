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
  queued:  { icon: <Clock className="w-3.5 h-3.5" />,        label: "Queued",           color: "text-white/40",   bg: "bg-white/5"          },
  ocr:     { icon: <ScanLine className="w-3.5 h-3.5" />,     label: "Reading card…",    color: "text-blue-400",   bg: "bg-blue-500/10",     pulse: true },
  llm:     { icon: <Sparkles className="w-3.5 h-3.5" />,     label: "Fallback model…",  color: "text-fuchsia-400",bg: "bg-fuchsia-500/10",  pulse: true },
  done:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Done",             color: "text-emerald-400",bg: "bg-emerald-500/10"   },
  failed:  { icon: <XCircle className="w-3.5 h-3.5" />,      label: "Failed",           color: "text-red-400",    bg: "bg-red-500/10"       },
};

export default function BatchProgress({ status }: Props) {
  if (!status) return null;

  const pct = status.total > 0
    ? Math.round(((status.completed + status.failed) / status.total) * 100)
    : 0;

  return (
    <div className="w-full space-y-5">
      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/60 font-medium">
            Processing {status.total} card{status.total > 1 ? "s" : ""}
          </span>
          <span className="text-white/80 font-semibold tabular-nums">
            {status.completed + status.failed} / {status.total}
          </span>
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs text-white/40">
          <span className="text-emerald-400">✓ {status.completed} done</span>
          {status.failed > 0 && <span className="text-red-400">✗ {status.failed} failed</span>}
          <span>{status.total - status.completed - status.failed} remaining</span>
        </div>
      </div>

      {/* Per-card status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {status.images.map((img) => {
          const cfg = STATUS_CONFIG[img.status];
          return (
            <div
              key={img.filename}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/10 ${cfg.bg}`}
            >
              <div className={`shrink-0 ${cfg.color} ${cfg.pulse ? "animate-pulse" : ""}`}>
                {cfg.pulse
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 font-medium truncate">{img.filename}</p>
                <p className={`text-[10px] ${cfg.color} font-medium`}>{cfg.label}</p>
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
