/**
 * hooks/useContacts.ts
 * Fetch and cache contacts from Google Sheets.
 */

import { useState, useCallback } from 'react';
import { getSheetContacts, SheetContact } from '@/lib/sheets';

export function useContacts() {
  const [contacts, setContacts] = useState<SheetContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSheetContacts();
      setContacts(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  return { contacts, loading, error, load };
}
