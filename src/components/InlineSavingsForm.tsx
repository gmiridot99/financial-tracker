'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlusCircle } from 'lucide-react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const savingsSchema = z.object({
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
  message: 'Seleziona una frequenza per i risparmi ricorrenti',
  path: ['frequency'],
});

interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
}

interface InlineSavingsFormProps {
  onSuccess: () => void;
  defaultDate: string;
}

export default function InlineSavingsForm({ onSuccess, defaultDate }: InlineSavingsFormProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'annual' | 'one-time'>('one-time');
  const [error, setError] = useState('');
  const [selectedSavingsAccountId, setSelectedSavingsAccountId] = useState('');
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);

  const loadSavingsAccounts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('savings_accounts')
      .select('id, name, balance')
      .eq('user_id', user.id)
      .eq('is_primary', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setSavingsAccounts(data || []);
  }, [user]);

  useEffect(() => {
    if (isExpanded) {
      loadSavingsAccounts();
    }
  }, [isExpanded, loadSavingsAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const validated = savingsSchema.parse({
        amount,
        description,
        is_recurring: isRecurring,
        frequency: isRecurring ? frequency : 'one-time',
      });

      if (!user) {
        throw new Error('Utente non autenticato');
      }

      if (!selectedSavingsAccountId) {
        setError('Seleziona un conto destinazione');
        setIsLoading(false);
        return;
      }

      const amountNum = parseFloat(validated.amount.replace(',', '.'));

      // Get or create the "Risparmi" expense category
      let savingsCategoryId: string;

      const { data: existingCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('name', 'Risparmi')
        .eq('type', 'expense')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .single();

      if (existingCategory) {
        savingsCategoryId = existingCategory.id;
      } else {
        const { data: newCategory, error: catError } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: 'Risparmi',
            type: 'expense',
          })
          .select('id')
          .single();

        if (catError) throw catError;
        savingsCategoryId = newCategory.id;
      }

      // Find target account and its original balance
      const targetAccount = savingsAccounts.find(a => a.id === selectedSavingsAccountId);
      const originalBalance = Number(targetAccount?.balance ?? 0);

      // Step 1: Update balance of destination savings account
      const { error: step1Error } = await supabase
        .from('savings_accounts')
        .update({ balance: Math.round((originalBalance + amountNum) * 100) / 100 })
        .eq('id', selectedSavingsAccountId)
        .eq('user_id', user.id);

      if (step1Error) {
        toast.error('Errore nel deposito sul conto risparmio');
        setIsLoading(false);
        return;
      }

      // Step 2: Insert transaction with savings_account_id
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'expense',
          amount: amountNum,
          currency: 'EUR',
          category: savingsCategoryId,
          is_recurring: validated.is_recurring,
          frequency: validated.is_recurring ? validated.frequency : 'one-time',
          start_date: defaultDate,
          description: validated.description || 'Risparmio',
          savings_account_id: selectedSavingsAccountId,
          trigger_pac: false,
        });

      if (transactionError) {
        // ROLLBACK Step 1
        const { error: rollbackError } = await supabase
          .from('savings_accounts')
          .update({ balance: originalBalance })
          .eq('id', selectedSavingsAccountId)
          .eq('user_id', user.id);

        if (rollbackError) {
          toast.error('ERRORE CRITICO: saldo non sincronizzato. Contatta il supporto.');
        } else {
          toast.error('Errore nel salvataggio. Saldo ripristinato.');
        }
        setIsLoading(false);
        return;
      }

      toast.success('Risparmio registrato!');
      onSuccess();

      // Reset form
      setAmount('');
      setDescription('');
      setIsRecurring(false);
      setFrequency('one-time');
      setSelectedSavingsAccountId('');
      setIsExpanded(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        console.error('Error saving savings transaction:', err);
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
        className="w-full h-[52px] bg-warmData-savings bg-opacity-10 rounded-2xl border border-dashed border-warmData-savings px-4 flex items-center justify-between hover:bg-warmData-savings hover:bg-opacity-20 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-warmData-savings" />
          <span className="text-sm font-normal text-warmData-savings">
            Registra risparmio...
          </span>
        </div>
        <span className="text-xs font-medium text-warmData-savings">EUR</span>
      </button>
    );
  }

  const noAccounts = savingsAccounts.length === 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-warmData-savings bg-opacity-10 rounded-2xl border border-warmData-savings p-4 animate-cardEnter"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            name="amount"
            type="text"
            placeholder="200,00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            className="h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-savings placeholder:text-warmText-disabled"
          />

          <input
            name="description"
            type="text"
            placeholder="Fondo vacanze, ecc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-savings placeholder:text-warmText-disabled"
          />
        </div>

        {/* Conto destinazione */}
        <div>
          <label className="block text-xs font-medium text-warmText-tertiary mb-1">
            Conto destinazione *
          </label>
          {noAccounts ? (
            <div className="h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted flex items-center justify-between">
              <span className="text-sm text-warmText-disabled">Nessun conto risparmio</span>
              <Link
                href="/dashboard/patrimonio"
                className="text-xs text-warmAccent-primary hover:text-warmAccent-hover font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                Crea in Patrimonio →
              </Link>
            </div>
          ) : (
            <select
              value={selectedSavingsAccountId}
              onChange={(e) => {
                setSelectedSavingsAccountId(e.target.value);
                setError('');
              }}
              className="w-full h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-savings appearance-none"
            >
              <option value="">Seleziona conto...</option>
              {savingsAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Recurring Options */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="is_recurring_sav"
              checked={!isRecurring}
              onChange={() => {
                setIsRecurring(false);
                setFrequency('one-time');
              }}
              className="w-4 h-4 text-warmData-savings border-warmText-muted focus:ring-warmData-savings"
            />
            <span className="text-sm text-warmText-secondary">Una tantum</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="is_recurring_sav"
              checked={isRecurring}
              onChange={() => {
                setIsRecurring(true);
                setFrequency('monthly');
              }}
              className="w-4 h-4 text-warmData-savings border-warmText-muted focus:ring-warmData-savings"
            />
            <span className="text-sm text-warmText-secondary">Ricorrente</span>
          </label>

          {isRecurring && (
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'monthly' | 'annual')}
              className="h-9 px-3 bg-warmBg-primary rounded-lg border border-warmText-muted text-warmText-primary text-xs focus:outline-none focus:border-warmData-savings"
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
            disabled={isLoading || noAccounts || !selectedSavingsAccountId}
            className="h-11 px-8 bg-warmData-savings text-warmBg-primary rounded-full text-sm font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Salvataggio...' : 'Registra Risparmio'}
          </button>
        </div>
      </div>
    </form>
  );
}
