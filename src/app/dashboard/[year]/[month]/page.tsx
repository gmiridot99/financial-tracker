'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import TransactionModal from '@/components/TransactionModal';
import dynamic from 'next/dynamic';
const MonthlySpendingTrendChart = dynamic(() => import('@/components/MonthlySpendingTrendChart'), { ssr: false });
const MonthlyRecapChart = dynamic(() => import('@/components/MonthlyRecapChart'), { ssr: false });
import InlineIncomeForm from '@/components/InlineIncomeForm';
import InlineTransactionForm from '@/components/InlineTransactionForm';
import InvestmentForm from '@/components/InvestmentForm';
import TransferForm from '@/components/TransferForm';
import BulkDeleteActionBar from '@/components/BulkDeleteActionBar';
import TransactionGroup from '@/components/TransactionGroup';
import { supabase } from '@/lib/supabase';
import { useTransfers } from '@/hooks/useTransfers';
import { copyRecurringFromPreviousMonth } from '@/lib/recurring';
import { getValidDateForMonth } from '@/lib/dateUtils';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  category_name?: string;
  is_recurring: boolean;
  frequency: 'monthly' | 'annual' | 'one-time';
  start_date: string;
  description: string | null;
  investment_account_id?: string | null;
  savings_account_id?: string | null;
  from_savings_account_id?: string | null;
  to_savings_account_id?: string | null;
}

