import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import { PageHeader, RoleBadge } from '@/components/ui';
import { ACTION_LABEL, dt, qty } from '@/lib/format';

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: { action?: string; page?: string } }) {
  const s = await requireUser(['owner', 'admin']);
  const action = searchParams.action && ACTION_LABEL[searchParams.action] ? searchParams.action : null;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const a = await rpc<{ total: number; rows: any[] }>('audit_list', {
    p_token: s.tok, p_action: action, p_limit: PAGE, p_offset: (page - 1) * PAGE,
  });
  const pages = Math.max(1, Math.ceil(a.total / PAGE));
  const href = (p: number, act = action) => `/audit?${new URLSearchParams({ ...(act ? { action: act } : {}), page: String(p) })}`;

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Read-only. Entries cannot be edited or deleted — corrections are posted as Stock Adjustments." />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/audit" className={`rounded-full px-4 py-1.5 text-sm font-semibold ${!action ? 'bg-zinc-900 text-white' : 'bg-white ring-1 ring-zinc-300 hover:bg-zinc-50'}`}>All</Link>
        {Object.entries(ACTION_LABEL).map(([k, label]) => (
          <Link key={k} href={href(1, k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${action === k ? 'bg-zinc-900 text-white' : 'bg-white ring-1 ring-zinc-300 hover:bg-zinc-50'}`}>{label}</Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr><th className="th">Timestamp</th><th className="th">Material</th><th className="th">Action</th><th className="th text-right">Change</th><th className="th text-right">Balance</th><th className="th">Notes / reason</th><th className="th">User</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {a.rows.map((r) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap text-zinc-600">{dt(r.created_at)}</td>
                <td className="td font-semibold">{r.material_label}</td>
                <td className="td whitespace-nowrap">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className={`td text-right font-bold tabular-nums ${Number(r.quantity_delta) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Number(r.quantity_delta) > 0 ? '+' : ''}{qty(r.quantity_delta)}</td>
                <td className="td text-right tabular-nums">{qty(r.balance_after)}</td>
                <td className="td text-zinc-600">{r.notes || '—'}</td>
                <td className="td whitespace-nowrap"><div className="font-semibold">{r.user_name}</div><RoleBadge role={r.user_role} /></td>
              </tr>
            ))}
            {a.rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-zinc-500">No entries.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-zinc-500">{a.total} entries · page {page} of {pages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn-ghost btn-sm" href={href(page - 1)}>← Newer</Link>}
          {page < pages && <Link className="btn-ghost btn-sm" href={href(page + 1)}>Older →</Link>}
        </div>
      </div>
    </div>
  );
}
