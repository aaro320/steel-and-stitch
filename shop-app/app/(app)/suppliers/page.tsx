import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import SuppliersClient from '@/components/SuppliersClient';
import type { Supplier } from '@/lib/types';

export default async function SuppliersPage() {
  const s = await requireUser(['owner', 'admin']);
  const suppliers = await rpc<Supplier[]>('list_suppliers', { p_token: s.tok });
  return <SuppliersClient suppliers={suppliers} />;
}