export default function MonthlyDashboardPage() {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false);
  // Bulk delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  const year = parseInt(params.year as string, 10);
  const month = parseInt(params.month as string, 10);

  // Transfers for current month
  const { transfers, loadTransfers, deleteTransfer } = useTransfers({ userId: user?.id ?? '' });

  // Account name lookups for Movimenti del mese display
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

  const loadAccountNames = useCallback(async () => {
    if (!user) return;
    const [savingsRes, investRes] = await Promise.all([
      supabase.from('savings_accounts').select('id, name').eq('user_id', user.id),
      supabase.from('investment_accounts').select('id, name').eq('user_id', user.id),
    ]);
    const map: Record<string, string> = {};
    for (const a of (savingsRes.data || [])) map[a.id] = a.name;
    for (const a of (investRes.data || [])) map[a.id] = a.name;
    setAccountNames(map);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Create date object for current month (using day 1)
  // Computed before guard clauses so hooks below can reference it
  const currentDate = new Date(year, month - 1, 1);
  const monthName = format(currentDate, 'MMMM yyyy', { locale: it });

  // Load transactions for current month
  const loadTransactions = async () => {
    if (!user) return;

    setIsLoadingTransactions(true);
    try {
      // REMOVED: automatic generation of recurring transactions
      // Load only existing transactions

      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          type,
          amount,
          currency,
          category,
          is_recurring,
          frequency,
          start_date,
          description,
          investment_account_id,
          savings_account_id,
          from_savings_account_id,
          to_savings_account_id,
          categories (name)
        `)
        .eq('user_id', user.id)
        .gte('start_date', monthStart.toISOString().split('T')[0])
        .lte('start_date', monthEnd.toISOString().split('T')[0])
        .order('start_date', { ascending: true });

      if (error) throw error;

      // Map categories name
      const transactionsWithCategory = (data || []).map((t: any) => ({
        ...t,
        category_name: t.categories?.name || 'Senza categoria',
      }));

      setTransactions(transactionsWithCategory);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Load transactions and transfers when month changes
  useEffect(() => {
    if (user && !isNaN(year) && !isNaN(month)) {
      // Clear selection when navigating months
      setSelectionMode(false);
      setSelectedIds(new Set());

      loadTransactions();
      loadTransfers(year, month);
      loadAccountNames();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, year, month]);

  // Single-pass categorization + totals
  // Legacy transactions with investment_account_id or savings_account_id are shown
  // in their groups for backward compatibility but excluded from P&L totals.
  const { groups, totals } = useMemo(() => {
    const g = {
      investments: [] as Transaction[],
      recurringIncome: [] as Transaction[],
      oneTimeIncome: [] as Transaction[],
      recurringExpenses: [] as Transaction[],
      oneTimeExpenses: [] as Transaction[],
    };
    const t = { investments: 0, recurringIncome: 0, oneTimeIncome: 0, recurringExpenses: 0, oneTimeExpenses: 0 };

    for (const tx of transactions) {
      // Old-style account-routed transactions: display them but exclude from P&L totals
      const excludeFromPnL = !!(tx.investment_account_id || tx.savings_account_id);

      if (tx.category_name === 'Investimenti') {
        g.investments.push(tx);
        if (!excludeFromPnL) t.investments += tx.amount;
      } else if (tx.type === 'income') {
        if (tx.is_recurring) {
          g.recurringIncome.push(tx);
          if (!excludeFromPnL) t.recurringIncome += tx.amount;
        } else {
          g.oneTimeIncome.push(tx);
          if (!excludeFromPnL) t.oneTimeIncome += tx.amount;
        }
      } else {
        if (tx.is_recurring) {
          g.recurringExpenses.push(tx);
          if (!excludeFromPnL) t.recurringExpenses += tx.amount;
        } else {
          g.oneTimeExpenses.push(tx);
          if (!excludeFromPnL) t.oneTimeExpenses += tx.amount;
        }
      }
    }

    return { groups: g, totals: t };
  }, [transactions]);

  // Navigation functions
  const goToPreviousMonth = useCallback(() => {
    const prevMonth = subMonths(currentDate, 1);
    const newYear = prevMonth.getFullYear();
    const newMonth = prevMonth.getMonth() + 1;
    router.push(`/dashboard/${newYear}/${String(newMonth).padStart(2, '0')}`);
  }, [currentDate, router]);

  const goToNextMonth = useCallback(() => {
    const nextMonth = addMonths(currentDate, 1);
    const newYear = nextMonth.getFullYear();
    const newMonth = nextMonth.getMonth() + 1;
    router.push(`/dashboard/${newYear}/${String(newMonth).padStart(2, '0')}`);
  }, [currentDate, router]);

  // --- Swipe to navigate months (mobile only) ---
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Only trigger if horizontal movement dominates and exceeds threshold
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && elapsed < 500) {
      if (deltaX < 0) {
        goToNextMonth();
      } else {
        goToPreviousMonth();
      }
    }
  }, [goToPreviousMonth, goToNextMonth]);

  // --- Pull-to-refresh (mobile only) ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartRef = useRef<number | null>(null);

  const handlePullStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      pullStartRef.current = e.touches[0].clientY;
    }
  }, []);

  const handlePullMove = useCallback((e: TouchEvent) => {
    if (pullStartRef.current === null || isRefreshing) return;
    const delta = e.touches[0].clientY - pullStartRef.current;
    if (delta > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(delta * 0.4, 80));
    }
  }, [isRefreshing]);

  const handlePullEnd = useCallback(async () => {
    if (pullDistance > 60 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(0);
      await loadTransactions();
      setIsRefreshing(false);
      toast.success('Aggiornato!');
    } else {
      setPullDistance(0);
    }
    pullStartRef.current = null;
  }, [pullDistance, isRefreshing]);

  useEffect(() => {
    document.addEventListener('touchstart', handlePullStart, { passive: true });
    document.addEventListener('touchmove', handlePullMove, { passive: true });
    document.addEventListener('touchend', handlePullEnd);
    return () => {
      document.removeEventListener('touchstart', handlePullStart);
      document.removeEventListener('touchmove', handlePullMove);
      document.removeEventListener('touchend', handlePullEnd);
    };
  }, [handlePullStart, handlePullMove, handlePullEnd]);

  // — guard clauses: all hooks are declared above —
  if (loading) {
    return (
      <div className="min-h-screen bg-warmBg-primary flex items-center justify-center">
        <p className="text-lg text-warmText-secondary">Caricamento...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Validate year and month
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return (
      <div className="min-h-screen bg-warmBg-primary flex items-center justify-center">
        <p className="text-lg text-warmData-expense">Data non valida</p>
      </div>
    );
  }

  const hasTransactions = transactions.length > 0;

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTransaction(null);
  };

  const handleForceGenerateRecurring = async () => {
    if (!user) return;

    setIsGeneratingRecurring(true);
    try {
      const { transactionsCopied, transfersCopied } = await copyRecurringFromPreviousMonth(user.id, year, month);
      await loadTransactions();
      await loadTransfers(year, month);
      const parts: string[] = [];
      if (transactionsCopied > 0) parts.push(`${transactionsCopied} transazion${transactionsCopied === 1 ? 'e' : 'i'}`);
      if (transfersCopied > 0) parts.push(`${transfersCopied} trasferiment${transfersCopied === 1 ? 'o' : 'i'}`);
      const summary = parts.length > 0 ? parts.join(' e ') : 'nessun elemento';
      toast.success(`Importati: ${summary}`);
    } catch (error) {
      console.error('Error copying recurring transactions:', error);
      toast.error('Errore durante l\'importazione');
    } finally {
      setIsGeneratingRecurring(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }

      // Exit selection mode if no items selected
      if (newSet.size === 0) {
        setSelectionMode(false);
      }

      return newSet;
    });
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!user || selectedIds.size === 0) return;

    // Get selected transactions for analysis
    const selectedTransactions = transactions.filter(t => selectedIds.has(t.id));
    const recurringCount = selectedTransactions.filter(t => t.is_recurring).length;
    const oneTimeCount = selectedIds.size - recurringCount;

    // Confirmation dialog
    let confirmMessage = `Sei sicuro di voler eliminare ${selectedIds.size} transazioni?`;

    if (recurringCount > 0) {
      confirmMessage = `Stai per eliminare ${selectedIds.size} transazioni:\n\n` +
        `- ${recurringCount} ricorrenti (solo questa occorrenza)\n` +
        `- ${oneTimeCount} una tantum\n\n` +
        `Confermi l'eliminazione?`;
    }

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setIsDeletingBulk(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', Array.from(selectedIds))
        .eq('user_id', user.id); // Security: ensure user owns transactions

      if (error) throw error;

      toast.success(`${selectedIds.size} transazioni eliminate!`);

      // Reset state and reload
      setSelectedIds(new Set());
      setSelectionMode(false);
      await loadTransactions();
    } catch (error) {
      console.error('Error deleting transactions:', error);
      toast.error('Errore durante l\'eliminazione');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-warmBg-primary ${selectionMode && selectedIds.size > 0 ? 'pb-24' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center bg-warmBg-primary overflow-hidden transition-all"
          style={{ height: isRefreshing ? 48 : pullDistance }}
        >
          <RefreshCw className={`w-5 h-5 text-warmAccent-primary ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}
      {/* ZONA A: Hero Balance (Sticky) */}
      <div className="sticky top-0 z-40 warm-gradient-hero px-5 pt-5 pb-3 md:top-14">
        {/* Month Navigation — prominent title */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goToPreviousMonth}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-warmBg-tertiary/60 hover:bg-warmBg-tertiary transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-warmText-secondary" />
          </button>

          <h1 className="text-2xl font-bold text-warmText-primary capitalize tracking-tight">
            {monthName}
          </h1>

          <button
            onClick={goToNextMonth}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-warmBg-tertiary/60 hover:bg-warmBg-tertiary transition-colors active:scale-95"
          >
            <ChevronRight className="w-5 h-5 text-warmText-secondary" />
          </button>
        </div>

        {/* Quick links */}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => router.push(`/dashboard/${year}/recap`)}
            className="px-3 py-1 rounded-full bg-warmBg-tertiary/50 text-warmText-tertiary text-xs font-medium hover:bg-warmBg-tertiary hover:text-warmText-secondary transition-colors"
          >
            Recap {year}
          </button>
          <button
            onClick={() => {
              const currentYear = new Date().getFullYear();
              router.push(`/dashboard/recap?start=${currentYear - 2}&end=${currentYear}`);
            }}
            className="px-3 py-1 rounded-full bg-warmBg-tertiary/50 text-warmText-tertiary text-xs font-medium hover:bg-warmBg-tertiary hover:text-warmText-secondary transition-colors"
          >
            Multi-anno
          </button>
        </div>
      </div>

      {/* ZONA B: Charts */}
      <div className="px-4 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <MonthlySpendingTrendChart
          userId={user.id}
          currentYear={year}
          currentMonth={month}
        />
        <MonthlyRecapChart
          expenses={[...groups.recurringExpenses, ...groups.oneTimeExpenses]}
          year={year}
          month={month}
        />
      </div>

      {/* ZONA C: Inline Forms + Transaction List — 2-column on desktop */}
      <div className="px-4 mt-5 pb-8 md:grid md:grid-cols-[1fr_380px] md:gap-6">
        {/* Forms column — on mobile: first (natural order), on desktop: right column */}
        <div className="mb-5 md:mb-0 md:order-2 md:sticky md:top-28 md:self-start md:max-h-[calc(100vh-8rem)] md:overflow-y-auto space-y-3">
          <InlineIncomeForm
            onSuccess={loadTransactions}
            defaultDate={getValidDateForMonth(year, month)}
          />
          <InlineTransactionForm
            onSuccess={loadTransactions}
            defaultDate={getValidDateForMonth(year, month)}
          />
          <InvestmentForm
            onSuccess={loadTransactions}
            defaultDate={getValidDateForMonth(year, month)}
          />
          <TransferForm
            onTransferAdded={() => {
              loadTransfers(year, month);
              loadAccountNames();
            }}
            defaultDate={getValidDateForMonth(year, month)}
          />
        </div>

        {/* Transactions column — on mobile: second, on desktop: left column */}
        <div className="md:order-1">
          {/* Loading State */}
          {isLoadingTransactions && (
            <div className="text-center py-12">
              <p className="text-warmText-tertiary">Caricamento transazioni...</p>
            </div>
          )}

          {/* Empty State with contextual import */}
          {!isLoadingTransactions && !hasTransactions && (
            <div className="bg-warmBg-secondary rounded-2xl p-6 text-center">
              <div className="text-warmText-tertiary text-sm mb-3">Nessuna transazione per questo mese</div>
              <button
                onClick={handleForceGenerateRecurring}
                disabled={isGeneratingRecurring}
                className="bg-warmAccent-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-warmAccent-hover transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isGeneratingRecurring && <RefreshCw className="w-3 h-3 animate-spin" />}
                Importa ricorrenti dal mese precedente
              </button>
              <p className="text-xs text-warmText-disabled mt-2">
                oppure aggiungi transazioni con i form <span className="md:hidden">qui sopra</span><span className="hidden md:inline">a destra</span>
              </p>
            </div>
          )}

          {/* Transaction Lists */}
          {!isLoadingTransactions && hasTransactions && (
            <div className="space-y-6">
              {/* Transaction Section Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-warmText-primary">Transazioni</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleForceGenerateRecurring}
                    disabled={isGeneratingRecurring}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warmBg-tertiary text-xs font-medium text-warmText-secondary hover:bg-warmBg-hover hover:text-warmText-primary transition-colors disabled:opacity-50 active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingRecurring ? 'animate-spin' : ''}`} />
                    Importa
                  </button>
                  <button
                    onClick={selectionMode ? cancelSelection : enterSelectionMode}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 ${
                      selectionMode
                        ? 'bg-warmData-expense/15 text-warmData-expense hover:bg-warmData-expense/25'
                        : 'bg-warmBg-tertiary text-warmText-secondary hover:bg-warmBg-hover hover:text-warmText-primary'
                    }`}
                  >
                    {selectionMode ? 'Annulla' : 'Seleziona'}
                  </button>
                </div>
              </div>
              <TransactionGroup
                title="Investimenti"
                transactions={groups.investments}
                total={totals.investments}
                colorScheme="investment"
                onEditTransaction={handleEditTransaction}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
              />
              <TransactionGroup
                title="Entrate Ricorrenti"
                transactions={groups.recurringIncome}
                total={totals.recurringIncome}
                totalPrefix="+"
                colorScheme="income"
                onEditTransaction={handleEditTransaction}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
              />
              <TransactionGroup
                title="Entrate Una Tantum"
                transactions={groups.oneTimeIncome}
                total={totals.oneTimeIncome}
                totalPrefix="+"
                colorScheme="income"
                variant="secondary"
                onEditTransaction={handleEditTransaction}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
              />
              <TransactionGroup
                title="Spese Ricorrenti"
                transactions={groups.recurringExpenses}
                total={totals.recurringExpenses}
                totalPrefix="-"
                colorScheme="expense"
                onEditTransaction={handleEditTransaction}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
              />
              <TransactionGroup
                title="Spese Una Tantum"
                transactions={groups.oneTimeExpenses}
                total={totals.oneTimeExpenses}
                totalPrefix="-"
                colorScheme="expense"
                variant="secondary"
                onEditTransaction={handleEditTransaction}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
              />
            </div>
          )}

          {/* Movimenti del mese — transfers only, not included in P&L */}
          {transfers.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-warmText-primary mb-3">Movimenti del mese</h2>
              <div className="space-y-2">
                {transfers.map(transfer => {
                  const fromName = transfer.from_savings_account_id
                    ? (accountNames[transfer.from_savings_account_id] ?? '—')
                    : '—';
                  const toName = transfer.to_savings_account_id
                    ? (accountNames[transfer.to_savings_account_id] ?? '—')
                    : transfer.to_investment_account_id
                    ? (accountNames[transfer.to_investment_account_id] ?? '—')
                    : '—';

                  return (
                    <div
                      key={transfer.id}
                      className="bg-warmBg-secondary rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-warmText-tertiary text-sm flex-shrink-0">⇄</span>
                        <div className="min-w-0">
                          <p className="text-sm text-warmText-primary truncate">
                            {fromName} → {toName}
                          </p>
                          <p className="text-xs text-warmText-tertiary">{transfer.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-warmText-primary tabular-nums">
                          {transfer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                        <button
                          onClick={async () => {
                            if (window.confirm('Eliminare questo trasferimento?')) {
                              await deleteTransfer(transfer.id);
                              loadAccountNames();
                            }
                          }}
                          className="text-xs text-warmText-disabled hover:text-warmData-expense transition-colors"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Transaction Modal (kept for editing only) */}
      <TransactionModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSuccess={() => {
          loadTransactions();
        }}
        transaction={editingTransaction}
      />

      {/* Bulk Delete Action Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <BulkDeleteActionBar
          selectedCount={selectedIds.size}
          onCancel={cancelSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeletingBulk}
        />
      )}
    </div>
  );
}
