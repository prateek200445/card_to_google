/**
 * lib/gemini.ts
 *
 * Calls Gemini API directly from the device to extract structured contact
 * data from business card images — mirrors backend/core/gemini_ocr.py
 */

import * as FileSystem from 'expo-file-system/legacy';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Model fallback chain — same as backend
const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemma-3-27b-it',
]// Exact prompt copied from backend/core/gemini_ocr.py
const PROMPT = `You are an expert OCR system for Indian business cards containing Hindi and English text.

Carefully read ALL visible text in the image — including stylized, decorative, and small fonts.

First, determine if the image is actually a business card or visiting card.
Return a valid JSON with this exact schema:
{
  "is_visiting_card": true,
  "problem_message": "If the image is NOT a visiting/business card, explain why in a short, friendly sentence. Otherwise leave empty.",
  "company": "",
  "contacts": [
    {"name": "", "job_title": "", "phones": []}
  ],
  "emails": [],
  "address": "",
  "city": ""
}

Rules:
1. 🗹 is_visiting_card - boolean (true if it's a business card, visiting card, or contains clear professional contact info; false if it's a screenshot, photo of an object, document, landscape, food, or other unrelated image).
2. 🗹 problem_message - short friendly message if is_visiting_card is false, or if the card text is too blurry/unreadable to extract anything.
3. 🏢 company    — large central text, shop/business name (keep Hindi as-is)
4. 👤 contacts   — extract EVERY person as a SEPARATE entry with their own phones
5. 💼 job_title  — role, designation or title of the person (e.g. "GM Finance", "Director")
6. 📱 phones     — digit-only strings, strip +/spaces/dashes
7. 📍 address    — full postal address in one string, keep Hindi as-is
8. 🌆 city       — extract the city or region name if specified (e.g. "Ahmedabad", "Gujarat")
9. 📧 emails     — all emails in lowercase
10. ✗ Do NOT translate Hindi to English
11. ✗ Do NOT merge multiple contacts
12. ✗ Return ONLY the JSON — no markdown, no explanation`;

export interface ExtractedContact {
  name: string;
  job_title: string;
  phones: string[];
}

export interface ExtractedCard {
  is_visiting_card?: boolean;
  problem_message?: string;
  company: string;
  contacts: ExtractedContact[];
  emails: string[];
  address: string;
  city: string;
}

export interface CardResult {
  image: string;          // filename / display label
  name: string;
  company: string;
  emails: string[];
  phones: string[];
  address: string;
  city: string;
  job_title: string;
  confidence: number;     // 0-1 estimate
  method: 'llm';
  raw_text?: string;
  error?: string;
  remarks?: string;
  is_visiting_card?: boolean;
  problem_message?: string;
}

async function uriToBase64(uri: string): Promise<{ b64: string; mime: string }> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return { b64, mime };
}

async function callModel(
  model: string,
  b64: string,
  mime: string
): Promise<ExtractedCard | null> {
  const generationConfig: Record<string, unknown> = { temperature: 0.0 };
  if (model.startsWith('gemini-2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 1024 };
  }

  const url = `${BASE_URL}/${model}:generateContent?key=${GEMINI_KEY}`;
  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mime, data: b64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) return null; // rate limited → try next
    if (!res.ok) return null;

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    let text: string =
      parts.find((p: { thought?: boolean; text?: string }) => !p.thought)?.text ??
      parts[0]?.text ??
      '';

    // Strip markdown fences
    text = text.trim();
    if (text.startsWith('```')) {
      text = text.split('```')[1];
      if (text.startsWith('json')) text = text.slice(4);
    }
    text = text.trim();

    if (!text) return null;
    return JSON.parse(text) as ExtractedCard;
  } catch {
    return null;
  }
}

/**
 * Extract a single business card image.
 * Returns a CardResult (with error set if all models fail).
 */
export async function extractCard(uri: string, label: string): Promise<CardResult> {
  if (!GEMINI_KEY) {
    return {
      image: label, name: '', company: '', emails: [], phones: [],
      address: '', city: '', job_title: '', confidence: 0, method: 'llm',
      error: 'GEMINI_KEY not configured.',
    };
  }

  let { b64, mime } = await uriToBase64(uri);

  for (const model of MODELS) {
    const result = await callModel(model, b64, mime);
    if (!result) continue;

    // Flatten multi-contact card into first contact (most common case)
    const primary = result.contacts?.[0] ?? { name: '', job_title: '', phones: [] };
    const allPhones = result.contacts?.flatMap((c) => c.phones) ?? [];
    const uniquePhones = [...new Set(allPhones)];

    const name = primary.name ?? '';
    const company = result.company ?? '';
    const emails = result.emails ?? [];
    const phones = uniquePhones;
    const address = result.address ?? '';
    const city = result.city ?? '';
    const job_title = primary.job_title ?? '';

    // Validate if it is actually a visiting card or if it has any readable details
    const isVisiting = result.is_visiting_card !== false;
    const problemMsg = result.problem_message || '';
    const hasNothing = !name && !company && emails.length === 0 && phones.length === 0 && !address;

    let error: string | undefined = undefined;
    if (!isVisiting) {
      error = problemMsg || 'Please upload only a visiting card.';
    } else if (hasNothing) {
      error = 'Could not extract contact details. Image might be blurry or does not contain card details.';
    }

    return {
      image: label,
      name,
      company,
      emails,
      phones,
      address,
      city,
      job_title,
      confidence: error ? 0 : 0.9,
      method: 'llm',
      error,
      is_visiting_card: isVisiting,
      problem_message: error,
    };
  }

  return {
    image: label, name: '', company: '', emails: [], phones: [],
    address: '', city: '', job_title: '', confidence: 0, method: 'llm',
    error: 'AI extraction service failed. Check your network connection.',
  };
}
