'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, TrendingUp, Save, FolderOpen } from 'lucide-react';
import { SimulationConfig, SimulationResult } from '@/lib/simulator/types';
import { simulate } from '@/lib/simulator/simulator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import MilestoneTable from '@/components/simulator/MilestoneTable';
import DebtsList from '@/components/simulator/DebtsList';
import SimulatorChart from '@/components/simulator/SimulatorChart';
import ResultsSummary from '@/components/simulator/ResultsSummary';
import MilestonesCards from '@/components/simulator/MilestonesCards';
import ExportButton from '@/components/simulator/ExportButton';
import SaveSimulationDialog from '@/components/simulator/SaveSimulationDialog';
import LoadSimulationMenu from '@/components/simulator/LoadSimulationMenu';

interface SavedSimulationListItem {
  id: string;
  name: string;
  config: SimulationConfig;
  created_at: string;
  updated_at: string;
}

export default function SimulatorPage() {
  const { user } = useAuth();

  const [config, setConfig] = useState<SimulationConfig>({
    initialSavings: 20000,
    initialInvestments: 50000,
    horizonYears: 50,
    startYear: new Date().getFullYear(),
    inflationRate: 2,
    allocationInvestments: 60,
    allocationSavings: 40,
    investmentReturnRate: 7,
    savingsReturnRate: 1,
    milestones: {
      year1: { salary: 2500 },
      year5: { salary: 3000 },
      year10: { salary: 3500 },
      year20: { salary: 4500 },
      year30: { salary: 5000 },
      year50: { salary: 6000 },
    },
    expenseRows: [
      { id: 'default-affitto', label: 'Affitto', amounts: { year1: 700, year5: 800, year10: 900, year20: 1000, year30: 1000, year50: 1000 } },
      { id: 'default-spese', label: 'Spese Quotidiane', amounts: { year1: 500, year5: 600, year10: 700, year20: 900, year30: 1000, year50: 1100 } },
      { id: 'default-bollette', label: 'Bollette', amounts: { year1: 150, year5: 200, year10: 250, year20: 350, year30: 400, year50: 450 } },
    ],
    debts: [],
  });

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Save/Load state
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulationListItem[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  // Load saved simulations on mount
  useEffect(() => {
    if (!user) return;

    const loadSavedSimulations = async () => {
      try {
        const { data, error } = await supabase
          .from('saved_simulations')
          .select('id, name, config, created_at, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setSavedSimulations((data as SavedSimulationListItem[]) || []);
      } catch (err) {
        console.error('Failed to load saved simulations:', err);
      }
    };

    loadSavedSimulations();
  }, [user]);

  const handleSimulate = () => {
    setIsSimulating(true);
    setError(null);

    try {
      const simulationResult = simulate(config);
      setResult(simulationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
      setResult(null);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveSimulation = async (name: string) => {
    if (!user) {
      throw new Error('Devi essere autenticato per salvare una simulazione');
    }

    const { data, error } = await supabase
      .from('saved_simulations')
      .upsert(
        {
          user_id: user.id,
          name,
          config: config as unknown as Record<string, unknown>,
        },
        { onConflict: 'user_id,name' }
      )
      .select('id, name, config, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Errore durante il salvataggio: ${error.message}`);
    }

    // Update local state
    setSavedSimulations((prev) => {
      const existing = prev.findIndex((s) => s.name === name);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = data as SavedSimulationListItem;
        return updated;
      }
      return [data as SavedSimulationListItem, ...prev];
    });
  };

  const handleLoadSimulation = (id: string) => {
    const simulation = savedSimulations.find((s) => s.id === id);
    if (!simulation) return;

    setConfig(simulation.config as SimulationConfig);
    setShowLoadMenu(false);
    setResult(null);
  };

  const handleDeleteSimulation = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('saved_simulations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      alert(`Errore durante l'eliminazione: ${error.message}`);
      return;
    }

    setSavedSimulations((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-warmBg-primary p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-warmText-tertiary hover:text-warmText-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-warmBg-tertiary" />
            <div>
              <h1 className="text-3xl font-bold text-warmText-primary flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-warmAccent-primary" />
                Simulatore Finanziario Multi-Decennale
              </h1>
              <p className="text-warmText-secondary mt-1">
                Proietta il tuo patrimonio nei prossimi 50 anni
              </p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-warmData-expense bg-opacity-10 border border-warmData-expense border-opacity-20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-warmData-expense bg-opacity-20 rounded-full p-2">
                <svg
                  className="w-5 h-5 text-warmData-expense"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-warmData-expense">
                  Errore Simulazione
                </h3>
                <p className="text-warmData-expense text-opacity-80 text-sm mt-1 whitespace-pre-wrap">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6">
          {/* Configuration Section */}
          <div className="bg-warmBg-secondary rounded-xl border border-warmBg-tertiary p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-warmText-primary">
                Configurazione Simulazione
              </h2>
              <div className="flex items-center gap-3">
                {user && (
                  <>
                    <div className="relative">
                      <button
                        onClick={() => setShowLoadMenu(!showLoadMenu)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-warmBg-tertiary hover:bg-warmBg-hover text-warmText-secondary rounded-lg transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span className="font-medium text-sm">Carica</span>
                      </button>
                      {showLoadMenu && (
                        <LoadSimulationMenu
                          simulations={savedSimulations}
                          onLoad={handleLoadSimulation}
                          onDelete={handleDeleteSimulation}
                          onClose={() => setShowLoadMenu(false)}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-warmBg-tertiary hover:bg-warmBg-hover text-warmText-secondary rounded-lg transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span className="font-medium text-sm">Salva</span>
                    </button>
                  </>
                )}
                {result && <ExportButton result={result} config={config} />}
                <button
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  className="flex items-center gap-2 px-6 py-3 bg-warmAccent-primary hover:bg-warmAccent-hover disabled:bg-warmBg-tertiary disabled:text-warmText-disabled text-warmText-primary rounded-lg font-medium transition-colors"
                >
                  {isSimulating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-warmText-primary border-t-transparent rounded-full animate-spin" />
                      <span>Simulando...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Simula</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Initial Configuration */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold text-warmText-primary uppercase tracking-wider mb-4">
                Configurazione Globale
              </h3>
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-xs text-warmText-tertiary mb-1.5">
                    Investimenti Iniziali (&euro;)
                  </label>
                  <p className="text-xs text-warmText-disabled mb-1">ETF, azioni, fondi, obbligazioni</p>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={config.initialInvestments || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        initialInvestments: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="w-full h-11 px-3 bg-warmBg-tertiary border border-warmBg-hover text-warmText-primary rounded-xl focus:ring-2 focus:ring-warmAccent-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-warmText-tertiary mb-1.5">
                    Risparmi Iniziali (&euro;)
                  </label>
                  <p className="text-xs text-warmText-disabled mb-1">Conto corrente, depositi, contanti</p>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={config.initialSavings || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        initialSavings: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="w-full h-11 px-3 bg-warmBg-tertiary border border-warmBg-hover text-warmText-primary rounded-xl focus:ring-2 focus:ring-warmAccent-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-warmText-tertiary mb-1.5">
                    Anno di Inizio
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={config.startYear}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        startYear: Number(e.target.value),
                      })
                    }
                    className="w-full h-11 px-3 bg-warmBg-tertiary border border-warmBg-hover text-warmText-primary rounded-xl focus:ring-2 focus:ring-warmAccent-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-warmText-tertiary mb-1.5">
                    Inflazione (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={config.inflationRate || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        inflationRate: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="w-full h-11 px-3 bg-warmBg-tertiary border border-warmBg-hover text-warmText-primary rounded-xl focus:ring-2 focus:ring-warmAccent-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Allocation Section */}
              <div className="mt-6 pt-6 border-t border-warmBg-tertiary">
                <h4 className="text-xs font-semibold text-warmText-primary uppercase tracking-wider mb-1">
                  Allocazione Surplus
                </h4>
                <p className="text-xs text-warmText-disabled mb-3">
                  Come distribuire il risparmio mensile tra investimenti (ETF, fondi) e risparmi (conto corrente)
                </p>

                {/* Allocation Slider */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-warmData-investment">
                      Investimenti: {config.allocationInvestments}%
                    </span>
                    <span className="text-sm font-medium text-warmData-savings">
                      Risparmi: {config.allocationSavings}%
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.allocationInvestments}
                      onChange={(e) => {
                        const inv = Number(e.target.value);
                        setConfig({
                          ...config,
                          allocationInvestments: inv,
                          allocationSavings: 100 - inv,
                        });
                      }}
                      className="w-full h-2 bg-warmBg-tertiary rounded-full appearance-none cursor-pointer accent-warmData-investment"
                      style={{
                        background: `linear-gradient(to right, rgba(236, 115, 87, 0.3) 0%, rgba(236, 115, 87, 0.3) ${config.allocationInvestments}%, rgba(87, 160, 131, 0.3) ${config.allocationInvestments}%, rgba(87, 160, 131, 0.3) 100%)`
                      }}
                    />
                  </div>
                </div>

                {/* Return Rates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-warmText-tertiary mb-1.5">
                      Rendimento Investimenti (% annuo)
                    </label>
                    <p className="text-xs text-warmText-disabled mb-1">Rendimento medio annuo atteso (es. 7% per ETF globale)</p>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={config.investmentReturnRate || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          investmentReturnRate: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                      placeholder="0"
                      className="w-full h-11 px-3 bg-warmBg-tertiary border border-warmBg-hover text-warmText-primary rounded-xl text-sm focus:border-warmData-investment focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-warmText-tertiary mb-1.5">
                      Rendimento Risparmi (% annuo)
                    </label>
                    <p className="text-xs text-warmText-disabled mb-1">Interessi sul conto (es. 1-3% per depositi vincolati)</p>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={config.savingsReturnRate || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          savingsReturnRate: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                      placeholder="0"
                      className="w-full h-11 px-3 bg-warmBg-tertiary border border-warmBg-hover text-warmText-primary rounded-xl text-sm focus:border-warmData-savings focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-20 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Milestone Table */}
          <MilestoneTable
            milestones={config.milestones!}
            expenseRows={config.expenseRows || []}
            startYear={config.startYear}
            onMilestonesChange={(milestones) => setConfig({ ...config, milestones })}
            onExpenseRowsChange={(expenseRows) => setConfig({ ...config, expenseRows })}
          />

          {/* Debts List */}
          <div className="bg-warmBg-secondary rounded-xl border border-warmBg-tertiary p-6">
            <DebtsList
              debts={config.debts || []}
              maxYear={config.horizonYears}
              startYear={config.startYear}
              onChange={(debts) => setConfig({ ...config, debts })}
            />
          </div>

          {/* Chart Section */}
          {result && (
            <SimulatorChart
              result={result}
              events={config.debts || []}
              inflationRate={config.inflationRate}
              startYear={config.startYear}
            />
          )}

          {/* Results Summary Section */}
          {result && (
            <div className="bg-warmBg-secondary rounded-xl border border-warmBg-tertiary p-6">
              <ResultsSummary result={result} inflationRate={config.inflationRate} startYear={config.startYear} />
            </div>
          )}

          {/* Milestones and Warnings Section */}
          {result && (
            <div className="bg-warmBg-secondary rounded-xl border border-warmBg-tertiary p-6">
              <MilestonesCards
                result={result}
                monthlyIncome={config.milestones?.year5.salary || 3000}
                startYear={config.startYear}
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <SaveSimulationDialog
          onClose={() => setShowSaveDialog(false)}
          onSave={handleSaveSimulation}
        />
      )}
    </div>
  );
}
