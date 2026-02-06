'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense'], { required_error: 'Seleziona un tipo' }),
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
  // If recurring, frequency must be monthly or annual
  if (data.is_recurring && (!data.frequency || data.frequency === 'one-time')) {
    return false;
  }
  return true;
}, {
  message: 'Seleziona una frequenza per le transazioni ricorrenti',
  path: ['frequency'],
});

type TransactionFormData = {
  type: 'income' | 'expense' | '';
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

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction?: {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    start_date: string;
    description: string | null;
    is_recurring: boolean;
    frequency: 'monthly' | 'annual' | 'one-time';
  } | null;
}

export default function TransactionModal({ isOpen, onClose, onSuccess, transaction }: TransactionModalProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<TransactionFormData>({
    type: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    description: '',
    is_recurring: false,
    frequency: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({});

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // Load categories filtered by selected type
  useEffect(() => {
    if (formData.type) {
      loadCategories();
      // Reset category if type changes
      setFormData(prev => ({ ...prev, category: '' }));
    }
  }, [formData.type]);

  // Pre-fill form when editing existing transaction
  useEffect(() => {
    if (transaction && isOpen) {
      setFormData({
        type: transaction.type,
        amount: transaction.amount.toString().replace('.', ','),
        category: transaction.category,
        date: transaction.start_date,
        description: transaction.description || '',
        is_recurring: transaction.is_recurring,
        frequency: transaction.frequency,
      });
    } else if (!transaction && isOpen) {
      // Reset to defaults when adding new transaction
      setFormData({
        type: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        is_recurring: false,
        frequency: '',
      });
    }
  }, [transaction, isOpen]);

  const loadCategories = async () => {
    try {
      let query = supabase
        .from('categories')
        .select('id, name, type')
        .or(`user_id.is.null,user_id.eq.${user?.id}`);

      if (formData.type) {
        query = query.eq('type', formData.type);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Errore nel caricamento delle categorie');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name as keyof TransactionFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const formatDateForDisplay = (isoDate: string): string => {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      // Validate form data
      const validated = transactionSchema.parse(formData);

      if (!user) {
        throw new Error('Utente non autenticato');
      }

      // Parse amount (replace comma with dot for decimal)
      const amount = parseFloat(validated.amount.replace(',', '.'));

      const transactionData = {
        type: validated.type,
        amount,
        currency: 'EUR',
        category: validated.category,
        is_recurring: validated.is_recurring,
        frequency: validated.is_recurring ? (validated.frequency || 'monthly') : 'one-time',
        start_date: validated.date,
        description: validated.description || null,
      };

      let error;

      if (transaction) {
        // Update existing transaction
        const result = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transaction.id)
          .eq('user_id', user.id);
        error = result.error;
      } else {
        // Insert new transaction
        const result = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            ...transactionData,
          });
        error = result.error;
      }

      if (error) throw error;

      toast.success(transaction ? 'Transazione aggiornata con successo!' : 'Transazione aggiunta con successo!');
      onSuccess();
      onClose();

      // Reset form
      setFormData({
        type: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        is_recurring: false,
        frequency: '',
      });
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

  const handleDelete = async () => {
    if (!transaction || !user) return;

    let confirmMessage = 'Sei sicuro di voler eliminare questa transazione?';
    let deleteAllFuture = false;

    if (transaction.is_recurring) {
      const choice = window.confirm(
        'Questa è una transazione ricorrente.\n\n' +
        'OK = Elimina solo questa occorrenza\n' +
        'Annulla = Torna indietro\n\n' +
        'Vuoi eliminare solo questa occorrenza?'
      );

      if (choice === false) {
        // User cancelled
        return;
      }

      // Ask if they want to delete all future occurrences
      const deleteAll = window.confirm(
        'Vuoi eliminare anche tutte le occorrenze future di questa transazione ricorrente?'
      );

      deleteAllFuture = deleteAll;
    } else {
      // Simple confirmation for one-time transactions
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }

    setIsLoading(true);
    try {
      if (deleteAllFuture && transaction.is_recurring) {
        // Delete all future occurrences (same category, amount, recurring)
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('user_id', user.id)
          .eq('type', transaction.type)
          .eq('amount', transaction.amount)
          .eq('category', transaction.category)
          .eq('is_recurring', true)
          .gte('start_date', transaction.start_date);

        if (error) throw error;
      } else {
        // Delete only this transaction
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', transaction.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast.success('Transazione eliminata con successo!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Errore durante l\'eliminazione');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-warmBg-secondary rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warmBg-tertiary">
          <h2 className="text-xl font-semibold text-warmText-primary">
            {transaction ? 'Modifica Transazione' : 'Nuova Transazione'}
          </h2>
          <button
            onClick={onClose}
            className="text-warmText-tertiary hover:text-warmText-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-warmText-secondary mb-1">
              Tipo *
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary focus:outline-none focus:border-warmAccent-primary"
            >
              <option value="">Seleziona tipo</option>
              <option value="income">Entrata</option>
              <option value="expense">Uscita</option>
            </select>
            {errors.type && <p className="mt-1 text-sm text-warmData-expense">{errors.type}</p>}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-warmText-secondary mb-1">
              Importo (€) *
            </label>
            <input
              id="amount"
              name="amount"
              type="text"
              placeholder="100,00"
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary placeholder:text-warmText-disabled focus:outline-none focus:border-warmAccent-primary"
            />
            {errors.amount && <p className="mt-1 text-sm text-warmData-expense">{errors.amount}</p>}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-warmText-secondary mb-1">
              Categoria *
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={!formData.type}
              className="w-full px-3 py-2 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary focus:outline-none focus:border-warmAccent-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {formData.type ? 'Seleziona categoria' : 'Seleziona prima il tipo'}
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-sm text-warmData-expense">{errors.category}</p>}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-warmText-secondary mb-1">
              Data *
            </label>
            <input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary focus:outline-none focus:border-warmAccent-primary"
            />
            <p className="mt-1 text-xs text-warmText-disabled">
              Formato visualizzazione: {formatDateForDisplay(formData.date || new Date().toISOString().split('T')[0])}
            </p>
            {errors.date && <p className="mt-1 text-sm text-warmData-expense">{errors.date}</p>}
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-2">
            <input
              id="is_recurring"
              name="is_recurring"
              type="checkbox"
              checked={formData.is_recurring}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  is_recurring: e.target.checked,
                  frequency: e.target.checked ? 'monthly' : '',
                }));
              }}
              className="w-4 h-4 text-warmAccent-primary border-warmText-muted rounded focus:ring-warmAccent-primary"
            />
            <label htmlFor="is_recurring" className="text-sm font-medium text-warmText-secondary">
              Transazione ricorrente
            </label>
          </div>

          {/* Frequency - shown only when is_recurring is true */}
          {formData.is_recurring && (
            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-warmText-secondary mb-1">
                Frequenza *
              </label>
              <select
                id="frequency"
                name="frequency"
                value={formData.frequency}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary focus:outline-none focus:border-warmAccent-primary"
              >
                <option value="">Seleziona frequenza</option>
                <option value="monthly">Mensile</option>
                <option value="annual">Annuale</option>
              </select>
              {errors.frequency && <p className="mt-1 text-sm text-warmData-expense">{errors.frequency}</p>}
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-warmText-secondary mb-1">
              Descrizione
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Note opzionali..."
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-warmBg-primary border border-warmText-muted rounded-xl text-warmText-primary placeholder:text-warmText-disabled focus:outline-none focus:border-warmAccent-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {transaction && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-warmData-expense text-warmText-primary font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Elimina
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-warmText-muted rounded-xl text-warmText-secondary font-medium hover:bg-warmBg-tertiary transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-warmAccent-primary text-warmBg-primary font-semibold rounded-xl hover:bg-warmAccent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
