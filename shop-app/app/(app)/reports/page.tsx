import Link from 'next/link';
import { Download } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import { rangeFor } from '@/lib/range';
import { PageHeader } from '@/components/ui';
import { dt, peso, qty } from '@/lib/format';

const TABS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly (7 days)' },
  { key: 'monthly', label: 'Monthly' },
];

export default async function ReportsPage({ searchParams }: { searchParams: { range?: string } }) {
  const s = await requireUser(['owner', 'admin']);
  const { from, to, key } = rangeFor(searchParams.range ?? 'daily');
  const r = await rpc<any>('report', { p_token: s.tok, p_from: from, p_to: to });

  return (
    <div>
      <PageHeader title="Sales & Material Usage Reports" subtitle={from === to ? from : `${from} → ${to}`}>
        <a className="btn-dark" href={`/api/reports/csv?range=${key}`}><Download size={16} /> Export CSV</a>
      </PageHeader>

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/reports?range=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${key === t.key ? 'bg-zinc-900 text-white' : 'bg-white ring-1 ring-zinc-300 hover:bg-zinc-50'}`}>{t.label}</Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="card bg-zinc-900 p-5 text-white"><div className="text-xs font-bold uppercase tracking-wide opacity-70">Total revenue (completed jobs)</div><div className="mt-2 text-3xl font-extrabold tabular-nums">{peso(r.total_revenue)}</div></div>
        <div className="card p-5"><div className="text-xs font-bold uppercase tracking-wide text-zinc-500">Completed job orders</div><div className="mt-2 text-3xl font-extrabold tabular-nums">{r.job_count}</div></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="card overflow-x-auto">
          <div className="border-b border-zinc-200 px-5 py-3"><h2 className="text-lg font-extrabold">Completed job orders</h2></div>
          <table className="w-full">
            <thead className="border-b border-zinc-200 bg-zinc-50"><tr><th className="th">Job #</th><th className="th">Customer</th><th className="th">Completed</th><th className="th text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {r.jobs.map((j: any) => (
                <tr key={j.job_no}><td className="td font-bold">#{j.job_no}</td><td className="td">{j.customer_name}</td><td className="td whitespace-nowrap text-zinc-600">{dt(j.completed_at)}</td><td className="td text-right font-bold tabular-nums">{peso(j.total)}</td></tr>
              ))}
              {r.jobs.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-zinc-500">No completed jobs in this range.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="border-b border-zinc-200 px-5 py-3"><h2 className="text-lg font-extrabold">Most-used materials</h2></div>
          <ol className="divide-y divide-zinc-100">
            {r.top_materials.map((m: any, i: number) => (
              <li key={m.material} className="flex items-center justify-between px-5 py-3 text-sm">
                <span><span className="mr-2 font-bold text-zinc-400">{i + 1}.</span>{m.material}</span>
                <span className="font-bold tabular-nums">{qty(m.quantity)}</span>
              </li>
            ))}
            {r.top_materials.length === 0 && <li className="px-5 py-8 text-center text-sm text-zinc-500">No material usage in this range.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}
