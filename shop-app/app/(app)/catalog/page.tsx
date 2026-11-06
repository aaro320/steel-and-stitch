import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import CatalogClient from '@/components/CatalogClient';
import type { Service } from '@/lib/types';

export default async function CatalogPage() {
  const s = await requireUser(['owner', 'admin']);
  const services = await rpc<Service[]>('list_services', { p_token: s.tok });
  return <CatalogClient services={services} />;
}
