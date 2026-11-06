import { requireUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';
import AccountPanel from '@/components/AccountPanel';
import { PageHeader } from '@/components/ui';

export default async function SettingsPage() {
  const s = await requireUser();
  const me = await rpc<{ security_question: string }>('me', { p_token: s.tok });
  return (
    <div>
      <PageHeader title="My Account" subtitle={`${s.full} (${s.name})`} />
      <AccountPanel currentQuestion={me.security_question} />
    </div>
  );
}
