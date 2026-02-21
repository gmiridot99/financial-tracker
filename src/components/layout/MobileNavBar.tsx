'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Calculator } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/patrimonio', label: 'Patrimonio', icon: Wallet },
  { href: '/dashboard/simulator', label: 'Simulatore', icon: Calculator },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    // Active for /dashboard, /dashboard/2026/1, /dashboard/2026/recap, etc.
    // But NOT for /dashboard/patrimonio or /dashboard/simulator
    return pathname === '/dashboard' ||
      /^\/dashboard\/\d{4}(\/|$)/.test(pathname);
  }
  return pathname.startsWith(href);
}

export default function MobileNavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-warmBg-secondary border-t border-warmBg-tertiary md:hidden">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors ${
                active
                  ? 'text-warmAccent-primary'
                  : 'text-warmText-tertiary active:text-warmText-secondary'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-xs mt-1 leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area spacer for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
