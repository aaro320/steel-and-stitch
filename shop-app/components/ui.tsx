'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { STATUSES } from '@/lib/types';

export function Modal({
  open, onClose, title, children, wide, drawer,
}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; drawer?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-zinc-900/60 p-4 ${drawer ? 'items-stretch justify-end' : 'items-center justify-center'}`}
      onMouseDown={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`card flex w-full flex-col ${drawer ? 'max-w-md' : wide ? 'max-h-[92vh] max-w-4xl' : 'max-h-[92vh] max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-zinc-100"><X size={18} /></button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'ok' | 'warn'; children: ReactNode }) {
  const c = kind === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : kind === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-red-300 bg-red-50 text-red-800';
  return <div className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    owner: 'bg-zinc-900 text-amber-400',
    admin: 'bg-sky-100 text-sky-800',
    clerk: 'bg-emerald-100 text-emerald-800',
  };
  const label = role === 'clerk' ? 'Inventory Clerk' : role === 'owner' ? 'Owner' : 'Admin';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${map[role] ?? ''}`}>{label}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: 'bg-zinc-200 text-zinc-800',
    'In Progress': 'bg-blue-600 text-white',
    'Ready for Pickup': 'bg-amber-500 text-zinc-950',
    Completed: 'bg-emerald-600 text-white',
  };
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-bold ${map[status] ?? ''}`}>{status}</span>;
}

export const STATUS_LIST = STATUSES;

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
