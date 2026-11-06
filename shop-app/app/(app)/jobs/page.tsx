import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import JobsClient from '@/components/JobsClient';
import { PageHeader } from '@/components/ui';
import type { JobOrder, Material, Service } from '@/lib/types';

export default async function JobsPage() {
  const s = await requireUser(['owner', 'admin']);
  const [jobs, materials, services, suppliers] = await Promise.all([
    rpc<JobOrder[]>('list_job_orders', { p_token: s.tok }),
    rpc<Material[]>('list_materials', { p_token: s.tok }),
    rpc<Service[]>('list_services', { p_token: s.tok }),
    rpc<{ id: string; name: string }[]>('list_suppliers', { p_token: s.tok }),
  ]);
  return (
    <div>
      <PageHeader title="Job Orders" subtitle="Custom upholstery & steel works jobs with automatic material deduction" />
      <JobsClient jobs={jobs} materials={materials} services={services}
        suppliers={suppliers.map((x) => ({ id: x.id, name: x.name }))} role={s.role} />
    </div>
  );
}
