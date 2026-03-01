'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTransfers } from '@/hooks/useTransfers';

interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
  is_primary: boolean;
}

interface InvestmentAccount {
  id: string;
  name: string;
  cash_balance: number;
}

interface TransferFormProps {
  onTransferAdded: () => void;
  defaultDate?: string;
}

// Prefix values in the "A" dropdown so we can tell savings vs investment apart
const SAVINGS_PREFIX = 's:';
const INVESTMENT_PREFIX = 'i:';

export default function TransferForm({ onTransferAdded, defaultDate }: TransferFormProps) {
  const { user } = useAuth();
  const { addTransfer } = useTransfers({ userId: user?.id ?? '' });

  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);

  const [fromAccountId, setFromAccountId] = useState('');
  const [destAccountKey, setDestAccountKey] = useState(''); // e.g. "s:uuid" or "i:uuid"
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [triggerPac, setTriggerPac] = useState(false);

  useEffect(() => {
    if (defaultDate) setDate(defaultDate);
  }, [defaultDate]);

  useEffect(() => {
    if (isExpanded && user) {
      loadAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, user]);

  const loadAccounts = async () => {
    const [savingsRes, investRes] = await Promise.all([
      supabase
        .from('savings_accounts')
        .select('id, name, balance, is_primary')
        .eq('user_id', user!.id)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true }),
      supabase
        .from('investment_accounts')
        .select('id, name, cash_balance')
        .eq('user_id', user!.id)
        .order('sort_order', { ascending: true }),
    ]);

    const savings = savingsRes.data || [];
    const investments = investRes.data || [];
    setSavingsAccounts(savings);
    setInvestmentAccounts(investments);

    // Preselect primary savings account as source
    const primary = savings.find(a => a.is_primary);
    if (primary) setFromAccountId(primary.id);

    // Preselect first non-primary savings as destination (if available)
    const firstNonPrimary = savings.find(a => !a.is_primary);
    if (firstNonPrimary) {
      setDestAccountKey(SAVINGS_PREFIX + firstNonPrimary.id);
    } else if (savings.length > 1) {
      // If all accounts are primary-eligible, pick second
      const second = savings[1];
      if (second) setDestAccountKey(SAVINGS_PREFIX + second.id);
    } else if (investments.length > 0) {
      setDestAccountKey(INVESTMENT_PREFIX + investments[0].id);
    }
  };

  const destIsInvestment = destAccountKey.startsWith(INVESTMENT_PREFIX);
  const destRawId = destAccountKey.slice(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) return;

    const amountNum = parseFloat(amount.replace(',', '.'));

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Importo deve essere maggiore di 0');
      return;
    }

    if (!fromAccountId) {
      setError('Seleziona il conto sorgente');
      return;
    }

    if (!destAccountKey) {
      setError('Seleziona il conto destinazione');
      return;
    }

    // Source and destination cannot be the same savings account
    if (!destIsInvestment && fromAccountId === destRawId) {
      setError('Il conto sorgente e destinazione non possono essere uguali');
      return;
    }

    setIsLoading(true);

    const success = await addTransfer({
      amount: amountNum,
      date,
      note: note || undefined,
      is_recurring: isRecurring,
      frequency: isRecurring ? frequency : undefined,
      trigger_pac: triggerPac && destIsInvestment,
      from_savings_account_id: fromAccountId,
      to_savings_account_id: destIsInvestment ? undefined : destRawId,
      to_investment_account_id: destIsInvestment ? destRawId : undefined,
    });

    setIsLoading(false);

    if (success) {
      // Reset form
      setAmount('');
      setNote('');
      setIsRecurring(false);
      setFrequency('monthly');
      setTriggerPac(false);
      setIsExpanded(false);
      onTransferAdded();
    }
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setError('');
    setAmount('');
    setNote('');
    setIsRecurring(false);
    setTriggerPac(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full h-[52px] bg-warmBg-tertiary rounded-2xl border border-dashed border-warmText-muted px-4 flex items-center justify-between hover:bg-warmBg-hover transition-colors group"
      >
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-warmText-tertiary" />
          <span className="text-sm font-normal text-warmText-tertiary group-hover:text-warmText-secondary transition-colors">
            Trasferisci tra conti...
          </span>
        </div>
        <span className="text-xs font-medium text-warmText-tertiary">EUR</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-warmBg-tertiary rounded-2xl border border-warmText-muted p-4 animate-cardEnter"
    >
      <div className="space-y-3">
        {/* From / To row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-warmText-tertiary mb-1">Da</p>
            <div className="relative">
              <select
                value={fromAccountId}
                onChange={e => {
                  setFromAccountId(e.target.value);
                  setError('');
                }}
                className="w-full h-11 px-3 pr-9 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmAccent-primary appearance-none"
              >
                <option value="">Seleziona...</option>
                {savingsAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmText-tertiary pointer-events-none" />
            </div>
          </div>

          <div>
            <p className="text-xs text-warmText-tertiary mb-1">A</p>
            <div className="relative">
              <select
                value={destAccountKey}
                onChange={e => {
                  setDestAccountKey(e.target.value);
                  setTriggerPac(false);
                  setError('');
                }}
                className="w-full h-11 px-3 pr-9 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmAccent-primary appearance-none"
              >
                <option value="">Seleziona...</option>
                {savingsAccounts.length > 0 && (
                  <optgroup label="Conti risparmio">
                    {savingsAccounts.map(acc => (
                      <option key={acc.id} value={SAVINGS_PREFIX + acc.id}>{acc.name}</option>
                    ))}
                  </optgroup>
                )}
                {investmentAccounts.length > 0 && (
                  <optgroup label="Conti investimento">
                    {investmentAccounts.map(acc => (
                      <option key={acc.id} value={INVESTMENT_PREFIX + acc.id}>{acc.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmText-tertiary pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Amount and Date row */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="200,00"
            value={amount}
            onChange={e => {
              setAmount(e.target.value);
              setError('');
            }}
            className="h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmAccent-primary placeholder:text-warmText-disabled"
          />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmAccent-primary"
          />
        </div>

        {/* Note */}
        <input
          type="text"
          placeholder="Nota (opzionale)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-base md:text-sm focus:outline-none focus:border-warmAccent-primary placeholder:text-warmText-disabled"
        />

        {/* Recurring toggle */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="transfer_recurring"
              checked={!isRecurring}
              onChange={() => setIsRecurring(false)}
              className="w-4 h-4 text-warmAccent-primary border-warmText-muted focus:ring-warmAccent-primary"
            />
            <span className="text-sm text-warmText-secondary">Una tantum</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="transfer_recurring"
              checked={isRecurring}
              onChange={() => setIsRecurring(true)}
              className="w-4 h-4 text-warmAccent-primary border-warmText-muted focus:ring-warmAccent-primary"
            />
            <span className="text-sm text-warmText-secondary">Ricorrente</span>
          </label>
          {isRecurring && (
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value as 'monthly' | 'weekly' | 'yearly')}
              className="h-9 px-3 bg-warmBg-primary rounded-lg border border-warmText-muted text-warmText-primary text-base md:text-xs focus:outline-none focus:border-warmAccent-primary"
            >
              <option value="monthly">Mensile</option>
              <option value="weekly">Settimanale</option>
              <option value="yearly">Annuale</option>
            </select>
          )}
        </div>

        {/* PAC toggle — only for investment destinations */}
        {destIsInvestment && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={triggerPac}
              onChange={e => setTriggerPac(e.target.checked)}
              className="w-4 h-4 text-warmData-investment border-warmText-muted rounded focus:ring-warmData-investment"
            />
            <span className="text-sm text-warmText-secondary">Esegui PAC dopo il trasferimento</span>
          </label>
        )}

        {error && (
          <div className="text-xs text-warmData-expense">{error}</div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            type="button"
            onClick={handleCancel}
            className="h-11 px-6 text-sm font-medium text-warmText-tertiary hover:text-warmText-secondary rounded-full transition-colors active:scale-95"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-11 px-8 bg-warmText-secondary text-warmBg-primary rounded-full text-sm font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Salvataggio...' : 'Trasferisci'}
          </button>
        </div>
      </div>
    </form>
  );
}
