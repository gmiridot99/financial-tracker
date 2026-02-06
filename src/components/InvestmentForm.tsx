'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const investmentSchema = z.object({
  amount: z.string().min(1, 'Importo richiesto').refine((val) => {
    const num = parseFloat(val.replace(',', '.'));
    return !isNaN(num) && num > 0;
  }, 'Importo deve essere maggiore di 0'),
  description: z.string().optional(),
  is_recurring: z.boolean(),
  frequency: z.enum(['monthly', 'annual', 'one-time']).optional(),
}).refine((data) => {
  if (data.is_recurring && (!data.frequency || data.frequency === 'one-time')) {
    return false;
  }
  return true;
}, {
  message: 'Seleziona una frequenza per gli investimenti ricorrenti',
  path: ['frequency'],
});

interface InvestmentFormProps {
  onSuccess: () => void;
  defaultDate: string;
}

export default function InvestmentForm({ onSuccess, defaultDate }: InvestmentFormProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'annual' | 'one-time'>('one-time');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const validated = investmentSchema.parse({
        amount,
        description,
        is_recurring: isRecurring,
        frequency: isRecurring ? frequency : 'one-time',
      });

      if (!user) {
        throw new Error('Utente non autenticato');
      }

      const amountNum = parseFloat(validated.amount.replace(',', '.'));

      // Get or create the investment category
      let investmentCategoryId: string;

      const { data: existingCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('name', 'Investimenti')
        .eq('type', 'expense')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .single();

      if (existingCategory) {
        investmentCategoryId = existingCategory.id;
      } else {
        const { data: newCategory, error: catError } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: 'Investimenti',
            type: 'expense',
          })
          .select('id')
          .single();

        if (catError) throw catError;
        investmentCategoryId = newCategory.id;
      }

      // Create transaction as expense with investment category
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'expense',
          amount: amountNum,
          currency: 'EUR',
          category: investmentCategoryId,
          is_recurring: validated.is_recurring,
          frequency: validated.is_recurring ? validated.frequency : 'one-time',
          start_date: defaultDate,
          description: validated.description || 'Investimento',
        });

      if (error) throw error;

      toast.success('Investimento registrato!');
      onSuccess();

      // Reset form
      setAmount('');
      setDescription('');
      setIsRecurring(false);
      setFrequency('one-time');
      setIsExpanded(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0].message);
      } else {
        console.error('Error saving investment:', error);
        toast.error('Errore durante il salvataggio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full h-[52px] bg-warmData-investment bg-opacity-10 rounded-2xl border border-dashed border-warmData-investment px-4 flex items-center justify-between hover:bg-warmData-investment hover:bg-opacity-20 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-warmData-investment" />
          <span className="text-sm font-normal text-warmData-investment">
            Registra investimento...
          </span>
        </div>
        <span className="text-xs font-medium text-warmData-investment">EUR</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-warmData-investment bg-opacity-10 rounded-2xl border border-warmData-investment p-4 animate-cardEnter"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            name="amount"
            type="text"
            placeholder="500,00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            className="h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-investment placeholder:text-warmText-disabled"
          />

          <input
            name="description"
            type="text"
            placeholder="ETF, Azioni, ecc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-investment placeholder:text-warmText-disabled"
          />
        </div>

        {/* Recurring Options */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="is_recurring_inv"
              checked={!isRecurring}
              onChange={() => {
                setIsRecurring(false);
                setFrequency('one-time');
              }}
              className="w-4 h-4 text-warmData-investment border-warmText-muted focus:ring-warmData-investment"
            />
            <span className="text-sm text-warmText-secondary">Una tantum</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="is_recurring_inv"
              checked={isRecurring}
              onChange={() => {
                setIsRecurring(true);
                setFrequency('monthly');
              }}
              className="w-4 h-4 text-warmData-investment border-warmText-muted focus:ring-warmData-investment"
            />
            <span className="text-sm text-warmText-secondary">Ricorrente</span>
          </label>

          {isRecurring && (
            <select
              name="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'monthly' | 'annual')}
              className="h-9 px-3 bg-warmBg-primary rounded-lg border border-warmText-muted text-warmText-primary text-xs focus:outline-none focus:border-warmData-investment"
            >
              <option value="monthly">Ogni mese</option>
              <option value="annual">Ogni anno</option>
            </select>
          )}
        </div>

        {error && (
          <div className="text-xs text-warmData-expense">{error}</div>
        )}

        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            type="button"
            onClick={() => {
              setIsExpanded(false);
              setError('');
            }}
            className="h-11 px-6 text-sm font-medium text-warmText-tertiary hover:text-warmText-secondary rounded-full transition-colors active:scale-95"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-11 px-8 bg-warmData-investment text-warmBg-primary rounded-full text-sm font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Salvataggio...' : 'Registra Investimento'}
          </button>
        </div>
      </div>
    </form>
  );
}
