'use client';

import { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { upsertWealthSnapshot } from '@/lib/wealth';

interface WealthSetupBannerProps {
  userId: string;
  year: number;
  month: number;
  onSetupComplete: () => void;
}

export default function WealthSetupBanner({ userId, year, month, onSetupComplete }: WealthSetupBannerProps) {
  const [hasSnapshot, setHasSnapshot] = useState<boolean | null>(null);
  const [investmentsInput, setInvestmentsInput] = useState('');
  const [savingsInput, setSavingsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase
        .from('wealth_snapshots')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (!error) {
        setHasSnapshot(data && data.length > 0);
      }
    };
    check();
  }, [userId]);

  const handleSubmit = async () => {
    const investments = parseFloat(investmentsInput.replace(',', '.') || '0');
    const savings = parseFloat(savingsInput.replace(',', '.') || '0');

    if (isNaN(investments) || investments < 0 || isNaN(savings) || savings < 0) {
      toast.error('Inserisci importi validi (>= 0)');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await upsertWealthSnapshot(userId, year, month, investments, savings);
      if (success) {
        toast.success('Patrimonio iniziale impostato!');
        setHasSnapshot(true);
        onSetupComplete();
      } else {
        toast.error('Errore nel salvataggio');
      }
    } catch {
      toast.error('Errore nel salvataggio');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasSnapshot === null || hasSnapshot === true) return null;

  return (
    <div className="mx-1 mt-3 p-3 bg-warmAccent-primary bg-opacity-10 border border-warmAccent-primary border-opacity-30 rounded-xl animate-cardEnter">
      <div className="flex items-start gap-2 mb-3">
        <Wallet className="w-4 h-4 text-warmAccent-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-warmText-secondary leading-relaxed">
          Imposta quanto hai attualmente in <strong className="text-warmData-investment">investimenti</strong> e <strong className="text-warmData-savings">risparmi</strong>
        </p>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs leading-tight text-warmData-investment font-medium mb-0.5 block">Investimenti</label>
          <input
            type="text"
            inputMode="decimal"
            value={investmentsInput}
            onChange={(e) => setInvestmentsInput(e.target.value)}
            placeholder="0,00"
            className="w-full h-9 bg-warmBg-tertiary rounded-lg px-2 text-warmText-primary text-xs focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs leading-tight text-warmData-savings font-medium mb-0.5 block">Risparmi</label>
          <input
            type="text"
            inputMode="decimal"
            value={savingsInput}
            onChange={(e) => setSavingsInput(e.target.value)}
            placeholder="0,00"
            className="w-full h-9 bg-warmBg-tertiary rounded-lg px-2 text-warmText-primary text-xs focus:outline-none focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-50"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-9 px-4 bg-warmAccent-primary text-white rounded-lg text-xs font-semibold hover:bg-warmAccent-hover transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {isSubmitting ? '...' : 'Salva'}
        </button>
      </div>
    </div>
  );
}
