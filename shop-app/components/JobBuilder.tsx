'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { createJobAction } from '@/app/actions';
import { STATUSES, type Material, type Service } from '@/lib/types';
import { peso, qty } from '@/lib/format';
import { Field, Modal, Notice } from './ui';
import { MaterialModal } from './StockForms';

type Line = { key: number; kind: 'service' | 'addon' | 'custom'; name: string; description: string; unit_price: number; quantity: number };
type MatRow = { key: number; material_id: string; quantity: string };
type Sup = { id: string; name: string };

let seq = 1;

export default function JobBuilder({
  open, onClose, materials, services, suppliers, role,
}: {
  open: boolean; onClose: () => void; materials: Material[]; services: Service[]; suppliers: Sup[];
  role: 'owner' | 'admin' | 'clerk';
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<string>('Pending');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [mats, setMats] = useState<MatRow[]>([]);
  const [extra, setExtra] = useState<Material[]>([]);
  const [svcId, setSvcId] = useState('');
  const [cust, setCust] = useState({ name: '', description: '', price: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [creatingFor, setCreatingFor] = useState<number | null>(null);

  const allMats = [...materials, ...extra.filter((x) => !materials.some((m) => m.id === x.id))];
  const total = lines.reduce((a, l) => a + l.unit_price * l.quantity, 0);

  const addService = () => {
    const s = services.find((x) => x.id === svcId);
    if (!s) return;
    setLines((p) => [...p, {
      key: seq++, kind: s.is_addon ? 'addon' : 'service',
      name: s.variant ? `${s.name} (${s.variant})` : s.name, description: '',
      unit_price: Number(s.base_price), quantity: 1,
    }]);
    setSvcId('');
  };

  const addCustom = () => {
    const price = Number(cust.price);
    if (!cust.name.trim() || !(price >= 0) || cust.price === '') {
      return setErr('A custom item needs a name and a price.');
    }
    setErr('');
    setLines((p) => [...p, { key: seq++, kind: 'custom', name: cust.name.trim(), description: cust.description.trim(), unit_price: price, quantity: 1 }]);
    setCust({ name: '', description: '', price: '' });
  };

  const setLine = (key: number, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const setMat = (key: number, patch: Partial<MatRow>) => setMats((p) => p.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  const submit = async () => {
    setErr('');
    if (!customer.trim()) return setErr('Customer name is required.');
    if (lines.length === 0) return setErr('Add at least one service or line item.');
    const used = mats.filter((m) => m.material_id);
    for (const m of used) {
      const mat = allMats.find((x) => x.id === m.material_id)!;
      const n = Number(m.quantity);
      if (!(n > 0)) return setErr(`Enter a quantity for ${mat.name}.`);
      const sameTotal = used.filter((u) => u.material_id === m.material_id).reduce((a, u) => a + Number(u.quantity), 0);
      if (sameTotal > mat.current_stock) {
        return setErr(`${mat.name}${mat.type ? ' — ' + mat.type : ''}: only ${qty(mat.current_stock)} ${mat.unit} in stock.`);
      }
    }
    setBusy(true);
    const r = await createJobAction({
      customer_name: customer, contact_details: contact, status, notes,
      items: lines.map(({ kind, name, description, unit_price, quantity }) => ({ kind, name, description, unit_price, quantity })),
      materials: used.map((m) => ({ material_id: m.material_id, quantity: Number(m.quantity) })),
    });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
    onClose();
  };

  if (!open) return null;
  return (
    <Modal open onClose={onClose} title="New Job Order" wide>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Customer name"><input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} autoFocus /></Field>
          <Field label="Contact / plate / details"><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="0917…, plate no., tricycle model" /></Field>
          <Field label="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>

        {/* Services, add-ons, custom lines */}
        <section>
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-zinc-500">Services &amp; add-ons</h3>
          <div className="mb-3 flex gap-2">
            <select className="input" value={svcId} onChange={(e) => setSvcId(e.target.value)}>
              <option value="">Select a service or design add-on…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.is_addon ? '+ ' : ''}{s.name}{s.variant ? ` (${s.variant})` : ''} — {peso(s.base_price)}</option>
              ))}
            </select>
            <button type="button" className="btn-dark shrink-0" onClick={addService} disabled={!svcId}><Plus size={16} /> Add</button>
          </div>

          <div className="mb-3 grid gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 md:grid-cols-[1fr_1.4fr_140px_auto]">
            <input className="input" placeholder="Custom item name" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
            <input className="input" placeholder="Description" value={cust.description} onChange={(e) => setCust({ ...cust, description: e.target.value })} />
            <input className="input" type="number" min="0" step="0.01" placeholder="Price ₱" value={cust.price} onChange={(e) => setCust({ ...cust, price: e.target.value })} />
            <button type="button" className="btn-ghost" onClick={addCustom}><Plus size={16} /> Custom line</button>
          </div>

          {lines.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-zinc-500"><th className="py-1.5">Item</th><th className="w-20">Qty</th><th className="w-36 text-right">Price</th><th className="w-32 text-right">Subtotal</th><th className="w-10" /></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-b border-zinc-100">
                    <td className="py-2">
                      <div className="font-semibold">{l.name}{l.kind === 'custom' && <span className="ml-2 rounded bg-zinc-200 px-1.5 text-[10px] font-bold">CUSTOM</span>}</div>
                      {l.description && <div className="text-xs text-zinc-500">{l.description}</div>}
                    </td>
                    <td><input className="input !px-2 !py-1" type="number" min="1" step="1" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></td>
                    <td className="pl-2"><input className="input !px-2 !py-1 text-right" type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => setLine(l.key, { unit_price: Math.max(0, Number(e.target.value) || 0) })} /></td>
                    <td className="text-right font-bold tabular-nums">{peso(l.unit_price * l.quantity)}</td>
                    <td className="text-right"><button type="button" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3} className="pt-3 text-right text-xs font-bold uppercase text-zinc-500">Total</td><td className="pt-3 text-right text-lg font-extrabold tabular-nums">{peso(total)}</td><td /></tr></tfoot>
            </table>
          )}
        </section>

        {/* Materials */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-zinc-500">Materials used (deducted from inventory on save)</h3>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setMats((p) => [...p, { key: seq++, material_id: '', quantity: '' }])}><Plus size={14} /> Add material</button>
          </div>
          <div className="space-y-2">
            {mats.map((m) => {
              const mat = allMats.find((x) => x.id === m.material_id);
              const over = mat && Number(m.quantity) > mat.current_stock;
              return (
                <div key={m.key} className="grid items-start gap-2 md:grid-cols-[1fr_auto_140px_auto]">
                  <select className="input" value={m.material_id} onChange={(e) => setMat(m.key, { material_id: e.target.value })}>
                    <option value="">Select material…</option>
                    {allMats.map((x) => <option key={x.id} value={x.id}>{x.name}{x.type ? ` — ${x.type}` : ''} ({qty(x.current_stock)} {x.unit} left)</option>)}
                  </select>
                  <button type="button" className="btn-ghost shrink-0" onClick={() => setCreatingFor(m.key)} title="Register a new material"><Plus size={14} /> New</button>
                  <div>
                    <input className={`input ${over ? '!border-red-500' : ''}`} type="number" min="0" step="0.01" placeholder={mat ? `Qty (${mat.unit})` : 'Qty'} value={m.quantity} onChange={(e) => setMat(m.key, { quantity: e.target.value })} />
                    {over && <div className="mt-1 text-xs font-semibold text-red-600">Exceeds stock</div>}
                  </div>
                  <button type="button" onClick={() => setMats((p) => p.filter((x) => x.key !== m.key))} className="rounded p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove material"><Trash2 size={15} /></button>
                </div>
              );
            })}
            {mats.length === 0 && <p className="text-sm text-zinc-500">No materials allocated yet.</p>}
          </div>
        </section>

        {err && <Notice>{err}</Notice>}
        <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
          <div className="text-lg font-extrabold">Total {peso(total)}</div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Confirm Job Order'}</button>
          </div>
        </div>
      </div>

      {creatingFor !== null && (
        <MaterialModal open onClose={() => setCreatingFor(null)} role={role} suppliers={suppliers}
          onCreated={(m) => { setExtra((p) => [...p, m]); setMat(creatingFor, { material_id: m.id }); }} />
      )}
    </Modal>
  );
}
