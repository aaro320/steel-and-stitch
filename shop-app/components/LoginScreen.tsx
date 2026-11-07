'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete, KeyRound } from 'lucide-react';
import { getQuestionAction, loginAction, resetPinAction } from '@/app/actions';
import { Modal, Notice, RoleBadge } from './ui';
import type { Role } from '@/lib/session';

interface P { id: string; nickname: string; full_name: string; role: Role }

const FILTERS: { key: 'all' | Role; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'owner', label: 'Owner' },
  { key: 'admin', label: 'Admins' },
  { key: 'clerk', label: 'Inventory Clerk' },
];

export default function LoginScreen({ profiles, error }: { profiles: P[]; error?: string }) {
  const [filter, setFilter] = useState<'all' | Role>('all');
  const [sel, setSel] = useState<P | null>(null);
  const shown = profiles.filter((p) => filter === 'all' || p.role === filter);

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="mb-10 flex items-center gap-4 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Tatak Budz Upholstery Works icon"
            className="h-24 w-24 shrink-0 rounded-full bg-white object-contain p-1 ring-4 ring-amber-500" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Tatak Budz</h1>
            <p className="text-lg font-semibold text-amber-400">Upholstery Works</p>
            <p className="text-zinc-400">Inventory &amp; Job Order Management — choose your profile</p>
          </div>
        </div>

        {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}

        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                filter === f.key ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <button
              key={p.id}
              onClick={() => setSel(p)}
              className="group rounded-xl border border-zinc-700 bg-zinc-800 p-5 text-left transition hover:border-amber-500 hover:bg-zinc-700"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-600 text-lg font-bold text-white group-hover:bg-amber-500 group-hover:text-zinc-950">
                {p.nickname.slice(0, 1).toUpperCase()}
              </div>
              <div className="mb-2 truncate text-lg font-bold text-white">{p.nickname}</div>
              <RoleBadge role={p.role} />
            </button>
          ))}
          {shown.length === 0 && <p className="col-span-full text-zinc-400">No profiles in this group.</p>}
        </div>
      </div>

      {sel && <PinModal key={sel.id} profile={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function PinModal({ profile, onClose }: { profile: P; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<'pin' | 'forgot'>('pin');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [lock, setLock] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = lock > 0;

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setLock((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [locked]);

  const press = useCallback((d: string) => {
    if (busy || lock > 0) return;
    setErr(''); setInfo('');
    setPin((p) => (p.length >= 4 ? p : p + d));
  }, [busy, lock]);

  const back = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  // physical keyboard support
  useEffect(() => {
    if (mode !== 'pin') return;
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mode, press, back]);

  // auto-submit at 4 digits (keeps clerk flow to 3 steps)
  useEffect(() => {
    if (pin.length !== 4 || busy || locked) return;
    (async () => {
      setBusy(true);
      const r = await loginAction(profile.id, pin);
      if (r.ok) {
        router.push(r.role === 'clerk' ? '/inventory' : '/dashboard');
        router.refresh();
        return;
      }
      setBusy(false);
      setPin('');
      if (r.error === 'LOCKED') {
        setLock(r.retry_after ?? 60);
        setErr('Too many wrong attempts. PIN entry is locked.');
      } else if (r.error === 'WRONG_PIN') {
        setErr(`Incorrect PIN. ${r.remaining ?? ''} attempt(s) left.`);
      } else {
        setErr('Could not sign in. Check the server configuration and try again.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <Modal open onClose={onClose} title={mode === 'pin' ? `Enter PIN — ${profile.nickname}` : 'Forgot PIN'}>
      {mode === 'pin' ? (
        <div>
          <div className="mb-5 flex justify-center gap-3" aria-label="PIN entered">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'border-amber-500 bg-amber-500' : 'border-zinc-300'}`} />
            ))}
          </div>

          <div className="mb-3 min-h-[2.5rem] space-y-2">
            {info && <Notice kind="ok">{info}</Notice>}
            {err && <Notice kind="error">{err}{locked ? ` Try again in ${lock}s.` : ''}</Notice>}
          </div>

          <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-3">
            {keys.map((k) => (
              <button key={k} disabled={busy || locked} onClick={() => press(k)}
                className="h-16 rounded-xl border border-zinc-300 bg-zinc-50 text-2xl font-bold hover:bg-amber-100 active:scale-95 disabled:opacity-40">
                {k}
              </button>
            ))}
            <button disabled={busy || locked} onClick={() => setPin('')}
              className="h-16 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-500 hover:bg-zinc-100 disabled:opacity-40">
              Clear
            </button>
            <button disabled={busy || locked} onClick={() => press('0')}
              className="h-16 rounded-xl border border-zinc-300 bg-zinc-50 text-2xl font-bold hover:bg-amber-100 active:scale-95 disabled:opacity-40">
              0
            </button>
            <button disabled={busy || locked} onClick={back} aria-label="Backspace"
              className="flex h-16 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">
              <Delete size={22} />
            </button>
          </div>

          <button onClick={() => { setMode('forgot'); setErr(''); }}
            className="mx-auto mt-5 flex items-center gap-1.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
            <KeyRound size={14} /> Forgot PIN?
          </button>
        </div>
      ) : (
        <ForgotFlow profile={profile}
          onDone={() => { setMode('pin'); setPin(''); setInfo('PIN updated. Enter your new PIN.'); }}
          onBack={() => setMode('pin')} />
      )}
    </Modal>
  );
}

function ForgotFlow({ profile, onDone, onBack }: { profile: P; onDone: () => void; onBack: () => void }) {
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getQuestionAction(profile.id).then(setQuestion); }, [profile.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^\d{4}$/.test(pin)) return setErr('New PIN must be exactly 4 digits.');
    if (pin !== pin2) return setErr('PINs do not match.');
    setBusy(true);
    const r = await resetPinAction(profile.id, answer, pin);
    setBusy(false);
    if (r.ok) return onDone();
    if (r.error === 'LOCKED') setErr('Too many wrong attempts. Wait 60 seconds and try again.');
    else if (r.error === 'WRONG_ANSWER') setErr(`Wrong answer. ${r.remaining ?? ''} attempt(s) left.`);
    else setErr('Could not reset the PIN.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">Security question</span>
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold">{question === null ? 'Loading…' : question || '—'}</p>
      </div>
      <label className="block"><span className="label">Your answer</span>
        <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus required />
      </label>
      <label className="block"><span className="label">New PIN (4 digits)</span>
        <input className="input" type="password" inputMode="numeric" maxLength={4} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} required />
      </label>
      <label className="block"><span className="label">Confirm new PIN</span>
        <input className="input" type="password" inputMode="numeric" maxLength={4} value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} required />
      </label>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="flex justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Reset PIN'}</button>
      </div>
    </form>
  );
}
