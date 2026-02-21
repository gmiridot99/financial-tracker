'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, Calculator, LogOut, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/patrimonio', label: 'Patrimonio', icon: Wallet },
  { href: '/dashboard/simulator', label: 'Simulatore', icon: Calculator },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard' ||
      /^\/dashboard\/\d{4}(\/|$)/.test(pathname);
  }
  return pathname.startsWith(href);
}

export default function DesktopNavBar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-warmBg-secondary/95 backdrop-blur-md border-b border-warmBg-tertiary/50">
      <div className="flex justify-between items-center h-14 max-w-6xl mx-auto px-6">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-warmAccent-primary to-warmData-investment flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-warmText-primary tracking-tight group-hover:text-warmAccent-primary transition-colors">
            FinTracker
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'text-warmAccent-primary bg-warmAccent-primary/10'
                    : 'text-warmText-secondary hover:text-warmText-primary hover:bg-warmBg-tertiary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-warmBg-tertiary mx-1" />

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-warmText-tertiary hover:text-warmData-expense hover:bg-warmData-expense/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Esci
          </button>
        </div>
      </div>
    </nav>
  );
}
