import Sidebar from '@/components/Sidebar';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={s.role} name={s.name} full={s.full} />
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
