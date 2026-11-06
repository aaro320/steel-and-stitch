import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, verify } from '@/lib/session';
import { rpc } from '@/lib/supabase';
import { rangeFor } from '@/lib/range';

export const dynamic = 'force-dynamic';

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cols: unknown[]) => cols.map(esc).join(',');

export async function GET(req: Request) {
  const s = await verify(cookies().get(COOKIE)?.value);
  if (!s || s.role === 'clerk') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { from, to, key } = rangeFor(new URL(req.url).searchParams.get('range') ?? 'daily');
  let r: any;
  try {
    r = await rpc('report', { p_token: s.tok, p_from: from, p_to: to });
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const lines: string[] = [
    row([`Sales & Material Usage Report (${key})`, `${from} to ${to}`]),
    row(['Total revenue (PHP)', Number(r.total_revenue).toFixed(2)]),
    row(['Completed job orders', r.job_count]),
    '',
    row(['Job #', 'Customer', 'Completed (Asia/Manila)', 'Total (PHP)']),
    ...r.jobs.map((j: any) => row([
      j.job_no, j.customer_name,
      new Date(j.completed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      Number(j.total).toFixed(2),
    ])),
    '',
    row(['Most-used material', 'Quantity used']),
    ...r.top_materials.map((m: any) => row([m.material, Number(m.quantity)])),
  ];

  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="report-${key}-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
