'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowUpFromLine, Plus } from 'lucide-react';
import { createMaterialAction, stockAction, updateMaterialAction } from '@/app/actions';
import { CATEGORIES, UNITS, type Material } from '@/lib/types';
import { qty } from '@/lib/format';
import { Field, Modal, Notice } from './ui';

type Sup = { id: string; name: string };

/* ------------------------------------------------------------------ */
/* Create / edit material. Used inline (FR-022) and from the inventory */
/* ------------------------------------------------------------------ */
export function MaterialModal({
  open, onClose, role, suppliers, material, onCreated,
}: {
  open: boolean; onClose: () => void; role: 'owner' | 'admin' | 'clerk'; suppliers: Sup[];
  material?: Material | null; onCreated?: (m: Material) => void;
}) {
  const router = useRouter();
  const clerk = role === 'clerk';
  const [f, setF] = useState({
    category: material?.category ?? CATEGORIES[0],
    name: material?.name ?? '',
    type: material?.type ?? '',
    unit: material?.unit ?? UNITS[0],
    low: String(material?.low_stock_level ?? 0),
    price: String(material?.unit_price ?? 0),
    stock: '0',
    supplier_id: material?.supplier_id ?? '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const input = {
      category: f.category, name: f.name, type: f.type, unit: f.unit,
      low: Number(f.low) || 0, price: Number(f.price) || 0, stock: Number(f.stock) || 0,
      supplier_id: f.supplier_id || null,
    };
    const r = material ? await updateMaterialAction(material.id, input) : await createMaterialAction(input);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    if (!material && onCreated) {
      const sup = suppliers.find((s) => s.id === input.supplier_id);
      onCreated({
        id: (r.data as { id: string }).id, category: input.category, name: input.name.trim(), type: input.type.trim(),
        unit: input.unit, current_stock: clerk ? 0 : input.stock, low_stock_level: input.low,
        unit_price: clerk ? null : input.price, supplier_id: input.supplier_id,
        supplier_name: sup?.name ?? null, supplier_phone: null,
      });
    }
    router.refresh();
    onClose();
  };

  if (!open) return null;
  return (
    <Modal open onClose={onClose} title={material ? 'Edit Material' : '+ New Material'} drawer>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Material name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Charol" /></Field>
        <Field label="Type / thickness / color"><input className="input" value={f.type} onChange={(e) => set('type', e.target.value)} placeholder="e.g. Black, 1/4, Standard" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit">
            <select className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Low-stock warning"><input className="input" type="number" min="0" step="0.01" value={f.low} onChange={(e) => set('low', e.target.value)} /></Field>
        </div>
        {!clerk && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit price (₱)"><input className="input" type="number" min="0" step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
            {!material && <Field label="Opening stock"><input className="input" type="number" min="0" step="0.01" value={f.stock} onChange={(e) => set('stock', e.target.value)} /></Field>}
          </div>
        )}
        <Field label="Supplier">
          <select className="input" value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">— none —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        {err && <Notice>{err}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : material ? 'Save changes' : 'Add material'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Quick stock-in / stock-out form (inline card)                       */
/* ------------------------------------------------------------------ */
export function QuickStock({
  kind, materials, suppliers, role,
}: { kind: 'in' | 'out'; materials: Material[]; suppliers: Sup[]; role: 'owner' | 'admin' | 'clerk' }) {
  const router = useRouter();
  const [extra, setExtra] = useState<Material[]>([]);
  const [mid, setMid] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<'usage' | 'wastage'>('usage');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const all = [...materials, ...extra.filter((x) => !materials.some((m) => m.id === x.id))];
  const sel = all.find((m) => m.id === mid);
  const isIn = kind === 'in';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const n = Number(amount);
    if (!sel) return setMsg({ ok: false, text: 'Choose a material.' });
    if (!(n > 0)) return setMsg({ ok: false, text: 'Enter a quantity greater than zero.' });
    if (!isIn && n > sel.current_stock) {
      return setMsg({ ok: false, text: `Only ${qty(sel.current_stock)} ${sel.unit} available — stock cannot go negative.` });
    }
    setBusy(true);
    const r = await stockAction({ material_id: sel.id, kind, qty: n, reason: isIn ? undefined : reason, notes });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setExtra((p) => p.map((m) => (m.id === sel.id ? { ...m, current_stock: r.data.balance } : m)));
    setMsg({ ok: true, text: `${isIn ? 'Stocked in' : 'Stocked out'} ${qty(n)} ${sel.unit} of ${sel.name}. New balance: ${qty(r.data.balance)}.` });
    setAmount(''); setNotes('');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {isIn ? <ArrowDownToLine size={22} /> : <ArrowUpFromLine size={22} />}
        </div>
        <h2 className="text-lg font-extrabold">{isIn ? 'Quick Stock-In' : 'Quick Stock-Out'}</h2>
      </div>

      <div className="space-y-3">
        <Field label="Material">
          <div className="flex gap-2">
            <select className="input" value={mid} onChange={(e) => setMid(e.target.value)}>
              <option value="">Select material…</option>
              {all.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.type ? ` — ${m.type}` : ''} ({qty(m.current_stock)} {m.unit})
                </option>
              ))}
            </select>
            <button type="button" className="btn-ghost shrink-0" onClick={() => setAdding(true)} title="Register a new material">
              <Plus size={16} /> New
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity${sel ? ` (${sel.unit})` : ''}`}>
            <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          {!isIn && (
            <Field label="Reason">
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value as 'usage' | 'wastage')}>
                <option value="usage">Usage</option>
                <option value="wastage">Wastage</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="Notes (optional)"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isIn ? 'e.g. Delivery from supplier' : 'e.g. Used for trike seat'} /></Field>

        {msg && <Notice kind={msg.ok ? 'ok' : 'error'}>{msg.text}</Notice>}
        <button className={isIn ? 'btn-primary w-full' : 'btn-dark w-full'} disabled={busy}>
          {busy ? 'Saving…' : isIn ? 'Submit Stock-In' : 'Submit Stock-Out'}
        </button>
      </div>

      {adding && (
        <MaterialModal open onClose={() => setAdding(false)} role={role} suppliers={suppliers}
          onCreated={(m) => { setExtra((p) => [...p, m]); setMid(m.id); }} />
      )}
    </form>
  );
}
