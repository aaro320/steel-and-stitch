import { redirect } from 'next/navigation';
import LoginScreen from '@/components/LoginScreen';
import { currentUser } from '@/lib/auth';
import { rpc } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const s = await currentUser();
  if (s) redirect(s.role === 'clerk' ? '/inventory' : '/dashboard');

  let profiles: any[] = [];
  let error: string | undefined;
  try {
    profiles = await rpc<any[]>('list_profiles');
  } catch (e: any) {
    error = 'Cannot reach the database. Check your Supabase environment variables and that schema.sql has been run.';
  }
  return <LoginScreen profiles={profiles} error={error} />;
}
