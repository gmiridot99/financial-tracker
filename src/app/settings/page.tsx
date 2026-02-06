'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Sliders } from 'lucide-react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

const settingsSchema = z.object({
  savings_percentage: z.number().min(0).max(100),
  investments_percentage: z.number().min(0).max(100),
}).refine((data) => data.savings_percentage + data.investments_percentage === 100, {
  message: 'La somma delle percentuali deve essere 100',
});

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [savingsPercentage, setSavingsPercentage] = useState(40);
  const [investmentsPercentage, setInvestmentsPercentage] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      loadSettings();
    }
  }, [user, loading, router]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('savings_percentage, investments_percentage')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSavingsPercentage(data.savings_percentage);
        setInvestmentsPercentage(data.investments_percentage);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSavingsChange = (value: number) => {
    setSavingsPercentage(value);
    setInvestmentsPercentage(100 - value);
    setError('');
  };

  const handleInvestmentsChange = (value: number) => {
    setInvestmentsPercentage(value);
    setSavingsPercentage(100 - value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const validated = settingsSchema.parse({
        savings_percentage: savingsPercentage,
        investments_percentage: investmentsPercentage,
      });

      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          savings_percentage: validated.savings_percentage,
          investments_percentage: validated.investments_percentage,
          currency: 'EUR',
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('Impostazioni salvate!');
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0].message);
      } else {
        console.error('Error saving settings:', error);
        toast.error('Errore durante il salvataggio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-warmBg-primary flex items-center justify-center">
        <p className="text-lg text-warmText-secondary">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warmBg-primary">
      <header className="bg-warmBg-secondary border-b border-warmBg-tertiary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-warmText-tertiary hover:text-warmText-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Torna alla Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-warmAccent-primary rounded-xl flex items-center justify-center">
            <Sliders className="w-6 h-6 text-warmBg-primary" />
          </div>
          <h1 className="text-2xl font-bold text-warmText-primary">Impostazioni</h1>
        </div>

        <div className="bg-warmBg-secondary rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-warmText-primary mb-2">
                Ripartizione Netto Mensile
              </h2>
              <p className="text-sm text-warmText-tertiary mb-6">
                Configura come vuoi dividere il tuo netto mensile tra risparmi e investimenti.
              </p>

              <div className="space-y-6">
                {/* Savings */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label htmlFor="savings" className="text-sm font-medium text-warmText-secondary">
                      Risparmio
                    </label>
                    <span className="text-lg font-semibold text-warmData-savings">
                      {savingsPercentage}%
                    </span>
                  </div>
                  <input
                    id="savings"
                    type="range"
                    min="0"
                    max="100"
                    value={savingsPercentage}
                    onChange={(e) => handleSavingsChange(Number(e.target.value))}
                    className="w-full h-3 bg-warmBg-primary rounded-lg appearance-none cursor-pointer accent-warmData-savings"
                    style={{
                      background: `linear-gradient(to right, #4DB6AC 0%, #4DB6AC ${savingsPercentage}%, #2A2420 ${savingsPercentage}%, #2A2420 100%)`
                    }}
                  />
                </div>

                {/* Investments */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label htmlFor="investments" className="text-sm font-medium text-warmText-secondary">
                      Investimenti
                    </label>
                    <span className="text-lg font-semibold text-warmData-investment">
                      {investmentsPercentage}%
                    </span>
                  </div>
                  <input
                    id="investments"
                    type="range"
                    min="0"
                    max="100"
                    value={investmentsPercentage}
                    onChange={(e) => handleInvestmentsChange(Number(e.target.value))}
                    className="w-full h-3 bg-warmBg-primary rounded-lg appearance-none cursor-pointer accent-warmData-investment"
                    style={{
                      background: `linear-gradient(to right, #FFB74D 0%, #FFB74D ${investmentsPercentage}%, #2A2420 ${investmentsPercentage}%, #2A2420 100%)`
                    }}
                  />
                </div>

                {/* Summary */}
                <div className="bg-warmBg-primary rounded-xl p-4 border border-warmBg-tertiary">
                  <p className="text-sm text-warmText-secondary">
                    <span className="font-semibold text-warmText-primary">Riepilogo:</span>{' '}
                    {savingsPercentage}% Risparmio + {investmentsPercentage}% Investimenti = {savingsPercentage + investmentsPercentage}%
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-warmData-expense">{error}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-4 py-3 border border-warmText-muted rounded-xl text-warmText-secondary font-medium hover:bg-warmBg-tertiary transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-warmAccent-primary text-warmBg-primary font-semibold rounded-xl hover:bg-warmAccent-hover transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Salvataggio...' : 'Salva Impostazioni'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
