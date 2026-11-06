'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteServiceAction, upsertServiceAction } from '@/app/actions';
import type { Service } from '@/lib/types';
import { peso } from '@/lib/format';
import { Field, Modal, Notice, PageHeader } from './ui';

export default function CatalogClient({ services }: { services: Service[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Service | 'new' | null>(null);
  const [del, setDel] = useState<Service | null>(null);
  const [err, setErr] = useState('');

  const remove = async () => {
    if (!del) return;
    const r = await deleteServiceAction(del.id);
    if (!r.ok) return setErr(r.error);
    setDel(null);
    router.refresh();
  };

  return (
    <div>
      <PageHeader title="Service & Product Catalog" subtitle="Standard steel works and upholstery services with base prices (PHP)">
        <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add Service</button>
      </PageHeader>
      {err && <div className="mb-3"><Notice>{err}</Notice></div>}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr><th className="th">Service / Product</th><th className="th">Variant</th><th className="th">Type</th><th className="th text-right">Base price</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {services.map((s) => (
              <tr key={s.id}>
                <td className="td font-semibold">{s.name}</td>
                <td className="td text-zinc-600">{s.variant || '—'}</td>
                <td className="td">{s.is_addon ? <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">ADD-ON</span> : <span className="text-zinc-500">Base service</span>}</td>
                <td className="td text-right font-bold tabular-nums">{peso(s.base_price)}</td>
                <td className="td whitespace-nowrap text-right">
                  <button className="btn-ghost btn-sm mr-1" onClick={() => setEdit(s)}><Pencil size={13} /> Edit</button>
                  <button className="btn-ghost btn-sm text-red-600" onClick={() => setDel(s)}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {services.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-zinc-500">No services yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && <ServiceModal service={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {del && (
        <Modal open onClose={() => setDel(null)} title="Delete service?">
          <p className="mb-4 text-sm">Remove <strong>{del.name}{del.variant ? ` (${del.variant})` : ''}</strong> from the catalog? Existing job orders keep their line items.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn-danger" onClick={remove}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ServiceModal({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: service?.name ?? '', variant: service?.variant ?? '',
    price: service ? String(service.base_price) : '', addon: service?.is_addon ?? false,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    const r = await upsertServiceAction({ id: service?.id ?? null, name: f.name, variant: f.variant, price: Number(f.price), addon: f.addon });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={service ? 'Edit Service' : 'Add Service'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
        <Field label="Variant"><input className="input" value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })} placeholder="e.g. Standard, Side Only" /></Field>
        <Field label="Base price (₱)"><input className="input" type="number" min="0" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.addon} onChange={(e) => setF({ ...f, addon: e.target.checked })} /> This is a design add-on (e.g. Custom Design Addition)</label>
        {err && <Notice>{err}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
