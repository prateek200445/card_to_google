"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getJobStatus, JobStatus } from "@/lib/api";

const POLL_INTERVAL = 1500; // ms

export function useJobPolling(jobId: string | null) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const s = await getJobStatus(jobId);
      setStatus(s);
      const finished = s.completed + s.failed >= s.total;
      if (finished) {
        setIsDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch (_) {
      // Silently retry on network errors
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    setIsDone(false);
    setStatus(null);
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jobId, poll]);

  return { status, isDone };
}
