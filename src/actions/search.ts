'use server';

import { supabase } from '@/lib/supabase';

type SearchResult = {
  id: string;
  type: 'user' | 'vendor';
  name: string;
  phone: string;
  href: '/customers' | '/vendors';
};

function scoreMatch(query: string, name: string, phone: string) {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  const p = phone.toLowerCase();

  if (n.startsWith(q) || p.startsWith(q)) return 3;
  if (n.includes(q) || p.includes(q)) return 2;
  return 1;
}

export async function searchContacts(rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const searchPattern = `%${query}%`;

  const [customersResult, vendorsResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, phone')
      .or(`name.ilike.${searchPattern},phone.ilike.${searchPattern}`)
      .limit(6),
    supabase
      .from('vendors')
      .select('id, name, phone')
      .or(`name.ilike.${searchPattern},phone.ilike.${searchPattern}`)
      .limit(6),
  ]);

  const customers = customersResult.data || [];
  const vendors = vendorsResult.data || [];

  const results: SearchResult[] = [
    ...customers.map((item) => ({
      id: item.id,
      type: 'user' as const,
      name: item.name,
      phone: item.phone || '-',
      href: '/customers' as const,
    })),
    ...vendors.map((item) => ({
      id: item.id,
      type: 'vendor' as const,
      name: item.name,
      phone: item.phone || '-',
      href: '/vendors' as const,
    })),
  ];

  results.sort((a, b) => scoreMatch(query, b.name, b.phone) - scoreMatch(query, a.name, a.phone));

  return results.slice(0, 8);
}
