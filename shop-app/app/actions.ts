'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { rpc } from '@/lib/supabase';
import { COOKIE, sign, verify } from '@/lib/session';

type R<T = any> = { ok: true; data: T } | { ok: false; error: string };

async function token() {
  const s = await verify(cookies().get(COOKIE)?.value);
  if (!s) throw new Error('Your session has expired. Please sign in again.');
  return s.tok;
}

function clean(msg: string) {
  return msg.replace(/^INSUFFICIENT_STOCK:\s*/, 'Not enough stock — ').replace(/^FORBIDDEN.*/, 'You do not have permission to do that.')
    .replace(/^UNAUTHENTICATED$/, 'Your session has expired. Please sign in again.');
}

async function run<T = any>(fn: string, args: (t: string) => Record<string, unknown>): Promise<R<T>> {
  try {
    const t = await token();
    const data = await rpc<T>(fn, args(t));
    revalidatePath('/', 'layout');
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: clean(e.message ?? 'Something went wrong') };
  }
}

/* ---------- authentication (public RPCs) ---------- */
export async function loginAction(profileId: string, pin: string) {
  try {
    const r = await rpc<any>('verify_pin', { p_profile_id: profileId, p_pin: pin });
    if (r.ok) {
      const jwt = await sign({ tok: r.token, uid: r.id, role: r.role, name: r.nickname, full: r.full_name });
      cookies().set(COOKIE, jwt, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
      });
      return { ok: true as const, role: r.role as string };
    }
    return { ok: false as const, error: r.error as string, remaining: r.remaining as number | undefined, retry_after: r.retry_after as number | undefined };
  } catch (e: any) {
    return { ok: false as const, error: 'SERVER', remaining: undefined as number | undefined, retry_after: undefined as number | undefined };
  }
}

export async function logoutAction() {
  try {
    const s = await verify(cookies().get(COOKIE)?.value);
    if (s) await rpc('logout', { p_token: s.tok });
  } catch { /* ignore */ }
  cookies().delete(COOKIE);
}

export async function getQuestionAction(profileId: string) {
  try {
    return (await rpc<string | null>('get_security_question', { p_profile_id: profileId })) ?? '';
  } catch { return ''; }
}

export async function resetPinAction(profileId: string, answer: string, newPin: string) {
  try {
    return await rpc<any>('reset_pin_with_answer', { p_profile_id: profileId, p_answer: answer, p_new_pin: newPin });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/* ---------- account ---------- */
export const changePinAction = (f: { current: string; next: string }) =>
  run('change_pin', (t) => ({ p_token: t, p_current: f.current, p_new: f.next }));

export const changeQuestionAction = (f: { pin: string; question: string; answer: string }) =>
  run('change_security_question', (t) => ({ p_token: t, p_current_pin: f.pin, p_question: f.question, p_answer: f.answer }));

/* ---------- users ---------- */
export const createUserAction = (f: { full_name: string; nickname: string; role: string; pin: string; question: string; answer: string }) =>
  run('create_profile', (t) => ({ p_token: t, p_full_name: f.full_name, p_nickname: f.nickname, p_role: f.role, p_pin: f.pin, p_question: f.question, p_answer: f.answer }));

export const deleteUserAction = (id: string) => run('delete_profile', (t) => ({ p_token: t, p_id: id }));

export const adminResetPinAction = (id: string, pin: string) =>
  run('admin_reset_pin', (t) => ({ p_token: t, p_target: id, p_new_pin: pin }));

/* ---------- materials & stock ---------- */
export interface MaterialInput {
  category: string; name: string; type: string; unit: string;
  low: number; price: number; stock: number; supplier_id: string | null;
}
export const createMaterialAction = (f: MaterialInput) =>
  run<{ id: string }>('create_material', (t) => ({
    p_token: t, p_category: f.category, p_name: f.name, p_type: f.type, p_unit: f.unit,
    p_low: f.low, p_supplier: f.supplier_id, p_price: f.price, p_stock: f.stock,
  }));

export const updateMaterialAction = (id: string, f: MaterialInput) =>
  run('update_material', (t) => ({
    p_token: t, p_id: id, p_category: f.category, p_name: f.name, p_type: f.type, p_unit: f.unit,
    p_low: f.low, p_price: f.price, p_supplier: f.supplier_id,
  }));

export const stockAction = (f: { material_id: string; kind: 'in' | 'out'; qty: number; reason?: string; notes?: string }) =>
  run<{ balance: number }>('stock_transaction', (t) => ({
    p_token: t, p_material_id: f.material_id, p_kind: f.kind, p_qty: f.qty,
    p_reason: f.reason ?? null, p_notes: f.notes ?? null,
  }));

export const adjustStockAction = (f: { material_id: string; delta: number; reason: string }) =>
  run('stock_adjust', (t) => ({ p_token: t, p_material_id: f.material_id, p_delta: f.delta, p_reason: f.reason }));

/* ---------- suppliers ---------- */
export const upsertSupplierAction = (f: { id: string | null; name: string; contact: string; supplied: string[] }) =>
  run('upsert_supplier', (t) => ({ p_token: t, p_id: f.id, p_name: f.name, p_contact: f.contact, p_supplied: f.supplied }));
export const deleteSupplierAction = (id: string) => run('delete_supplier', (t) => ({ p_token: t, p_id: id }));

/* ---------- catalog ---------- */
export const upsertServiceAction = (f: { id: string | null; name: string; variant: string; price: number; addon: boolean }) =>
  run('upsert_service', (t) => ({ p_token: t, p_id: f.id, p_name: f.name, p_variant: f.variant, p_price: f.price, p_addon: f.addon }));
export const deleteServiceAction = (id: string) => run('delete_service', (t) => ({ p_token: t, p_id: id }));

/* ---------- job orders ---------- */
export const createJobAction = (payload: Record<string, unknown>) =>
  run<{ id: string; job_no: number }>('create_job_order', (t) => ({ p_token: t, p_payload: payload }));
export const jobStatusAction = (id: string, status: string) =>
  run('update_job_status', (t) => ({ p_token: t, p_id: id, p_status: status }));
