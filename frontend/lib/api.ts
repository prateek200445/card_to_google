/**
 * Typed API client for the Card Extractor backend.
 */

const BASE = "/api";

export interface CardResult {
  image: string;
  name: string;
  company: string;
  emails: string[];
  phones: string[];
  address: string;
  confidence: number;
  method: "rule-based" | "llm" | "hybrid";
  raw_text?: string;
  error?: string;
}

export interface ImageStatus {
  filename: string;
  status: "queued" | "ocr" | "llm" | "done" | "failed";
  result?: CardResult;
  error?: string;
}

export interface JobStatus {
  job_id: string;
  total: number;
  completed: number;
  failed: number;
  images: ImageStatus[];
}

export interface UploadResponse {
  job_id: string;
  filenames: string[];
  message: string;
}

// ── Upload ────────────────────────────────────────────────────────────────

export async function uploadImages(
  files: File[],
  onProgress?: (pct: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const err = JSON.parse(xhr.responseText);
        reject(new Error(err?.detail || "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}

// ── Process ───────────────────────────────────────────────────────────────

export async function startProcessing(jobId: string): Promise<void> {
  const res = await fetch(`${BASE}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.detail || "Failed to start processing");
  }
}

// ── Status ────────────────────────────────────────────────────────────────

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${BASE}/status/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

// ── Results ───────────────────────────────────────────────────────────────

export async function getResults(jobId: string): Promise<CardResult[]> {
  const res = await fetch(`${BASE}/results/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch results");
  return res.json();
}

// ── Export ────────────────────────────────────────────────────────────────

export async function exportToExcel(jobId: string, results: CardResult[]): Promise<void> {
  const res = await fetch(`${BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, format: "excel", results }),
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cards_${jobId.slice(0, 8)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToSheets(
  jobId: string,
  results: CardResult[],
  sheetId?: string
): Promise<string> {
  const res = await fetch(`${BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, format: "sheets", results, sheet_id: sheetId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.detail || "Sheets export failed");
  }
  const data = await res.json();
  return data.url;
}
