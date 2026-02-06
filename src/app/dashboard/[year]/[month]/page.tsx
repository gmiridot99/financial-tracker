'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, ChevronLeft, ChevronRight, RefreshCw, BarChart3, CheckSquare, Pencil, TrendingUp, Calculator } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import TransactionModal from '@/components/TransactionModal';
import TransactionCard from '@/components/TransactionCard';
import MonthlyFlowChart from '@/components/MonthlyFlowChart';
import InlineIncomeForm from '@/components/InlineIncomeForm';
import InlineTransactionForm from '@/components/InlineTransactionForm';
import InvestmentForm from '@/components/InvestmentForm';
import CountUp from '@/components/CountUp';
import BulkDeleteActionBar from '@/components/BulkDeleteActionBar';
import WealthModal from '@/components/WealthModal';
import { supabase } from '@/lib/supabase';
import { calculateMonthlySummary } from '@/lib/calculations';
import { copyRecurringFromPreviousMonth } from '@/lib/recurring';
import { getValidDateForMonth } from '@/lib/dateUtils';
import { calculateWealthForMonth } from '@/lib/wealth';
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
  // Wealth tracking state
  const [wealthData, setWealthData] = useState({ investments: 0, savings: 0 });
  const [isLoadingWealth, setIsLoadingWealth] = useState(true);
  const [isWealthModalOpen, setIsWealthModalOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();

  const year = parseInt(params.year as string, 10);
  const month = parseInt(params.month as string, 10);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

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

  // Create date object for current month (using day 1)
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


  // Load wealth data for current month
  const loadWealthData = async () => {
    if (!user) return;

    setIsLoadingWealth(true);
    try {
      const wealth = await calculateWealthForMonth(user.id, year, month);
      setWealthData(wealth);
    } catch (error) {
      console.error('Error loading wealth data:', error);
    } finally {
      setIsLoadingWealth(false);
    }
  };

  // Load transactions and wealth when month changes
  useEffect(() => {
    if (user && !isNaN(year) && !isNaN(month)) {
      // Clear selection when navigating months
      setSelectionMode(false);
      setSelectedIds(new Set());

      loadTransactions();
      loadWealthData();
    }
  }, [user, year, month]);

  // Group transactions (excluding investments)
  const nonInvestmentTransactions = transactions.filter(
    t => t.category_name !== 'Investimenti'
  );

  // Separate income and expenses
  const incomeTransactions = nonInvestmentTransactions.filter(t => t.type === 'income');
  const expenseTransactions = nonInvestmentTransactions.filter(t => t.type === 'expense');

  // Further group by recurring/one-time
  const recurringIncome = incomeTransactions.filter(t => t.is_recurring);
  const oneTimeIncome = incomeTransactions.filter(t => !t.is_recurring);
  const recurringExpenses = expenseTransactions.filter(t => t.is_recurring);
  const oneTimeExpenses = expenseTransactions.filter(t => !t.is_recurring);

  const hasTransactions = transactions.length > 0;

  // Calculate monthly summary (with default settings, not used anymore)
  const summary = calculateMonthlySummary(transactions, { savings_percentage: 0, investments_percentage: 0 });

  // Navigation functions
  const goToPreviousMonth = () => {
    const prevMonth = subMonths(currentDate, 1);
    const newYear = prevMonth.getFullYear();
    const newMonth = prevMonth.getMonth() + 1;
    router.push(`/dashboard/${newYear}/${String(newMonth).padStart(2, '0')}`);
  };

  const goToNextMonth = () => {
    const nextMonth = addMonths(currentDate, 1);
    const newYear = nextMonth.getFullYear();
    const newMonth = nextMonth.getMonth() + 1;
    router.push(`/dashboard/${newYear}/${String(newMonth).padStart(2, '0')}`);
  };

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
      // Copy recurring transactions from previous month
      await copyRecurringFromPreviousMonth(user.id, year, month);
      await loadTransactions();
      toast.success('Transazioni ricorrenti importate dal mese precedente!');
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

  const totalRecurringIncome = recurringIncome.reduce((sum, t) => sum + t.amount, 0);
  const totalOneTimeIncome = oneTimeIncome.reduce((sum, t) => sum + t.amount, 0);
  const totalRecurringExpenses = recurringExpenses.reduce((sum, t) => sum + t.amount, 0);
  const totalOneTimeExpenses = oneTimeExpenses.reduce((sum, t) => sum + t.amount, 0);

  // Calculate investments (transactions with category "Investimenti")
  const investmentTransactions = transactions.filter(
    t => t.category_name === 'Investimenti'
  );
  const totalInvestments = investmentTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Calculate cash remaining (without using settings percentages)
  const cashRemaining = summary.totalIncome - summary.totalExpenses;

  return (
    <div className="min-h-screen bg-warmBg-primary">
      {/* ZONA A: Hero Balance (Sticky) */}
      <div className="sticky top-0 z-50 warm-gradient-hero px-5 pt-6 pb-4">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-base font-medium text-warmText-secondary">Financial Life</h1>
          <div className="flex gap-2">
            <button
              onClick={enterSelectionMode}
              className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:text-warmText-secondary transition-colors"
              title="Seleziona multipla"
            >
              <CheckSquare className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push(`/dashboard/${year}/recap`)}
              className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:text-warmText-secondary transition-colors"
              title="Recap Annuale"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const currentYear = new Date().getFullYear();
                router.push(`/dashboard/recap?start=${currentYear - 2}&end=${currentYear}`);
              }}
              className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:text-warmText-secondary transition-colors"
              title="Recap Multi-Anno"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/dashboard/simulator')}
              className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:text-warmText-secondary transition-colors"
              title="Simulatore Finanziario"
            >
              <Calculator className="w-5 h-5" />
            </button>
            <button
              onClick={signOut}
              className="w-9 h-9 flex items-center justify-center text-warmText-tertiary hover:text-warmText-secondary transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-warmBg-tertiary transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-warmText-secondary" />
          </button>

          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-warmText-secondary capitalize">
              {monthName}
            </h2>
            <button
              onClick={handleForceGenerateRecurring}
              disabled={isGeneratingRecurring}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-warmBg-tertiary transition-colors disabled:opacity-50"
              title="Importa transazioni ricorrenti"
            >
              <RefreshCw className={`w-4 h-4 text-warmText-disabled ${isGeneratingRecurring ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button
            onClick={goToNextMonth}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-warmBg-tertiary transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-warmText-secondary" />
          </button>
        </div>

        {/* Main Balance - Centered */}
        <div className="text-center mb-4">
          <div className="text-sm font-normal text-warmText-tertiary mb-1">
            Cash disponibile
          </div>
          <div className="text-5xl font-bold text-warmText-primary">
            <CountUp end={cashRemaining} />
          </div>
        </div>

        {/* Mini Stats Pills */}
        <div className="flex gap-2 justify-center">
          <div className="px-3.5 py-2 bg-warmData-income bg-opacity-10 rounded-full">
            <span className="text-xs font-semibold text-warmData-income">
              Entrate +€{summary.totalIncome.toFixed(0)}
            </span>
          </div>
          <div className="px-3.5 py-2 bg-warmData-expense bg-opacity-10 rounded-full">
            <span className="text-xs font-semibold text-warmData-expense">
              Spese -€{summary.totalExpenses.toFixed(0)}
            </span>
          </div>
          <div className="px-3.5 py-2 bg-warmData-investment bg-opacity-10 rounded-full">
            <span className="text-xs font-semibold text-warmData-investment">
              Investiti €{totalInvestments.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Wealth Summary Row */}
        {!isLoadingWealth && (
          <div className="flex gap-2 justify-center mt-2.5">
            {wealthData.investments > 0 && (
              <div className="px-3 py-1.5 bg-warmData-investment bg-opacity-5 rounded-full border border-warmData-investment border-opacity-20">
                <span className="text-[11px] font-medium text-warmData-investment">
                  Patrimonio inv. €{wealthData.investments.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            {wealthData.savings > 0 && (
              <div className="px-3 py-1.5 bg-warmData-savings bg-opacity-5 rounded-full border border-warmData-savings border-opacity-20">
                <span className="text-[11px] font-medium text-warmData-savings">
                  Risparmi €{wealthData.savings.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            <button
              onClick={() => setIsWealthModalOpen(true)}
              className="px-3 py-1.5 rounded-full border border-warmText-muted border-opacity-40 hover:border-warmData-investment hover:bg-warmData-investment hover:bg-opacity-5 transition-all active:scale-95"
              aria-label="Modifica patrimonio"
            >
              <span className="text-[11px] font-medium text-warmText-tertiary flex items-center gap-1">
                <Pencil size={11} />
                {wealthData.investments === 0 && wealthData.savings === 0 ? 'Patrimonio' : 'Modifica'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ZONA B: Flow Chart */}
      <div className="px-4 mt-5">
        <MonthlyFlowChart
          totalIncome={summary.totalIncome}
          totalExpenses={summary.totalExpenses}
          totalInvestments={totalInvestments}
        />
      </div>

      {/* ZONA C: Inline Forms + Transaction List */}
      <div className="px-4 mt-5 pb-8">
        {/* Income Form */}
        <div className="mb-3">
          <InlineIncomeForm
            onSuccess={loadTransactions}
            defaultDate={getValidDateForMonth(year, month)}
          />
        </div>

        {/* Expense Form */}
        <div className="mb-3">
          <InlineTransactionForm
            onSuccess={loadTransactions}
            defaultDate={getValidDateForMonth(year, month)}
          />
        </div>

        {/* Investment Form */}
        <div className="mb-5">
          <InvestmentForm
            onSuccess={loadTransactions}
            defaultDate={getValidDateForMonth(year, month)}
          />
        </div>

        {/* Loading State */}
        {isLoadingTransactions && (
          <div className="text-center py-12">
            <p className="text-warmText-tertiary">Caricamento transazioni...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingTransactions && !hasTransactions && (
          <div className="bg-warmBg-secondary rounded-2xl p-8 text-center">
            <div className="text-warmText-tertiary mb-2">Nessuna transazione ancora</div>
            <p className="text-sm text-warmText-disabled">
              Aggiungi la tua prima transazione usando il form qui sopra
            </p>
          </div>
        )}

        {/* Transaction Lists */}
        {!isLoadingTransactions && hasTransactions && (
          <div className="space-y-6">
            {/* Investimenti */}
            {investmentTransactions.length > 0 && (
              <div className="bg-warmData-investment bg-opacity-10 rounded-2xl overflow-hidden border border-warmData-investment">
                <div className="px-4 py-3 border-b border-warmData-investment border-opacity-20">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-warmData-investment">
                      Investimenti
                    </h3>
                    <span className="text-xs font-semibold text-warmData-investment">
                      Tot: €{totalInvestments.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  {investmentTransactions.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      onClick={() => handleEditTransaction(transaction)}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(transaction.id)}
                      onToggleSelect={toggleSelection}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Entrate Ricorrenti */}
            {recurringIncome.length > 0 && (
              <div className="bg-warmData-income bg-opacity-10 rounded-2xl overflow-hidden border border-warmData-income border-opacity-30">
                <div className="px-4 py-3 border-b border-warmData-income border-opacity-20">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-warmData-income">
                      Entrate Ricorrenti
                    </h3>
                    <span className="text-xs font-semibold text-warmData-income">
                      Tot: +€{totalRecurringIncome.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  {recurringIncome.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      onClick={() => handleEditTransaction(transaction)}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(transaction.id)}
                      onToggleSelect={toggleSelection}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Entrate Una Tantum */}
            {oneTimeIncome.length > 0 && (
              <div className="bg-warmData-income bg-opacity-5 rounded-2xl overflow-hidden border border-warmData-income border-opacity-20">
                <div className="px-4 py-3 border-b border-warmData-income border-opacity-10">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-warmData-income">
                      Entrate Una Tantum
                    </h3>
                    <span className="text-xs font-semibold text-warmData-income">
                      Tot: +€{totalOneTimeIncome.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  {oneTimeIncome.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      onClick={() => handleEditTransaction(transaction)}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(transaction.id)}
                      onToggleSelect={toggleSelection}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Spese Ricorrenti */}
            {recurringExpenses.length > 0 && (
              <div className="bg-warmData-expense bg-opacity-10 rounded-2xl overflow-hidden border border-warmData-expense border-opacity-30">
                <div className="px-4 py-3 border-b border-warmData-expense border-opacity-20">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-warmData-expense">
                      Spese Ricorrenti
                    </h3>
                    <span className="text-xs font-semibold text-warmData-expense">
                      Tot: -€{totalRecurringExpenses.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  {recurringExpenses.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      onClick={() => handleEditTransaction(transaction)}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(transaction.id)}
                      onToggleSelect={toggleSelection}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Spese Una Tantum */}
            {oneTimeExpenses.length > 0 && (
              <div className="bg-warmData-expense bg-opacity-5 rounded-2xl overflow-hidden border border-warmData-expense border-opacity-20">
                <div className="px-4 py-3 border-b border-warmData-expense border-opacity-10">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-warmData-expense">
                      Spese Una Tantum
                    </h3>
                    <span className="text-xs font-semibold text-warmData-expense">
                      Tot: -€{totalOneTimeExpenses.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  {oneTimeExpenses.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      onClick={() => handleEditTransaction(transaction)}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(transaction.id)}
                      onToggleSelect={toggleSelection}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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

      {/* Wealth Modal */}
      <WealthModal
        isOpen={isWealthModalOpen}
        onClose={() => setIsWealthModalOpen(false)}
        onSuccess={() => {
          loadWealthData();
        }}
        year={year}
        month={month}
        initialData={wealthData}
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
