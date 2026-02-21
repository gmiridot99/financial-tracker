'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/hooks/useInvestmentAccounts';

const EXCLUDED_EXPENSE_CATEGORIES = ['Investimenti', 'Risparmi'];

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

interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
  is_primary: boolean;
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
    from_savings_account_id?: string | null;
    to_savings_account_id?: string | null;
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
    date: new Date().toISOString().split('T')[0],
    description: '',
    is_recurring: false,
    frequency: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({});

  // Savings accounts for chip selectors
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [selectedFromAccountId, setSelectedFromAccountId] = useState(''); // for expense
  const [selectedToAccountId, setSelectedToAccountId] = useState('');     // for income

  const loadSavingsAccounts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('savings_accounts')
      .select('id, name, balance, is_primary')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });

    const accounts = data || [];
    setSavingsAccounts(accounts);
    const primary = accounts.find(a => a.is_primary);
    if (primary) {
      setSelectedFromAccountId(primary.id);
      setSelectedToAccountId(primary.id);
    }
  }, [user]);

  // Load categories and savings accounts when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadSavingsAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reload categories when type changes
  useEffect(() => {
    if (formData.type) {
      loadCategories();
      setFormData(prev => ({ ...prev, category: '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.type]);

  // Pre-fill form when editing
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
      if (transaction.from_savings_account_id) {
        setSelectedFromAccountId(transaction.from_savings_account_id);
      }
      if (transaction.to_savings_account_id) {
        setSelectedToAccountId(transaction.to_savings_account_id);
      }
    } else if (!transaction && isOpen) {
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

      // Filter out Investimenti and Risparmi for expenses (now handled by TransferForm)
      const filtered = (data || []).filter(c => {
        if (c.type === 'expense') {
          return !EXCLUDED_EXPENSE_CATEGORIES.includes(c.name);
        }
        return true;
      });

      setCategories(filtered);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Errore nel caricamento delle categorie');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

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
      const validated = transactionSchema.parse(formData);

      if (!user) throw new Error('Utente non autenticato');

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

      const resetAndClose = () => {
        onSuccess();
        onClose();
        setFormData({
          type: '',
          amount: '',
          category: '',
          date: new Date().toISOString().split('T')[0],
          description: '',
          is_recurring: false,
          frequency: '',
        });
      };

      // Edit mode: just update transaction fields, no balance change
      if (transaction) {
        const { error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transaction.id)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Transazione aggiornata con successo!');
        resetAndClose();
        return;
      }

      // New expense: balance check → decrement → INSERT with from_savings_account_id
      if (validated.type === 'expense') {
        const fromAccount = savingsAccounts.find(a => a.id === selectedFromAccountId);
        if (!fromAccount) {
          toast.error('Seleziona un conto da cui addebitare la spesa');
          setIsLoading(false);
          return;
        }

        if (fromAccount.balance < amount) {
          toast.error(
            `Saldo insufficiente su ${fromAccount.name} (disponibile: ${formatCurrency(fromAccount.balance)}, richiesti: ${formatCurrency(amount)})`
          );
          setIsLoading(false);
          return;
        }

        const originalBalance = fromAccount.balance;
        const newBalance = Math.round((originalBalance - amount) * 100) / 100;

        // Step 1: decrement balance
        const { error: balanceError } = await supabase
          .from('savings_accounts')
          .update({ balance: newBalance })
          .eq('id', selectedFromAccountId)
          .eq('user_id', user.id);

        if (balanceError) {
          toast.error("Errore nell'aggiornamento del saldo del conto");
          setIsLoading(false);
          return;
        }

        // Step 2: INSERT transaction with from_savings_account_id
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            ...transactionData,
            from_savings_account_id: selectedFromAccountId,
          });

        if (txError) {
          // Rollback step 1
          const { error: rollbackError } = await supabase
            .from('savings_accounts')
            .update({ balance: originalBalance })
            .eq('id', selectedFromAccountId)
            .eq('user_id', user.id);

          if (rollbackError) {
            toast.error('ERRORE CRITICO: saldo non sincronizzato. Contatta il supporto.');
          } else {
            toast.error('Errore durante il salvataggio. Saldo ripristinato.');
          }
          setIsLoading(false);
          return;
        }

        toast.success('Spesa aggiunta!');
        resetAndClose();
        return;
      }

      // New income: INSERT with to_savings_account_id → increment balance
      if (validated.type === 'income') {
        const toAccount = savingsAccounts.find(a => a.id === selectedToAccountId);
        if (!toAccount) {
          toast.error("Seleziona un conto dove accreditare l'entrata");
          setIsLoading(false);
          return;
        }

        // Step 1: INSERT transaction with to_savings_account_id
        const { data: insertedTx, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            ...transactionData,
            to_savings_account_id: selectedToAccountId,
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

        // Step 2: increment balance
        const { error: balanceError } = await supabase
          .from('savings_accounts')
          .update({ balance: newBalance })
          .eq('id', selectedToAccountId)
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
        resetAndClose();
        return;
      }

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

    let deleteAllFuture = false;

    if (transaction.is_recurring) {
      const choice = window.confirm(
        'Questa è una transazione ricorrente.\n\n' +
        'OK = Elimina solo questa occorrenza\n' +
        'Annulla = Torna indietro\n\n' +
        'Vuoi eliminare solo questa occorrenza?'
      );

      if (choice === false) {
        return;
      }

      const deleteAll = window.confirm(
        'Vuoi eliminare anche tutte le occorrenze future di questa transazione ricorrente?'
      );

      deleteAllFuture = deleteAll;
    } else {
      const confirmed = window.confirm('Sei sicuro di voler eliminare questa transazione?');
      if (!confirmed) return;
    }

    setIsLoading(true);
    try {
      if (deleteAllFuture && transaction.is_recurring) {
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
      toast.error("Errore durante l'eliminazione");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
      <div className="bg-warmBg-secondary w-full h-full overflow-y-auto sm:h-auto sm:max-w-md sm:max-h-[90vh] sm:rounded-2xl sm:shadow-2xl animate-sheetSlideUp sm:animate-none">
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
              inputMode="decimal"
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

          {/* "Dal conto" chip selector for expense */}
          {formData.type === 'expense' && !transaction && savingsAccounts.length > 0 && (
            <div>
              <p className="text-sm font-medium text-warmText-secondary mb-2">Dal conto</p>
              <div className="flex flex-wrap gap-2">
                {savingsAccounts.map(account => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedFromAccountId(account.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedFromAccountId === account.id
                        ? 'bg-warmData-expense text-white'
                        : 'bg-warmBg-primary text-warmText-secondary border border-warmText-muted hover:border-warmData-expense hover:text-warmData-expense'
                    }`}
                  >
                    {account.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* "Al conto" chip selector for income */}
          {formData.type === 'income' && !transaction && savingsAccounts.length > 0 && (
            <div>
              <p className="text-sm font-medium text-warmText-secondary mb-2">Al conto</p>
              <div className="flex flex-wrap gap-2">
                {savingsAccounts.map(account => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedToAccountId(account.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedToAccountId === account.id
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

          {/* Frequency */}
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
