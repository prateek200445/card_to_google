/**
 * hooks/useExtract.ts
 *
 * On-device extraction pipeline — replaces useUpload + useJobPolling.
 * Processes up to 25 images sequentially, emitting live per-card status.
 */

import { useState, useCallback } from 'react';
import { extractCard, CardResult } from '@/lib/gemini';

export type CardStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface CardProgress {
  uri: string;
  label: string;
  status: CardStatus;
  result?: CardResult;
}

export function useExtract() {
  const [progress, setProgress] = useState<CardProgress[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);

  const extract = useCallback(async (images: { uri: string; name: string }[]) => {
    setIsRunning(true);
    setResults([]);

    // Initialize all cards as queued
    const initial: CardProgress[] = images.map((img) => ({
      uri: img.uri,
      label: img.name,
      status: 'queued',
    }));
    setProgress(initial);

    const finalResults: CardResult[] = [];

    for (let i = 0; i < images.length; i++) {
      const { uri, name } = images[i];

      // Mark as processing
      setProgress((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: 'processing' } : p))
      );

      const result = await extractCard(uri, name);
      finalResults.push(result);

      // Mark as done or failed
      setProgress((prev) =>
        prev.map((p, idx) =>
          idx === i
            ? { ...p, status: result.error ? 'failed' : 'done', result }
            : p
        )
      );
    }

    setResults(finalResults);
    setIsRunning(false);
    return finalResults;
  }, []);

  const reset = useCallback(() => {
    setProgress([]);
    setResults([]);
    setIsRunning(false);
  }, []);

  const doneCount = progress.filter((p) => p.status === 'done').length;
  const failedCount = progress.filter((p) => p.status === 'failed').length;

  return { extract, progress, isRunning, results, doneCount, failedCount, reset };
}
