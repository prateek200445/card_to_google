/**
 * lib/excel.ts
 * Generate an .xlsx file on-device and share it via the OS share sheet.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CardResult } from './gemini';

export async function exportToExcel(results: CardResult[], remarks: string = ''): Promise<void> {
  // Dynamic import — xlsx is heavy, only load when needed
  const XLSX = await import('xlsx');

  const headers = ['Image', 'Name', 'Company', 'Emails', 'Phones', 'Address', 'City', 'Job Title', 'Remarks'];

  const rows = results
    .filter((r) => !r.error)
    .map((r) => [
      r.image,
      r.name,
      r.company,
      r.emails.join('; '),
      r.phones.join('; '),
      r.address,
      r.city,
      r.job_title,
      remarks,
    ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws['!cols'] = [20, 22, 22, 30, 20, 35, 15, 22, 30].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

  const wbout: Uint8Array = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  // Write to a temp file
  const date = new Date().toISOString().slice(0, 10);
  const path = `${FileSystem.cacheDirectory}cards_${date}.xlsx`;

  await FileSystem.writeAsStringAsync(
    path,
    Buffer.from(wbout).toString('base64'),
    { encoding: FileSystem.EncodingType.Base64 }
  );

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Save contacts as Excel',
    UTI: 'com.microsoft.excel.xlsx',
  });
}
