'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeftRight, BarChart3, ClipboardList, LayoutDashboard, LogOut, Package,
  ScrollText, Settings, Tags, Truck, Users,
} from 'lucide-react';
import { logoutAction } from '@/app/actions';
import { RoleBadge } from './ui';

const ADMIN_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/inventory', label: 'Raw Materials', icon: Package },
  { href: '/stock', label: 'Stock In / Out', icon: ArrowLeftRight },
  { href: '/jobs', label: 'Job Orders', icon: ClipboardList },
  { href: '/catalog', label: 'Service Catalog', icon: Tags },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/audit', label: 'Audit Trail', icon: ScrollText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/users', label: 'User Profiles', icon: Users },
  { href: '/settings', label: 'My Account', icon: Settings },
];
const CLERK_NAV = [
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/settings', label: 'My Account', icon: Settings },
];

export default function Sidebar({ role, name, full }: { role: 'owner' | 'admin' | 'clerk'; name: string; full: string }) {
  const path = usePathname();
  const router = useRouter();
  const nav = role === 'clerk' ? CLERK_NAV : ADMIN_NAV;

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col bg-zinc-900 text-zinc-300 lg:w-64">
      <div className="flex items-center gap-3 px-4 py-5 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Tatak Budz logo"
          className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
        <div className="hidden leading-tight lg:block">
          <div className="text-base font-extrabold">Tatak Budz</div>
          <div className="text-xs text-amber-400">Upholstery Works</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link key={href} href={href} title={label}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-amber-500 text-zinc-950' : 'hover:bg-zinc-800 hover:text-white'
              }`}>
              <Icon size={18} className="shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <div className="mb-3 hidden lg:block">
          <div className="truncate text-sm font-bold text-white">{name}</div>
          <div className="truncate text-xs text-zinc-400">{full}</div>
          <div className="mt-1.5"><RoleBadge role={role} /></div>
        </div>
        <button
          onClick={async () => { await logoutAction(); router.push('/'); router.refresh(); }}
          title="Sign out"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
          <LogOut size={16} /> <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
