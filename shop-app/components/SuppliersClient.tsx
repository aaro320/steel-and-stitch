'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { deleteSupplierAction, upsertSupplierAction } from '@/app/actions';
import type { Supplier } from '@/lib/types';
import { qty } from '@/lib/format';
import { Field, Modal, Notice, PageHeader } from './ui';

export default function SuppliersClient({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Supplier | 'new' | null>(null);
  const [del, setDel] = useState<Supplier | null>(null);
  const [err, setErr] = useState('');

  const remove = async () => {
    if (!del) return;
    const r = await deleteSupplierAction(del.id);
    if (!r.ok) return setErr(r.error);
    setDel(null);
    router.refresh();
  };

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Supplier directory and the inventory items linked to each">
        <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add Supplier</button>
      </PageHeader>
      {err && <div className="mb-3"><Notice>{err}</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-2">
        {suppliers.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{s.name}</h2>
                {s.contact_number && (
                  <a href={`tel:${s.contact_number}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline">
                    <Phone size={14} /> {s.contact_number}
                  </a>
                )}
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost btn-sm" onClick={() => setEdit(s)}><Pencil size={13} /> Edit</button>
                <button className="btn-ghost btn-sm text-red-600" onClick={() => setDel(s)}><Trash2 size={13} /></button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {s.supplied_materials.map((m) => <span key={m} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">{m}</span>)}
              {s.supplied_materials.length === 0 && <span className="text-sm text-zinc-500">No supplied-materials list</span>}
            </div>

            <div className="label">Linked inventory items ({s.items.length})</div>
            <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
              {s.items.map((i) => {
                const low = i.current_stock <= i.low_stock_level;
                return (
                  <li key={i.id} className={`flex items-center justify-between px-3 py-2 text-sm ${low ? 'bg-amber-50' : ''}`}>
                    <span className="font-semibold">{i.name}{i.type ? <span className="font-normal text-zinc-500"> — {i.type}</span> : null}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {low && <AlertTriangle size={13} className="text-amber-600" />}
                      {qty(i.current_stock)} {i.unit}
                    </span>
                  </li>
                );
              })}
              {s.items.length === 0 && <li className="px-3 py-3 text-sm text-zinc-500">No inventory items linked yet.</li>}
            </ul>
          </div>
        ))}
        {suppliers.length === 0 && <p className="text-zinc-500">No suppliers yet.</p>}
      </div>

      {edit && <SupplierModal supplier={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {del && (
        <Modal open onClose={() => setDel(null)} title="Delete supplier?">
          <p className="mb-4 text-sm">Remove <strong>{del.name}</strong>? Its {del.items.length} linked item(s) stay in inventory without a supplier.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn-danger" onClick={remove}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: supplier?.name ?? '', contact: supplier?.contact_number ?? '',
    supplied: (supplier?.supplied_materials ?? []).join(', '),
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const r = await upsertSupplierAction({
      id: supplier?.id ?? null, name: f.name, contact: f.contact,
      supplied: f.supplied.split(',').map((x) => x.trim()).filter(Boolean),
    });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={supplier ? 'Edit Supplier' : 'Add Supplier'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Supplier name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
        <Field label="Contact number"><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} inputMode="tel" placeholder="09XXXXXXXXX" /></Field>
        <Field label="Supplied materials" hint="Separate with commas"><input className="input" value={f.supplied} onChange={(e) => setF({ ...f, supplied: e.target.value })} placeholder="Leather, Charol, Foam" /></Field>
        {err && <Notice>{err}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
