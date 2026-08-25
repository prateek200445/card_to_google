/**
 * lib/vcf.ts
 * Build vCard 3.0 strings — mirrors ExportPanel.tsx & ContactsView.tsx helpers.
 */

import { CardResult } from './gemini';
import { SheetContact } from './sheets';

function vcEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/\n/g, '\\n').replace(/;/g, '\\;');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildVcfFromResults(results: CardResult[], remarks = ''): string {
  const seenPhones = new Set<string>();
  const vcards: string[] = [];

  for (const r of results) {
    if (r.error) continue;

    const uniquePhones: string[] = [];
    for (const p of r.phones) {
      const norm = normalizePhone(p);
      if (!norm || seenPhones.has(norm)) continue;
      seenPhones.add(norm);
      uniquePhones.push(p);
    }

    const displayName = r.name || r.company || 'Unknown Contact';
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcEscape(displayName)}`];

    if (r.name) {
      const parts = r.name.trim().split(/\s+/);
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
      lines.push(`N:${vcEscape(last)};${vcEscape(first)};;;`);
    }
    if (r.company) lines.push(`ORG:${vcEscape(r.company)}`);
    if (r.job_title) lines.push(`TITLE:${vcEscape(r.job_title)}`);
    r.emails.forEach((e) => lines.push(`EMAIL;TYPE=WORK,INTERNET:${vcEscape(e)}`));
    uniquePhones.forEach((p) => lines.push(`TEL;TYPE=WORK,VOICE:${p}`));
    if (r.address) lines.push(`ADR;TYPE=WORK:;;${vcEscape(r.address)};;;;`);
    if (remarks) lines.push(`NOTE:${vcEscape(remarks)}`);
    lines.push('END:VCARD');
    vcards.push(lines.join('\r\n'));
  }

  return vcards.join('\r\n');
}

export function buildVcfFromContacts(contacts: SheetContact[]): string {
  const seenPhones = new Set<string>();
  const vcards: string[] = [];

  for (const c of contacts) {
    const phones = c.phones.split(';').map((p) => p.trim()).filter(Boolean);
    const emails = c.emails.split(';').map((e) => e.trim()).filter(Boolean);

    const uniquePhones: string[] = [];
    for (const p of phones) {
      const norm = normalizePhone(p);
      if (!norm || seenPhones.has(norm)) continue;
      seenPhones.add(norm);
      uniquePhones.push(p);
    }

    const displayName = c.name || c.company || 'Unknown Contact';
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcEscape(displayName)}`];

    if (c.name) {
      const parts = c.name.trim().split(/\s+/);
      const last = parts.length > 1 ? parts[parts.length - 1] : '';
      const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
      lines.push(`N:${vcEscape(last)};${vcEscape(first)};;;`);
    }
    if (c.company) lines.push(`ORG:${vcEscape(c.company)}`);
    if (c.job_title) lines.push(`TITLE:${vcEscape(c.job_title)}`);
    emails.forEach((e) => lines.push(`EMAIL;TYPE=WORK,INTERNET:${vcEscape(e)}`));
    uniquePhones.forEach((p) => lines.push(`TEL;TYPE=WORK,VOICE:${p}`));
    if (c.address || c.city) {
      lines.push(`ADR;TYPE=WORK:;;${vcEscape(c.address || '')};${vcEscape(c.city || '')};;;`);
    }
    if (c.remarks) lines.push(`NOTE:${vcEscape(c.remarks)}`);
    lines.push('END:VCARD');
    vcards.push(lines.join('\r\n'));
  }

  return vcards.join('\r\n');
}
