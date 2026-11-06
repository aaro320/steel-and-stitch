import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import InventoryClient from '@/components/InventoryClient';
import { QuickStock } from '@/components/StockForms';
import AccountPanel from '@/components/AccountPanel';
import { PageHeader } from '@/components/ui';
import type { Material } from '@/lib/types';

export default async function InventoryPage() {
  const s = await requireUser();
  const [materials, suppliers, me] = await Promise.all([
    rpc<Material[]>('list_materials', { p_token: s.tok }),
    rpc<{ id: string; name: string }[]>('list_suppliers', { p_token: s.tok }),
    rpc<{ security_question: string }>('me', { p_token: s.tok }),
  ]);
  const sup = suppliers.map((x) => ({ id: x.id, name: x.name }));
  const clerk = s.role === 'clerk';

  return (
    <div>
      <PageHeader
        title={clerk ? `Hello, ${s.name}` : 'Raw Materials Inventory'}
        subtitle={clerk ? 'Record stock coming in or going out — then check the current inventory below.' : 'Current stock, low-stock alerts and material catalog'}
      />

      {clerk && (
        <div className="mb-8 grid gap-6 xl:grid-cols-2">
          <QuickStock kind="in" materials={materials} suppliers={sup} role={s.role} />
          <QuickStock kind="out" materials={materials} suppliers={sup} role={s.role} />
        </div>
      )}

      <InventoryClient materials={materials} suppliers={sup} role={s.role} />

      {clerk && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold">My Account</h2>
          <AccountPanel currentQuestion={me.security_question} />
        </div>
      )}
    </div>
  );
}
