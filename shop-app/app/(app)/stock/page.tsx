import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import { QuickStock } from '@/components/StockForms';
import { PageHeader } from '@/components/ui';
import { ACTION_LABEL, dt, qty } from '@/lib/format';
import type { Material } from '@/lib/types';

export default async function StockPage() {
  const s = await requireUser(['owner', 'admin']);
  const [materials, suppliers, audit] = await Promise.all([
    rpc<Material[]>('list_materials', { p_token: s.tok }),
    rpc<{ id: string; name: string }[]>('list_suppliers', { p_token: s.tok }),
    rpc<{ rows: any[] }>('audit_list', { p_token: s.tok, p_limit: 15, p_offset: 0 }),
  ]);
  const sup = suppliers.map((x) => ({ id: x.id, name: x.name }));

  return (
    <div>
      <PageHeader title="Stock In / Out" subtitle="Every transaction is written to the immutable audit trail" />
      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <QuickStock kind="in" materials={materials} suppliers={sup} role={s.role} />
        <QuickStock kind="out" materials={materials} suppliers={sup} role={s.role} />
      </div>

      <h2 className="mb-3 text-lg font-extrabold">Latest transactions</h2>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr><th className="th">When</th><th className="th">Material</th><th className="th">Action</th><th className="th text-right">Change</th><th className="th">By</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {audit.rows.map((r) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap text-zinc-600">{dt(r.created_at)}</td>
                <td className="td font-semibold">{r.material_label}</td>
                <td className="td">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className={`td text-right font-bold tabular-nums ${Number(r.quantity_delta) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {Number(r.quantity_delta) > 0 ? '+' : ''}{qty(r.quantity_delta)}
                </td>
                <td className="td">{r.user_name}</td>
              </tr>
            ))}
            {audit.rows.length === 0 && <tr><td colSpan={5} className="td py-8 text-center text-zinc-500">No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
