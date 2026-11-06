'use client';

import { useState } from 'react';
import { changePinAction, changeQuestionAction } from '@/app/actions';
import { Field, Notice } from './ui';

type Res = { ok: true; data: any } | { ok: false; error: string };
const outcome = (r: Res): { ok: boolean; text: string } => {
  if (!r.ok) return { ok: false, text: r.error };
  if (r.data?.ok === false) {
    const e = r.data.error;
    return {
      ok: false,
      text: e === 'WRONG_PIN' ? 'Current PIN is incorrect.'
        : e === 'LOCKED' ? 'Too many wrong attempts. Wait 60 seconds.'
        : e === 'INVALID_PIN' ? 'New PIN must be exactly 4 digits.' : String(e),
    };
  }
  return { ok: true, text: 'Saved.' };
};

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

export default function AccountPanel({ currentQuestion }: { currentQuestion?: string }) {
  const [p, setP] = useState({ cur: '', next: '', conf: '' });
  const [pm, setPm] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState({ pin: '', question: '', answer: '' });
  const [qm, setQm] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPm(null);
    if (p.next.length !== 4) return setPm({ ok: false, text: 'New PIN must be exactly 4 digits.' });
    if (p.next !== p.conf) return setPm({ ok: false, text: 'New PINs do not match.' });
    setBusy(true);
    const r = outcome(await changePinAction({ current: p.cur, next: p.next }));
    setBusy(false);
    setPm({ ok: r.ok, text: r.ok ? 'PIN changed.' : r.text });
    if (r.ok) setP({ cur: '', next: '', conf: '' });
  };

  const saveQ = async (e: React.FormEvent) => {
    e.preventDefault();
    setQm(null);
    setBusy(true);
    const r = outcome(await changeQuestionAction({ pin: q.pin, question: q.question, answer: q.answer }));
    setBusy(false);
    setQm({ ok: r.ok, text: r.ok ? 'Security question updated.' : r.text });
    if (r.ok) setQ({ pin: '', question: '', answer: '' });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={savePin} className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">Change PIN</h2>
        <Field label="Current PIN"><input className="input" type="password" inputMode="numeric" value={p.cur} onChange={(e) => setP({ ...p, cur: digits(e.target.value) })} required /></Field>
        <Field label="New PIN (4 digits)"><input className="input" type="password" inputMode="numeric" value={p.next} onChange={(e) => setP({ ...p, next: digits(e.target.value) })} required /></Field>
        <Field label="Confirm new PIN"><input className="input" type="password" inputMode="numeric" value={p.conf} onChange={(e) => setP({ ...p, conf: digits(e.target.value) })} required /></Field>
        {pm && <Notice kind={pm.ok ? 'ok' : 'error'}>{pm.text}</Notice>}
        <button className="btn-primary" disabled={busy}>Update PIN</button>
      </form>

      <form onSubmit={saveQ} className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">Reset Security Question</h2>
        {currentQuestion && <p className="text-sm text-zinc-600">Current question: <strong>{currentQuestion}</strong></p>}
        <Field label="Current PIN"><input className="input" type="password" inputMode="numeric" value={q.pin} onChange={(e) => setQ({ ...q, pin: digits(e.target.value) })} required /></Field>
        <Field label="New security question"><input className="input" value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} required placeholder="e.g. What is the shop city?" /></Field>
        <Field label="Answer" hint="Not case-sensitive. Stored hashed; it can never be viewed again."><input className="input" value={q.answer} onChange={(e) => setQ({ ...q, answer: e.target.value })} required /></Field>
        {qm && <Notice kind={qm.ok ? 'ok' : 'error'}>{qm.text}</Notice>}
        <button className="btn-primary" disabled={busy}>Update question</button>
      </form>
    </div>
  );
}
