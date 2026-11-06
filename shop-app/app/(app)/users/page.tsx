import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import UsersClient from '@/components/UsersClient';
import type { UserRow } from '@/lib/types';

export default async function UsersPage() {
  const s = await requireUser(['owner', 'admin']);
  const users = await rpc<UserRow[]>('list_users', { p_token: s.tok });
  return <UsersClient users={users} role={s.role as 'owner' | 'admin'} meId={s.uid} />;
}
