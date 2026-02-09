'use server';

import connect from '@/lib/db';
import Customer from '@/models/Customer';
import Vendor from '@/models/Vendor';

type SearchResult = {
  id: string;
  type: 'user' | 'vendor';
  name: string;
  phone: string;
  href: '/customers' | '/vendors';
};

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

  await connect();

  const pattern = new RegExp(escapeRegex(query), 'i');

  const [customers, vendors] = await Promise.all([
    Customer.find({
      $or: [{ name: pattern }, { phone: pattern }],
    })
      .select('name phone')
      .limit(6),
    Vendor.find({
      $or: [{ name: pattern }, { phone: pattern }],
    })
      .select('name phone')
      .limit(6),
  ]);

  const results: SearchResult[] = [
    ...customers.map((item) => ({
      id: item._id.toString(),
      type: 'user' as const,
      name: item.name,
      phone: item.phone ?? '-',
      href: '/customers' as const,
    })),
    ...vendors.map((item) => ({
      id: item._id.toString(),
      type: 'vendor' as const,
      name: item.name,
      phone: item.phone ?? '-',
      href: '/vendors' as const,
    })),
  ];

  results.sort((a, b) => scoreMatch(query, b.name, b.phone) - scoreMatch(query, a.name, a.phone));

  return results.slice(0, 8);
}
