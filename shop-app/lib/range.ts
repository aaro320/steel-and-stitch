export type RangeKey = 'daily' | 'weekly' | 'monthly';

/** Date range in Asia/Manila local dates (YYYY-MM-DD). */
export function rangeFor(r: string) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [y, m, d] = today.split('-').map(Number);
  let from = today;
  let key: RangeKey = 'daily';
  if (r === 'weekly') {
    key = 'weekly';
    from = new Date(Date.UTC(y, m - 1, d - 6)).toISOString().slice(0, 10);
  } else if (r === 'monthly') {
    key = 'monthly';
    from = `${y}-${String(m).padStart(2, '0')}-01`;
  }
  return { from, to: today, key };
}
