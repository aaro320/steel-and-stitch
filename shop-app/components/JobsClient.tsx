'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { jobStatusAction } from '@/app/actions';
import { STATUSES, type JobOrder, type Material, type Service } from '@/lib/types';
import { dt, peso, qty } from '@/lib/format';
import { Notice, StatusBadge } from './ui';
import JobBuilder from './JobBuilder';

export default function JobsClient({
  jobs, materials, services, suppliers, role,
}: {
  jobs: JobOrder[]; materials: Material[]; services: Service[]; suppliers: { id: string; name: string }[];
  role: 'owner' | 'admin' | 'clerk';
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>('All');
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [, start] = useTransition();

  const shown = jobs.filter((j) => tab === 'All' || j.status === tab);
  const count = (s: string) => jobs.filter((j) => j.status === s).length;

  const change = (id: string, status: string) => {
    setErr('');
    start(async () => {
      const r = await jobStatusAction(id, status);
      if (!r.ok) setErr(r.error);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {['All', ...STATUSES].map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === s ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50'}`}>
              {s} <span className="opacity-60">{s === 'All' ? jobs.length : count(s)}</span>
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New Job Order</button>
      </div>

      {err && <div className="mb-3"><Notice>{err}</Notice></div>}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr><th className="th">Job #</th><th className="th">Customer</th><th className="th">Status</th><th className="th text-right">Total</th><th className="th">Created</th><th className="th">Update status</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {shown.map((j) => (
              <Fragment key={j.id}>
                <tr>
                  <td className="td font-bold">#{j.job_no}</td>
                  <td className="td"><div className="font-semibold">{j.customer_name}</div><div className="text-xs text-zinc-500">{j.contact_details}</div></td>
                  <td className="td"><StatusBadge status={j.status} /></td>
                  <td className="td text-right font-bold tabular-nums">{peso(j.total)}</td>
                  <td className="td whitespace-nowrap text-zinc-600">{dt(j.created_at)}<div className="text-xs">by {j.created_by_name}</div></td>
                  <td className="td">
                    <select className="input !py-1.5" value={j.status} onChange={(e) => change(j.id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost btn-sm" onClick={() => setExpanded(expanded === j.id ? null : j.id)}>
                      Details {expanded === j.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </td>
                </tr>
                {expanded === j.id && (
                  <tr className="bg-zinc-50">
                    <td colSpan={7} className="px-6 py-4 text-sm">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <div className="label">Line items</div>
                          {j.items.map((i, n) => (
                            <div key={n} className="flex justify-between border-b border-zinc-200 py-1">
                              <span>{i.name}{Number(i.quantity) !== 1 ? ` × ${qty(i.quantity)}` : ''}{i.description ? <span className="text-zinc-500"> — {i.description}</span> : null}</span>
                              <span className="tabular-nums">{peso(Number(i.unit_price) * Number(i.quantity))}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="label">Materials deducted</div>
                          {j.materials.length === 0 && <div className="text-zinc-500">None</div>}
                          {j.materials.map((m, n) => (
                            <div key={n} className="flex justify-between border-b border-zinc-200 py-1"><span>{m.label}</span><span className="tabular-nums">{qty(m.quantity)}</span></div>
                          ))}
                          {j.notes && <p className="mt-3 text-zinc-600"><strong>Notes:</strong> {j.notes}</p>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-zinc-500">No job orders here yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <JobBuilder open onClose={() => setOpen(false)} materials={materials} services={services} suppliers={suppliers} role={role} />}
    </div>
  );
}
