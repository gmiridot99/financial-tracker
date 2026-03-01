'use client';

import { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const transactionSchema = z.object({
  amount: z.string().min(1, 'Importo richiesto').refine((val) => {
    const num = parseFloat(val.replace(',', '.'));
    return !isNaN(num) && num > 0;
  }, 'Importo deve essere maggiore di 0'),
  category: z.string().uuid('Seleziona una categoria'),
  date: z.string().min(1, 'Data richiesta'),
  description: z.string().optional(),
  is_recurring: z.boolean(),
  frequency: z.enum(['monthly', 'annual', 'one-time']).optional(),
}).refine((data) => {
  if (data.is_recurring && (!data.frequency || data.frequency === 'one-time')) {
    return false;
  }
  return true;
}, {
  message: 'Seleziona una frequenza per le transazioni ricorrenti',
  path: ['frequency'],
});

type TransactionFormData = {
  amount: string;
  category: string;
  date: string;
  description: string;
  is_recurring: boolean;
  frequency: 'monthly' | 'annual' | 'one-time' | '';
};

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
  is_primary: boolean;
}

interface InlineIncomeFormProps {
  onSuccess: (savedDate: string) => void;
  defaultDate?: string;
}

export default function InlineIncomeForm({ onSuccess, defaultDate }: InlineIncomeFormProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState<TransactionFormData>({
    amount: '',
    category: '',
    date: defaultDate || new Date().toISOString().split('T')[0],
    description: '',
    is_recurring: false,
    frequency: 'one-time',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({});

  useEffect(() => {
    if (defaultDate) {
      setFormData(prev => ({ ...prev, date: defaultDate }));
    }
  }, [defaultDate]);

  useEffect(() => {
    loadCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load savings accounts and preselect primary when form expands
  useEffect(() => {
    if (isExpanded && user) {
      loadSavingsAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, user]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, type')
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .eq('type', 'income')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Errore nel caricamento delle categorie');
    }
  };

  const loadSavingsAccounts = async () => {
    const { data } = await supabase
      .from('savings_accounts')
      .select('id, name, balance, is_primary')
      .eq('user_id', user!.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });

    const accounts = data || [];
    setSavingsAccounts(accounts);
    const primary = accounts.find(a => a.is_primary);
    if (primary) setSelectedAccountId(primary.id);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name as keyof TransactionFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validated = transactionSchema.parse(formData);

      if (!user) {
        throw new Error('Utente non autenticato');
      }

      const toAccount = savingsAccounts.find(a => a.id === selectedAccountId);
      if (!toAccount) {
        toast.error('Seleziona un conto dove accreditare l\'entrata');
        setIsLoading(false);
        return;
      }

      const amount = parseFloat(validated.amount.replace(',', '.'));

      // Step 1: INSERT transaction with to_savings_account_id
      // Manually created transactions are immediately active — only auto-imported recurring ones are 'pending'
      const { data: insertedTx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'income',
          amount,
          currency: 'EUR',
          category: validated.category,
          is_recurring: validated.is_recurring,
          frequency: validated.is_recurring ? (validated.frequency || 'monthly') : 'one-time',
          start_date: validated.date,
          description: validated.description || null,
          to_savings_account_id: selectedAccountId,
          status: 'active',
        })
        .select('id')
        .single();

      if (txError || !insertedTx) {
        toast.error('Errore durante il salvataggio');
        setIsLoading(false);
        return;
      }

      const originalBalance = toAccount.balance;
      const newBalance = Math.round((originalBalance + amount) * 100) / 100;

      // Step 2: increment savings account balance
      const { error: balanceError } = await supabase
        .from('savings_accounts')
        .update({ balance: newBalance })
        .eq('id', selectedAccountId)
        .eq('user_id', user.id);

      if (balanceError) {
        // Rollback: delete the inserted transaction
        const { error: rollbackError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', insertedTx.id)
          .eq('user_id', user.id);

        if (rollbackError) {
          toast.error('ERRORE CRITICO: transazione non sincronizzata. Contatta il supporto.');
        } else {
          toast.error('Errore durante il salvataggio. Transazione annullata.');
        }
        setIsLoading(false);
        return;
      }

      toast.success('Entrata aggiunta!');
      onSuccess(validated.date);

      // Reset form
      setFormData({
        amount: '',
        category: '',
        date: defaultDate || new Date().toISOString().split('T')[0],
        description: '',
        is_recurring: false,
        frequency: 'one-time',
      });
      setIsExpanded(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof TransactionFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof TransactionFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('Error saving transaction:', error);
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
        className="w-full h-[52px] bg-warmData-income bg-opacity-10 rounded-2xl border border-dashed border-warmData-income border-opacity-30 px-4 flex items-center justify-between hover:bg-opacity-20 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-warmData-income" />
          <span className="text-sm font-normal text-warmData-income group-hover:opacity-80 transition-colors">
            Aggiungi un&apos;entrata...
          </span>
        </div>
        <span className="text-xs font-medium text-warmData-income">EUR</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-warmData-income bg-opacity-10 rounded-2xl border border-warmData-income border-opacity-30 p-4 animate-cardEnter"
    >
      <div className="space-y-3">
        {/* Amount and Category Row */}
        <div className="grid grid-cols-2 gap-2">
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="12,50"
            value={formData.amount}
            onChange={handleChange}
            className="col-span-1 h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmData-income placeholder:text-warmText-disabled"
          />

          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="col-span-1 h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmData-income"
          >
            <option value="">Categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Account chip selector */}
        {savingsAccounts.length > 0 && (
          <div>
            <p className="text-xs text-warmText-tertiary mb-1.5">Al conto</p>
            <div className="flex flex-wrap gap-1.5">
              {savingsAccounts.map(account => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedAccountId === account.id
                      ? 'bg-warmData-income text-white'
                      : 'bg-warmBg-primary text-warmText-secondary border border-warmText-muted hover:border-warmData-income hover:text-warmData-income'
                  }`}
                >
                  {account.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <input
          name="description"
          type="text"
          placeholder="Descrizione (opzionale)"
          value={formData.description}
          onChange={handleChange}
          className="w-full h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmData-income placeholder:text-warmText-disabled"
        />

        {/* Date */}
        <input
          name="date"
          type="date"
          value={formData.date}
          onChange={handleChange}
          className="w-full h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmData-income"
        />

        {/* Recurring Options */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="is_recurring"
              checked={!formData.is_recurring}
              onChange={() => setFormData(prev => ({ ...prev, is_recurring: false, frequency: 'one-time' }))}
              className="w-4 h-4 text-warmData-income border-warmText-muted focus:ring-warmData-income"
            />
            <span className="text-sm text-warmText-secondary">Una tantum</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="is_recurring"
              checked={formData.is_recurring}
              onChange={() => setFormData(prev => ({ ...prev, is_recurring: true, frequency: 'monthly' }))}
              className="w-4 h-4 text-warmData-income border-warmText-muted focus:ring-warmData-income"
            />
            <span className="text-sm text-warmText-secondary">Ricorrente</span>
          </label>

          {formData.is_recurring && (
            <select
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              className="h-9 px-3 bg-warmBg-primary rounded-lg border border-warmText-muted text-warmText-primary text-base md:text-xs focus:outline-none focus:border-warmData-income"
            >
              <option value="monthly">Ogni mese</option>
              <option value="annual">Ogni anno</option>
            </select>
          )}
        </div>

        {/* Errors */}
        {Object.values(errors).filter(Boolean).length > 0 && (
          <div className="text-xs text-warmData-expense">
            {Object.values(errors).filter(Boolean).join(', ')}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            type="button"
            onClick={() => {
              setIsExpanded(false);
              setErrors({});
            }}
            className="h-11 px-6 text-sm font-medium text-warmText-tertiary hover:text-warmText-secondary rounded-full transition-colors active:scale-95"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-11 px-8 bg-warmData-income text-warmBg-primary rounded-full text-sm font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </form>
  );
}
