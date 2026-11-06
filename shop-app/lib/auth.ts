import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, verify, type Role, type Session } from './session';
import { rpc } from './supabase';

/** Valid signed cookie AND live DB session, else null. */
export async function currentUser(): Promise<Session | null> {
  const s = await verify(cookies().get(COOKIE)?.value);
  if (!s) return null;
  try {
    await rpc('me', { p_token: s.tok });
    return s;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: Role[]): Promise<Session> {
  const s = await currentUser();
  if (!s) redirect('/');
  if (roles && !roles.includes(s.role)) redirect(s.role === 'clerk' ? '/inventory' : '/dashboard');
  return s;
}
