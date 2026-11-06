import { AlertTriangle, ClipboardList, PackageOpen, Phone, Wallet } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import AccountPanel from '@/components/AccountPanel';
import { PageHeader } from '@/components/ui';
import { ACTION_LABEL, dt, peso, qty } from '@/lib/format';

export default async function DashboardPage() {
  const s = await requireUser(['owner', 'admin']);
  const [d, me] = await Promise.all([
    rpc<any>('dashboard', { p_token: s.tok }),
    rpc<{ security_question: string }>('me', { p_token: s.tok }),
  ]);

  const kpis = [
    { label: 'Total Inventory Value', value: peso(d.inventory_value), icon: PackageOpen, tone: 'bg-zinc-900 text-white' },
    { label: 'Low-Stock Alerts', value: String(d.low_stock_count), icon: AlertTriangle, tone: d.low_stock_count > 0 ? 'bg-amber-500 text-zinc-950' : 'bg-white' },
    { label: 'Active Job Orders', value: String(d.active_jobs), icon: ClipboardList, tone: 'bg-white' },
    { label: 'Monthly Revenue', value: peso(d.monthly_revenue), icon: Wallet, tone: 'bg-white' },
  ];

  return (
    <div>
      <PageHeader title="Overview" subtitle={`Welcome back, ${s.name}`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`card p-5 ${tone}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</span>
              <Icon size={20} className="opacity-70" />
            </div>
            <div className="text-3xl font-extrabold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {d.low_stock.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-amber-400 bg-amber-50 p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-900">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-extrabold">Low-stock warning — {d.low_stock.length} item(s) need restocking</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.low_stock.map((m: any) => (
              <div key={m.id} className="rounded-md border border-amber-200 bg-white p-3">
                <div className="font-bold">{m.name}{m.type ? <span className="font-normal text-zinc-600"> — {m.type}</span> : null}</div>
                <div className="text-sm text-red-700">
                  {qty(m.current_stock)} {m.unit} left <span className="text-zinc-500">(warn at {qty(m.low_stock_level)})</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{m.supplier_name ?? 'No supplier'}</span>
                  {m.supplier_phone && (
                    <a href={`tel:${m.supplier_phone}`} className="btn-primary btn-sm"><Phone size={12} /> {m.supplier_phone}</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-10">
        <div className="border-b border-zinc-200 px-5 py-3"><h2 className="text-lg font-extrabold">Recent activity</h2></div>
        <ul className="divide-y divide-zinc-100">
          {d.recent.map((r: any) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <span className="font-bold">{r.material_label}</span>{' '}
                <span className="text-zinc-600">· {ACTION_LABEL[r.action] ?? r.action}</span>
                {r.notes && <div className="text-xs text-zinc-500">{r.notes}</div>}
              </div>
              <div className="text-right">
                <div className={`font-bold tabular-nums ${Number(r.quantity_delta) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {Number(r.quantity_delta) > 0 ? '+' : ''}{qty(r.quantity_delta)}
                </div>
                <div className="text-xs text-zinc-500">{r.user_name} ({r.user_role}) · {dt(r.created_at)}</div>
              </div>
            </li>
          ))}
          {d.recent.length === 0 && <li className="px-5 py-8 text-center text-sm text-zinc-500">No activity yet.</li>}
        </ul>
      </div>

      <h2 className="mb-3 text-lg font-extrabold">My Account</h2>
      <AccountPanel currentQuestion={me.security_question} />
    </div>
  );
}
