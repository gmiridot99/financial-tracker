'use client';

import { usePathname } from 'next/navigation';
import MobileNavBar from './MobileNavBar';
import DesktopNavBar from './DesktopNavBar';

/** Routes where the navigation should NOT appear */
const AUTH_ROUTES = ['/login', '/register', '/'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNavBar = !AUTH_ROUTES.includes(pathname);

  return (
    <>
      {/* Desktop top navigation */}
      {showNavBar && <DesktopNavBar />}

      {/* Main content area - bottom padding mobile (navbar), top padding desktop (top bar) */}
      <main className={showNavBar ? 'pb-20 md:pb-0 md:pt-14' : ''}>
        {children}
      </main>

      {/* Mobile bottom navigation */}
      {showNavBar && <MobileNavBar />}
    </>
  );
}
