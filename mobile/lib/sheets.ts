/**
 * lib/sheets.ts
 *
 * Reads from and writes to Google Sheets REST API v4 directly from the device,
 * using a service account JWT — mirrors backend services/sheets_export.py
 * and api/routes/contacts.py.
 */

import { CardResult } from './gemini';
import forge from 'node-forge';

const SHEET_ID = process.env.EXPO_PUBLIC_SHEET_ID ?? '';
const SHEET_TAB = process.env.EXPO_PUBLIC_SHEET_TAB ?? 'Sheet1';
const CLIENT_EMAIL = process.env.EXPO_PUBLIC_SA_CLIENT_EMAIL ?? '';
const PRIVATE_KEY = (process.env.EXPO_PUBLIC_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// ── JWT / OAuth token ─────────────────────────────────────────────────────────

function base64UrlEncode(str: string): string {
  // React Native's btoa works with binary strings
  const b64 = btoa(str);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function objToBase64Url(obj: object): string {
  return base64UrlEncode(JSON.stringify(obj));
}

/**
 * Sign a JWT using RSA-SHA256 via node-forge (pure JS, compatible with React Native).
 */
async function signJwt(payload: object): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerB64 = objToBase64Url(header);
  const payloadB64 = objToBase64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKey = forge.pki.privateKeyFromPem(PRIVATE_KEY);
  const md = forge.md.sha256.create();
  md.update(signingInput, 'utf8');

  const signature = privateKey.sign(md);
  const sigB64 = base64UrlEncode(signature);

  return `${signingInput}.${sigB64}`;
}

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpiry - 60) return _cachedToken;

  const iat = now;
  const exp = now + 3600;

  const jwtPayload = {
    iss: CLIENT_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat,
    exp,
  };

  const jwt = await signJwt(jwtPayload);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get access token: ${err}`);
  }

  const data = await res.json();
  _cachedToken = data.access_token;
  _tokenExpiry = exp;
  return _cachedToken!;
}

// ── Contacts schema (mirrors backend SheetContact) ────────────────────────────

export interface SheetContact {
  image: string;
  name: string;
  company: string;
  emails: string;   // semicolon-separated
  phones: string;   // semicolon-separated
  address: string;
  remarks: string;
  city: string;
  job_title: string;
}

// ── Read contacts ─────────────────────────────────────────────────────────────

export async function getSheetContacts(): Promise<SheetContact[]> {
  const token = await getAccessToken();
  const range = encodeURIComponent(`${SHEET_TAB}!A:I`);
  const url = `${SHEETS_BASE}/${SHEET_ID}/values/${range}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch contacts from Google Sheets');

  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  if (rows.length < 2) return [];

  return rows.slice(1).map((row) => {
    const r = [...row, ...Array(9).fill('')].slice(0, 9);
    return {
      image: r[0], name: r[1], company: r[2],
      emails: r[3], phones: r[4], address: r[5],
      remarks: r[6], city: r[7], job_title: r[8],
    };
  });
}

// ── Append rows ───────────────────────────────────────────────────────────────

const HEADERS = ['Image', 'Name', 'Company', 'Emails', 'Phones', 'Address', 'Remarks', 'City', 'Job Title'];

export async function appendToSheet(
  results: CardResult[],
  remarks: string = ''
): Promise<string> {
  const token = await getAccessToken();

  // Check if header row exists
  const checkRange = encodeURIComponent(`${SHEET_TAB}!A1:I1`);
  const checkUrl = `${SHEETS_BASE}/${SHEET_ID}/values/${checkRange}`;
  const checkRes = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const checkData = await checkRes.json();
  const hasHeader = (checkData.values ?? []).length > 0;

  const rows: string[][] = [];
  if (!hasHeader) rows.push(HEADERS);

  for (const r of results) {
    if (r.error) continue;
    rows.push([
      r.image,
      r.name,
      r.company,
      r.emails.join('; '),
      r.phones.join('; '),
      r.address,
      remarks,
      r.city,
      r.job_title,
    ]);
  }

  const appendRange = encodeURIComponent(`${SHEET_TAB}!A1`);
  const appendUrl = `${SHEETS_BASE}/${SHEET_ID}/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: rows }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets append failed: ${err}`);
  }

  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
}
