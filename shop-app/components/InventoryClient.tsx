'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Pencil, Phone, Plus, Scale, Search } from 'lucide-react';
import { adjustStockAction } from '@/app/actions';
import { CATEGORIES, type Material } from '@/lib/types';
import { peso, qty } from '@/lib/format';
import { Field, Modal, Notice } from './ui';
import { MaterialModal } from './StockForms';

type Sup = { id: string; name: string };

export default function InventoryClient({
  materials, suppliers, role,
}: { materials: Material[]; suppliers: Sup[]; role: 'owner' | 'admin' | 'clerk' }) {
  const admin = role !== 'clerk';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [edit, setEdit] = useState<Material | 'new' | null>(null);
  const [adj, setAdj] = useState<Material | null>(null);
  const [view, setView] = useState<Material | null>(null);

  const rows = useMemo(
    () => materials.filter((m) => {
      const text = `${m.name} ${m.type} ${m.category} ${m.supplier_name ?? ''}`.toLowerCase();
      return (!q || text.includes(q.toLowerCase())) && (!cat || m.category === cat)
        && (!lowOnly || m.current_stock <= m.low_stock_level);
    }),
    [materials, q, cat, lowOnly],
  );

  const level = (m: Material) =>
    m.current_stock > m.low_stock_level ? 'ok' : m.current_stock <= m.low_stock_level * 0.5 ? 'red' : 'amber';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-zinc-400" />
          <input className="input pl-9" placeholder="Search material, type, supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
        </label>
        <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add Material</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="th">Material</th>
              <th className="th">Type</th>
              <th className="th">Category</th>
              <th className="th text-right">Stock</th>
              <th className="th text-right">Low at</th>
              {admin && <th className="th text-right">Unit price</th>}
              {admin && <th className="th text-right">Value</th>}
              <th className="th">Supplier</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((m) => {
              const lv = level(m);
              return (
                <tr key={m.id}
                  className={lv === 'red' ? 'bg-red-50' : lv === 'amber' ? 'bg-amber-50' : ''}>
                  <td className="td font-semibold">
                    {m.name}
                    {lv !== 'ok' && (
                      <button onClick={() => setView(m)} title="Low stock — view supplier"
                        className={`ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-middle text-[11px] font-bold ${lv === 'red' ? 'bg-red-600 text-white' : 'bg-amber-500 text-zinc-950'}`}>
                        <AlertTriangle size={11} /> LOW
                      </button>
                    )}
                  </td>
                  <td className="td text-zinc-600">{m.type || '—'}</td>
                  <td className="td text-zinc-600">{m.category}</td>
                  <td className="td text-right font-bold tabular-nums">{qty(m.current_stock)} <span className="font-normal text-zinc-500">{m.unit}</span></td>
                  <td className="td text-right tabular-nums text-zinc-500">{qty(m.low_stock_level)}</td>
                  {admin && <td className="td text-right tabular-nums">{peso(m.unit_price)}</td>}
                  {admin && <td className="td text-right tabular-nums">{peso(Number(m.unit_price ?? 0) * m.current_stock)}</td>}
                  <td className="td">
                    {m.supplier_name ?? '—'}
                    {lv !== 'ok' && m.supplier_phone && (
                      <a href={`tel:${m.supplier_phone}`} className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
                        <Phone size={11} /> {m.supplier_phone}
                      </a>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-right">
                    {admin && (
                      <>
                        <button className="btn-ghost btn-sm mr-1" onClick={() => setEdit(m)}><Pencil size={13} /> Edit</button>
                        <button className="btn-ghost btn-sm" onClick={() => setAdj(m)}><Scale size={13} /> Adjust</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="td py-10 text-center text-zinc-500">No materials match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <MaterialModal open onClose={() => setEdit(null)} role={role} suppliers={suppliers}
          material={edit === 'new' ? null : edit} />
      )}
      {adj && <AdjustModal material={adj} onClose={() => setAdj(null)} />}
      {view && (
        <Modal open onClose={() => setView(null)} title="Restock Alert" drawer>
          <div className="space-y-3 text-sm">
            <p><strong>{view.name}</strong>{view.type ? ` — ${view.type}` : ''}</p>
            <p>On hand: <strong>{qty(view.current_stock)} {view.unit}</strong> (warning level {qty(view.low_stock_level)})</p>
            <div className="rounded-md bg-zinc-100 p-3">
              <div className="label">Reorder from</div>
              <div className="text-base font-bold">{view.supplier_name ?? 'No supplier linked'}</div>
              {view.supplier_phone && (
                <a href={`tel:${view.supplier_phone}`} className="btn-primary mt-3 w-full"><Phone size={16} /> Call {view.supplier_phone}</a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdjustModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const router = useRouter();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const d = Number(delta);
    if (!d) return setErr('Enter a non-zero adjustment (use a minus sign to reduce).');
    if (material.current_stock + d < 0) return setErr('That would make stock negative.');
    setBusy(true);
    const r = await adjustStockAction({ material_id: material.id, delta: d, reason });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Stock Adjustment" drawer>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm">
          <strong>{material.name}</strong>{material.type ? ` — ${material.type}` : ''}<br />
          Current stock: <strong>{qty(material.current_stock)} {material.unit}</strong>
        </p>
        <Field label={`Adjustment (${material.unit})`} hint="Positive adds stock, negative removes (e.g. -2 after a recount).">
          <input className="input" type="number" step="0.01" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason (required)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="e.g. Physical recount" />
        </Field>
        {err && <Notice>{err}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post adjustment'}</button>
        </div>
      </form>
    </Modal>
  );
}
