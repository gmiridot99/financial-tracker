'use client';

import React from 'react';
import { Trophy, AlertTriangle, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { SimulationResult } from '@/lib/simulator/types';
import { displayYear } from '@/lib/dateUtils';

interface MilestonesCardsProps {
  result: SimulationResult;
  monthlyIncome: number; // Used to calculate debt exposure warnings
  startYear?: number;
}

interface Milestone {
  amount: number;
  label: string;
  year: number | null;
  achieved: boolean;
}

interface Warning {
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  icon: React.ReactNode;
}

export default function MilestonesCards({ result, monthlyIncome, startYear }: MilestonesCardsProps) {
  const milestones: Milestone[] = [
    { amount: 100_000, label: '\u20AC100k', year: null, achieved: false },
    { amount: 250_000, label: '\u20AC250k', year: null, achieved: false },
    { amount: 500_000, label: '\u20AC500k', year: null, achieved: false },
    { amount: 1_000_000, label: '\u20AC1M', year: null, achieved: false },
  ];

  // Find when each milestone is achieved
  milestones.forEach(milestone => {
    const snapshot = result.yearlySnapshots.find(s => s.netWealth >= milestone.amount);
    if (snapshot) {
      milestone.year = snapshot.year;
      milestone.achieved = true;
    }
  });

  // Generate warnings
  const warnings: Warning[] = [];
  const finalYear = result.yearlySnapshots[result.yearlySnapshots.length - 1];
  const firstYear = result.yearlySnapshots[0];

  // Warning: High debt exposure
  if (finalYear.totalDebts && monthlyIncome > 0) {
    const debtToIncomeRatio = (finalYear.totalDebts / 12) / monthlyIncome;
    if (debtToIncomeRatio > 0.4) {
      warnings.push({
        type: 'danger',
        title: 'Esposizione Debitoria Elevata',
        message: `I tuoi debiti finali rappresentano ${(debtToIncomeRatio * 100).toFixed(0)}% del reddito annuo. Si consiglia di mantenere questo rapporto sotto il 40%.`,
        icon: <AlertTriangle className="w-5 h-5" />,
      });
    } else if (debtToIncomeRatio > 0.3) {
      warnings.push({
        type: 'warning',
        title: 'Debiti Moderati',
        message: `I tuoi debiti rappresentano ${(debtToIncomeRatio * 100).toFixed(0)}% del reddito annuo. Monitora attentamente questa percentuale.`,
        icon: <AlertTriangle className="w-5 h-5" />,
      });
    }
  }

  // Warning: Real wealth declining
  const realWealthGrowth = ((finalYear.realWealth - firstYear.netWealth) / firstYear.netWealth) * 100;
  if (realWealthGrowth < 0) {
    warnings.push({
      type: 'danger',
      title: 'Patrimonio Reale in Calo',
      message: `Il tuo patrimonio reale (corretto per inflazione) sta diminuendo del ${Math.abs(realWealthGrowth).toFixed(1)}%. I tuoi risparmi stanno perdendo potere d'acquisto.`,
      icon: <TrendingUp className="w-5 h-5 rotate-180" />,
    });
  } else if (realWealthGrowth < 10) {
    warnings.push({
      type: 'warning',
      title: 'Crescita Reale Bassa',
      message: `Il tuo patrimonio reale cresce solo del ${realWealthGrowth.toFixed(1)}%. Considera investimenti con rendimenti superiori all'inflazione.`,
      icon: <TrendingUp className="w-5 h-5" />,
    });
  }

  // Warning: Savings losing value
  const savingsRatio = finalYear.savings / finalYear.netWealth;
  if (savingsRatio > 0.5 && finalYear.netWealth > 50000) {
    warnings.push({
      type: 'warning',
      title: 'Troppa Liquidit\u00E0',
      message: `Oltre il ${(savingsRatio * 100).toFixed(0)}% del tuo patrimonio \u00E8 in liquidit\u00E0. Considera di investire parte dei risparmi per proteggerti dall'inflazione.`,
      icon: <Clock className="w-5 h-5" />,
    });
  }

  // Info: Good diversification
  if (savingsRatio > 0.1 && savingsRatio < 0.3 && finalYear.investments > finalYear.savings) {
    warnings.push({
      type: 'info',
      title: 'Buona Diversificazione',
      message: `Hai un buon equilibrio tra investimenti (${((finalYear.investments / finalYear.netWealth) * 100).toFixed(0)}%) e liquidit\u00E0 (${(savingsRatio * 100).toFixed(0)}%).`,
      icon: <CheckCircle2 className="w-5 h-5" />,
    });
  }

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1_000_000) {
      return `\u20AC${(value / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1_000) {
      return `\u20AC${(value / 1_000).toFixed(1)}k`;
    }
    return `\u20AC${value.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      {/* Milestones */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-warmData-investment" />
          <h2 className="text-xl font-bold text-warmText-primary">Traguardi Patrimoniali</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {milestones.map((milestone, index) => (
            <div
              key={index}
              className={`rounded-xl p-4 border ${
                milestone.achieved
                  ? 'bg-warmData-income bg-opacity-10 border-warmData-income border-opacity-30'
                  : 'bg-warmBg-tertiary border-warmBg-hover'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`text-lg font-bold ${
                  milestone.achieved ? 'text-warmData-income' : 'text-warmText-disabled'
                }`}>
                  {milestone.label}
                </div>
                {milestone.achieved ? (
                  <CheckCircle2 className="w-5 h-5 text-warmData-income" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-warmText-disabled" />
                )}
              </div>
              <div className={`text-sm ${
                milestone.achieved ? 'text-warmData-income' : 'text-warmText-disabled'
              }`}>
                {milestone.achieved ? (
                  <span className="font-semibold">{displayYear(milestone.year!, startYear)}</span>
                ) : (
                  'Non raggiunto'
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 bg-warmAccent-primary bg-opacity-10 border border-warmAccent-primary border-opacity-20 rounded-xl p-3">
          <div className="text-sm text-warmText-secondary">
            <span className="font-semibold text-warmAccent-primary">
              {milestones.filter(m => m.achieved).length}/{milestones.length}
            </span>{' '}
            traguardi raggiunti entro il {displayYear(finalYear.year, startYear)}
          </div>
        </div>
      </div>

      {/* Warnings and Insights */}
      {warnings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warmData-investment" />
            <h2 className="text-xl font-bold text-warmText-primary">Insights e Avvisi</h2>
          </div>
          <div className="space-y-3">
            {warnings.map((warning, index) => (
              <div
                key={index}
                className={`rounded-xl p-4 border ${
                  warning.type === 'danger'
                    ? 'bg-warmData-expense bg-opacity-10 border-warmData-expense border-opacity-20'
                    : warning.type === 'warning'
                    ? 'bg-warmData-investment bg-opacity-10 border-warmData-investment border-opacity-20'
                    : 'bg-warmData-savings bg-opacity-10 border-warmData-savings border-opacity-20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={
                    warning.type === 'danger'
                      ? 'text-warmData-expense'
                      : warning.type === 'warning'
                      ? 'text-warmData-investment'
                      : 'text-warmData-savings'
                  }>
                    {warning.icon}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold mb-1 ${
                      warning.type === 'danger'
                        ? 'text-warmData-expense'
                        : warning.type === 'warning'
                        ? 'text-warmData-investment'
                        : 'text-warmData-savings'
                    }`}>
                      {warning.title}
                    </div>
                    <div className="text-sm text-warmText-secondary">
                      {warning.message}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="bg-warmBg-tertiary border border-warmBg-hover rounded-xl p-4">
        <h3 className="text-sm font-semibold text-warmText-primary mb-3">Metriche Chiave</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Patrimonio Finale</div>
            <div className="font-semibold text-warmText-primary">{formatCurrency(finalYear.netWealth)}</div>
          </div>
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Valore Reale (oggi)</div>
            <div className="font-semibold text-warmText-primary">{formatCurrency(finalYear.realWealth)}</div>
          </div>
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Anni Simulati</div>
            <div className="font-semibold text-warmText-primary">
              {result.yearlySnapshots.length} anni
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
