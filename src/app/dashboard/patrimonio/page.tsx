'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, Wallet, Loader2 } from 'lucide-react';
import { updateWealthSnapshotFromAccounts } from '@/lib/wealth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import SavingsAccountsList from '@/components/SavingsAccountsList';
import InvestmentAccountsList from '@/components/InvestmentAccountsList';
import NetWorthCard from '@/components/NetWorthCard';
import { formatCurrency } from '@/hooks/useInvestmentAccounts';
import type { InvestmentDistributionData } from '@/hooks/useInvestmentAccounts';
import type { AssetSlice, AccountSlice, DistributionMode } from '@/components/WealthDistributionChart';
import dynamic from 'next/dynamic';
const SavingsPerformanceChart = dynamic(() => import('@/components/SavingsPerformanceChart'), { ssr: false });
const InvestmentPerformanceChart = dynamic(() => import('@/components/InvestmentPerformanceChart'), { ssr: false });
const WealthDistributionChart = dynamic(() => import('@/components/WealthDistributionChart'), { ssr: false });

type Tab = 'risparmi' | 'investimenti';

export default function PatrimonioPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('risparmi');
  const [isLoading, setIsLoading] = useState(true);
  const [hasWealthSnapshot, setHasWealthSnapshot] = useState<boolean | null>(null);
  const [totalMarketValue, setTotalMarketValue] = useState<number | null>(null);
  const [totalCostBasis, setTotalCostBasis] = useState<number>(0);
  const [totalCashBalance, setTotalCashBalance] = useState<number>(0);
  const [savingsTotal, setSavingsTotal] = useState<number>(0);
  const [pricesLoading, setPricesLoading] = useState<boolean>(false);
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('per-asset');
  const [assetSlices, setAssetSlices] = useState<AssetSlice[]>([]);
  const [accountSlices, setAccountSlices] = useState<AccountSlice[]>([]);
  const [savingsAccountsData, setSavingsAccountsData] = useState<{ name: string; balance: number }[]>([]);
  const snapshotUpdatedRef = useRef(false);

  const checkWealthSnapshot = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('wealth_snapshots')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      console.error('Error checking wealth snapshots:', error);
      setHasWealthSnapshot(false);
      return;
    }

    setHasWealthSnapshot(data && data.length > 0);
  }, [user]);

  // Load account totals directly from DB (no unallocated)
  const loadAccountTotals = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: savingsAccounts } = await supabase
        .from('savings_accounts')
        .select('name, balance')
        .eq('user_id', user.id);
      const savingsAccountsTotal = (savingsAccounts || []).reduce((sum, a) => sum + Number(a.balance), 0);
      setSavingsTotal(savingsAccountsTotal);
      setSavingsAccountsData((savingsAccounts || []).map(a => ({ name: a.name, balance: Number(a.balance) })));

      const { data: investAccounts } = await supabase
        .from('investment_accounts')
        .select('cash_balance')
        .eq('user_id', user.id);
      const cashTotal = (investAccounts || []).reduce((sum, a) => sum + Number(a.cash_balance), 0);
      setTotalCashBalance(cashTotal);
    } catch (error) {
      console.error('Error loading account totals:', error);
      toast.error('Errore nel caricamento dei conti');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && hasWealthSnapshot !== null) {
      loadAccountTotals();
    }
  }, [user, hasWealthSnapshot, loadAccountTotals]);

  // Lazy update: recalculate wealth snapshot from real account data once per page load
  useEffect(() => {
    if (user && hasWealthSnapshot && !isLoading && !snapshotUpdatedRef.current) {
      snapshotUpdatedRef.current = true;
      updateWealthSnapshotFromAccounts(user.id);
    }
  }, [user, hasWealthSnapshot, isLoading]);

  const handleMarketValueUpdate = useCallback((marketValue: number, costBasis: number) => {
    setTotalMarketValue(marketValue);
    setTotalCostBasis(costBasis);
  }, []);

  // Investment distribution data callback
  const investDistRef = useRef<InvestmentDistributionData | null>(null);
  const handleDistributionData = useCallback((data: InvestmentDistributionData) => {
    investDistRef.current = data;
  }, []);

  // Build combined distribution slices when any data changes
  useEffect(() => {
    const invDist = investDistRef.current;

    // Per-asset slices: individual assets + total liquidity
    const newAssetSlices: AssetSlice[] = [];
    let totalLiquidity = 0;

    // Savings accounts balances as liquidity
    for (const acc of savingsAccountsData) {
      totalLiquidity += acc.balance;
    }

    // Investment cash balances as liquidity
    if (invDist) {
      for (const acc of invDist.accountValues) {
        totalLiquidity += acc.cashBalance;
      }
      for (const asset of invDist.assetValues) {
        newAssetSlices.push({ name: asset.name, value: asset.value });
      }
    }

    if (totalLiquidity > 0) {
      newAssetSlices.push({ name: 'Liquidità', value: Math.round(totalLiquidity * 100) / 100 });
    }

    // Per-conto slices: individual accounts
    const newAccountSlices: AccountSlice[] = [];

    for (const acc of savingsAccountsData) {
      if (acc.balance > 0) {
        newAccountSlices.push({ name: acc.name, value: Math.round(acc.balance * 100) / 100 });
      }
    }

    if (invDist) {
      for (const acc of invDist.accountValues) {
        const accTotal = acc.cashBalance + acc.holdingsValue;
        if (accTotal > 0) {
          newAccountSlices.push({ name: acc.name, value: Math.round(accTotal * 100) / 100 });
        }
      }
    }

    setAssetSlices(newAssetSlices);
    setAccountSlices(newAccountSlices);
  }, [savingsAccountsData, totalMarketValue, totalCashBalance]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      checkWealthSnapshot();
    }
  }, [user, checkWealthSnapshot]);

  useEffect(() => {
    if (hasWealthSnapshot === false) {
      setIsLoading(false);
    }
  }, [hasWealthSnapshot]);

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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <div className="min-h-screen bg-warmBg-primary">
      <div className="max-w-xl lg:max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-warmBg-tertiary transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-warmText-secondary" />
            </button>
            <h1 className="text-xl font-bold text-warmText-primary">Patrimonio</h1>
          </div>
        </div>

        {/* Onboarding: no wealth snapshot yet */}
        {hasWealthSnapshot === false && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-warmAccent-primary bg-opacity-10 flex items-center justify-center mb-5">
              <Wallet className="w-8 h-8 text-warmAccent-primary" />
            </div>
            <h2 className="text-lg font-semibold text-warmText-primary mb-2">
              Imposta il tuo patrimonio iniziale
            </h2>
            <p className="text-sm text-warmText-secondary mb-6 max-w-xs">
              Troverai un banner nella dashboard mensile per impostare il tuo patrimonio
              attuale (risparmi e investimenti).
            </p>
            <button
              onClick={() => router.push(`/dashboard/${currentYear}/${currentMonth}`)}
              className="px-5 py-2.5 bg-warmAccent-primary text-white rounded-lg text-sm font-medium hover:bg-warmAccent-hover transition-colors"
            >
              Vai alla dashboard
            </button>
          </div>
        )}

        {/* Main content: only shown when snapshot exists */}
        {hasWealthSnapshot && (
          <>
            {/* Net Worth Card - full width above grid */}
            {!isLoading && (
              <NetWorthCard
                savingsTotal={savingsTotal}
                totalCashBalance={totalCashBalance}
                totalMarketValue={totalMarketValue}
                totalCostBasis={totalCostBasis}
                pricesLoading={pricesLoading}
              />
            )}

            {/* 2-column grid on desktop (lg+), single column on mobile */}
            <div className="lg:grid lg:grid-cols-5 lg:gap-6">
              {/* LEFT COLUMN: tab bar, accounts list */}
              <div className="lg:col-span-3">
                {/* Tab Bar */}
                <div className="flex bg-warmBg-secondary rounded-xl p-1 mb-6 lg:mb-0">
                  <button
                    onClick={() => setActiveTab('risparmi')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'risparmi'
                        ? 'bg-warmData-savings bg-opacity-15 text-warmData-savings'
                        : 'text-warmText-tertiary hover:text-warmText-secondary'
                    }`}
                  >
                    Risparmi
                  </button>
                  <button
                    onClick={() => setActiveTab('investimenti')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'investimenti'
                        ? 'bg-warmData-investment bg-opacity-15 text-warmData-investment'
                        : 'text-warmText-tertiary hover:text-warmText-secondary'
                    }`}
                  >
                    Investimenti
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: charts (desktop: sticky sidebar, mobile: between tabs and accounts) */}
              <div className="lg:col-span-2 lg:row-span-2 lg:sticky lg:top-4 lg:self-start space-y-4 mb-4 lg:mb-0">
                {activeTab === 'risparmi' ? (
                  <SavingsPerformanceChart userId={user.id} currentTotal={savingsTotal} />
                ) : (
                  <>
                    {/* Controvalore Card */}
                    {totalMarketValue !== null && (
                      <div className="bg-warmBg-secondary rounded-2xl p-4 border border-warmData-investment border-opacity-20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-warmText-tertiary mb-0.5">Controvalore Totale</p>
                            <p className="text-xl font-bold text-warmText-primary">
                              {formatCurrency(totalMarketValue)}
                            </p>
                            <p className="text-xs text-warmText-tertiary mt-0.5">
                              Costo: {formatCurrency(totalCostBasis)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-warmText-tertiary mb-0.5">P&L Totale</p>
                            {(() => {
                              const pnl = Math.round((totalMarketValue - totalCostBasis) * 100) / 100;
                              const pnlPct = totalCostBasis > 0
                                ? Math.round(((totalMarketValue - totalCostBasis) / totalCostBasis) * 10000) / 100
                                : 0;
                              return (
                                <>
                                  <p className={`text-lg font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                  </p>
                                  <p className={`text-xs font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    <InvestmentPerformanceChart
                      userId={user.id}
                      totalMarketValue={totalMarketValue}
                      totalCashBalance={totalCashBalance}
                    />
                  </>
                )}
                {/* Distribution Chart - desktop only (mobile version below accounts) */}
                {(assetSlices.length > 0 || accountSlices.length > 0) && (
                  <div className="hidden lg:block">
                    <div className="bg-warmBg-tertiary rounded-lg p-0.5 flex mb-3">
                      <button
                        onClick={() => setDistributionMode('per-asset')}
                        className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-300 ${
                          distributionMode === 'per-asset'
                            ? 'bg-warmAccent-primary text-white shadow-sm'
                            : 'text-warmText-tertiary hover:text-warmText-secondary'
                        }`}
                      >
                        Per Asset
                      </button>
                      <button
                        onClick={() => setDistributionMode('per-conto')}
                        className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-300 ${
                          distributionMode === 'per-conto'
                            ? 'bg-warmAccent-primary text-white shadow-sm'
                            : 'text-warmText-tertiary hover:text-warmText-secondary'
                        }`}
                      >
                        Per Conto
                      </button>
                    </div>
                    <div key={`desktop-${distributionMode}`} className="animate-fadeSlideIn">
                      <WealthDistributionChart
                        mode={distributionMode}
                        assetData={assetSlices}
                        accountData={accountSlices}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Distribution Chart - mobile only (between performance chart and accounts list) */}
              {(assetSlices.length > 0 || accountSlices.length > 0) && (
                <div className="lg:hidden mb-4">
                  <div className="bg-warmBg-tertiary rounded-lg p-0.5 flex mb-3">
                    <button
                      onClick={() => setDistributionMode('per-asset')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-300 ${
                        distributionMode === 'per-asset'
                          ? 'bg-warmAccent-primary text-white shadow-sm'
                          : 'text-warmText-tertiary hover:text-warmText-secondary'
                      }`}
                    >
                      Per Asset
                    </button>
                    <button
                      onClick={() => setDistributionMode('per-conto')}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-300 ${
                        distributionMode === 'per-conto'
                          ? 'bg-warmAccent-primary text-white shadow-sm'
                          : 'text-warmText-tertiary hover:text-warmText-secondary'
                      }`}
                    >
                      Per Conto
                    </button>
                  </div>
                  <div key={`mobile-${distributionMode}`} className="animate-fadeSlideIn">
                    <WealthDistributionChart
                      mode={distributionMode}
                      assetData={assetSlices}
                      accountData={accountSlices}
                    />
                  </div>
                </div>
              )}

              {/* LEFT COLUMN continued: accounts list */}
              <div className="lg:col-span-3 space-y-2">
                <div className={activeTab === 'risparmi' ? '' : 'hidden'}>
                  <SavingsAccountsList userId={user.id} savingsUnallocated={0} onAccountsChanged={loadAccountTotals} />
                </div>
                <div className={activeTab === 'investimenti' ? '' : 'hidden'}>
                  <InvestmentAccountsList
                    userId={user.id}
                    investmentsUnallocated={0}
                    onAccountsChanged={loadAccountTotals}
                    onTotalMarketValue={handleMarketValueUpdate}
                    onPricesLoadingChange={setPricesLoading}
                    onDistributionData={handleDistributionData}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Initial loading state */}
        {hasWealthSnapshot === null && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-warmText-tertiary animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
