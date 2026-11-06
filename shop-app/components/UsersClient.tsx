'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { adminResetPinAction, createUserAction, deleteUserAction } from '@/app/actions';
import type { UserRow } from '@/lib/types';
import { Field, Modal, Notice, PageHeader, RoleBadge } from './ui';

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

export default function UsersClient({ users, role, meId }: { users: UserRow[]; role: 'owner' | 'admin'; meId: string }) {
  const router = useRouter();
  const [create, setCreate] = useState(false);
  const [reset, setReset] = useState<UserRow | null>(null);
  const [del, setDel] = useState<UserRow | null>(null);
  const [err, setErr] = useState('');

  const canReset = (u: UserRow) => role === 'owner' || u.role === 'clerk';

  const remove = async () => {
    if (!del) return;
    const r = await deleteUserAction(del.id);
    if (!r.ok) return setErr(r.error);
    setDel(null);
    router.refresh();
  };

  return (
    <div>
      <PageHeader title="User Profiles" subtitle={role === 'owner' ? 'Create, reset and remove profiles' : 'Create profiles and reset Inventory Clerk PINs'}>
        <button className="btn-primary" onClick={() => setCreate(true)}><Plus size={16} /> New Profile</button>
      </PageHeader>
      {err && <div className="mb-3"><Notice>{err}</Notice></div>}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50"><tr><th className="th">Nickname</th><th className="th">Full name</th><th className="th">Role</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td font-bold">{u.nickname}{u.id === meId && <span className="ml-2 text-xs font-semibold text-zinc-400">(you)</span>}</td>
                <td className="td text-zinc-600">{u.full_name}</td>
                <td className="td"><RoleBadge role={u.role} /></td>
                <td className="td whitespace-nowrap text-right">
                  {canReset(u) && <button className="btn-ghost btn-sm mr-1" onClick={() => setReset(u)}><KeyRound size={13} /> Reset PIN</button>}
                  {role === 'owner' && u.role !== 'owner' && u.id !== meId && (
                    <button className="btn-ghost btn-sm text-red-600" onClick={() => setDel(u)}><Trash2 size={13} /> Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {create && <CreateModal onClose={() => setCreate(false)} />}
      {reset && <ResetModal user={reset} onClose={() => setReset(null)} />}
      {del && (
        <Modal open onClose={() => setDel(null)} title="Remove profile?">
          <p className="mb-4 text-sm">Permanently remove <strong>{del.nickname}</strong> ({del.full_name})? They will no longer be able to sign in. Their past audit-trail entries are kept.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn-danger" onClick={remove}>Remove</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ full_name: '', nickname: '', role: 'clerk', pin: '', question: '', answer: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (f.pin.length !== 4) return setErr('PIN must be exactly 4 digits.');
    setBusy(true);
    const r = await createUserAction(f);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="New Profile">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><input className="input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} required autoFocus /></Field>
        <Field label="Nickname / display name"><input className="input" value={f.nickname} onChange={(e) => set('nickname', e.target.value)} required /></Field>
        <Field label="Role">
          <select className="input" value={f.role} onChange={(e) => set('role', e.target.value)}>
            <option value="clerk">Inventory Clerk / Staff</option><option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Initial PIN (4 digits)"><input className="input" type="password" inputMode="numeric" value={f.pin} onChange={(e) => set('pin', digits(e.target.value))} required /></Field>
        <Field label="Security question"><input className="input" value={f.question} onChange={(e) => set('question', e.target.value)} required placeholder="What is the shop city?" /></Field>
        <Field label="Security answer"><input className="input" value={f.answer} onChange={(e) => set('answer', e.target.value)} required /></Field>
        {err && <Notice>{err}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create profile'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pin.length !== 4) return setErr('PIN must be exactly 4 digits.');
    setBusy(true);
    const r = await adminResetPinAction(user.id, pin);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Reset PIN — ${user.nickname}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-zinc-600">Sets a new PIN and signs this user out everywhere. Tell them the new PIN in person.</p>
        <Field label="New PIN (4 digits)"><input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(digits(e.target.value))} required autoFocus /></Field>
        {err && <Notice>{err}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Reset PIN'}</button>
        </div>
      </form>
    </Modal>
  );
}
