'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, PiggyBank, Target } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-warmBg-primary">
        <p className="text-lg text-warmText-secondary">Caricamento...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-warmBg-primary">
      <div className="max-w-2xl w-full text-center">
        {/* Logo/Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-warmAccent-primary rounded-2xl mb-6">
          <TrendingUp className="w-10 h-10 text-warmBg-primary" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-5xl font-bold text-warmText-primary mb-4">
          Financial Life Planner
        </h1>
        <p className="text-lg text-warmText-tertiary mb-8 md:mb-12">
          Gestisci le tue finanze con colori caldi e interfaccia user-friendly
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link
            href="/login"
            className="px-8 py-4 bg-warmAccent-primary text-warmBg-primary font-semibold rounded-xl hover:bg-warmAccent-hover transition-colors"
          >
            Accedi
          </Link>
          <Link
            href="/register"
            className="px-8 py-4 bg-warmBg-secondary text-warmText-primary font-semibold rounded-xl border-2 border-warmAccent-primary hover:bg-warmBg-tertiary transition-colors"
          >
            Registrati
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-warmBg-secondary rounded-2xl p-6">
            <div className="w-12 h-12 bg-warmData-income bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <PiggyBank className="w-6 h-6 text-warmData-income" />
            </div>
            <h3 className="text-warmText-primary font-semibold mb-2">Risparmio Automatico</h3>
            <p className="text-sm text-warmText-tertiary">
              Configura percentuali per risparmi e investimenti
            </p>
          </div>

          <div className="bg-warmBg-secondary rounded-2xl p-6">
            <div className="w-12 h-12 bg-warmData-recurring bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Target className="w-6 h-6 text-warmData-recurring" />
            </div>
            <h3 className="text-warmText-primary font-semibold mb-2">Transazioni Ricorrenti</h3>
            <p className="text-sm text-warmText-tertiary">
              Inserisci una volta, si ripetono automaticamente
            </p>
          </div>

          <div className="bg-warmBg-secondary rounded-2xl p-6">
            <div className="w-12 h-12 bg-warmData-investment bg-opacity-10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-warmData-investment" />
            </div>
            <h3 className="text-warmText-primary font-semibold mb-2">Visualizzazione Chiara</h3>
            <p className="text-sm text-warmText-tertiary">
              Tutto a portata di sguardo con grafici intuitivi
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
