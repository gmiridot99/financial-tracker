'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, X } from 'lucide-react';
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

interface InlineIncomeFormProps {
  onSuccess: () => void;
  defaultDate?: string;
}

export default function InlineIncomeForm({ onSuccess, defaultDate }: InlineIncomeFormProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
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
  }, [user]);

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

      const amount = parseFloat(validated.amount.replace(',', '.'));

      const transactionData = {
        user_id: user.id,
        type: 'income',
        amount,
        currency: 'EUR',
        category: validated.category,
        is_recurring: validated.is_recurring,
        frequency: validated.is_recurring ? (validated.frequency || 'monthly') : 'one-time',
        start_date: validated.date,
        description: validated.description || null,
      };

      const { error } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (error) throw error;

      toast.success('Entrata aggiunta!');
      onSuccess();

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
            Aggiungi un'entrata...
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
            placeholder="12,50"
            value={formData.amount}
            onChange={handleChange}
            className="col-span-1 h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-income placeholder:text-warmText-disabled"
          />

          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="col-span-1 h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-income"
          >
            <option value="">Categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <input
          name="description"
          type="text"
          placeholder="Descrizione (opzionale)"
          value={formData.description}
          onChange={handleChange}
          className="w-full h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:outline-none focus:border-warmData-income placeholder:text-warmText-disabled"
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
              className="h-9 px-3 bg-warmBg-primary rounded-lg border border-warmText-muted text-warmText-primary text-xs focus:outline-none focus:border-warmData-income"
            >
              <option value="monthly">Ogni mese</option>
              <option value="annual">Ogni anno</option>
            </select>
          )}
        </div>

        {/* Errors */}
        {Object.values(errors).filter(Boolean).length > 0 && (
          <div className="text-xs text-red-400">
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
