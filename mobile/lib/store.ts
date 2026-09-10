/**
 * lib/store.ts
 * Simple module-level store to pass data between screens
 * (avoids URL serialization of large arrays)
 */
import { CardResult } from './gemini';

export let pendingImages: { uri: string; name: string }[] = [];
export let extractedResults: CardResult[] = [];

export function setPendingImages(imgs: { uri: string; name: string }[]) {
  pendingImages = imgs;
}

export function setExtractedResults(results: CardResult[]) {
  extractedResults = results;
}
