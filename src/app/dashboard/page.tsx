'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user) {
      // Redirect to current month
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      router.push(`/dashboard/${year}/${month}`);
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-warmBg-primary flex items-center justify-center">
      <p className="text-lg text-warmText-secondary">Caricamento...</p>
    </div>
  );
}
