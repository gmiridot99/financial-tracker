'use client';

import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Building2, CreditCard, Wallet } from 'lucide-react';
import { SimulationResult } from '@/lib/simulator/types';
import { displayYear } from '@/lib/dateUtils';

interface ResultsSummaryProps {
  result: SimulationResult;
  inflationRate: number;
  startYear?: number;
}

export default function ResultsSummary({ result, inflationRate, startYear }: ResultsSummaryProps) {
  const finalYear = result.yearlySnapshots[result.yearlySnapshots.length - 1];

  if (!finalYear) {
    return null;
  }

  const totalAssets = finalYear.totalAssets || 0;
  const totalDebts = finalYear.totalDebts || 0;
  const netWealth = finalYear.netWealth;
  const realWealth = finalYear.realWealth;
  const investments = finalYear.investments;
  const savings = finalYear.savings;

  // Calculate purchasing power loss
  const purchasingPowerLoss = ((netWealth - realWealth) / netWealth) * 100;

  // Calculate total growth
  const initialWealth = result.yearlySnapshots[0].netWealth;
  const totalGrowth = ((netWealth - initialWealth) / initialWealth) * 100;
  const realGrowth = ((realWealth - initialWealth) / initialWealth) * 100;

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1_000_000) {
      return `\u20AC${(value / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1_000) {
      return `\u20AC${(value / 1_000).toFixed(1)}k`;
    }
    return `\u20AC${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-warmText-primary">Risultati Simulazione</h2>
        <div className="text-sm text-warmText-tertiary">
          Anno finale: <span className="font-semibold text-warmText-secondary">{displayYear(finalYear.year, startYear)}</span>
        </div>
      </div>

      {/* Main Wealth Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Net Wealth (Nominal) */}
        <div className="bg-warmData-income bg-opacity-10 border border-warmData-income border-opacity-20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-warmData-income" />
              <h3 className="text-sm font-medium text-warmData-income" title="Somma di investimenti, risparmi e immobili, meno i debiti residui">Patrimonio Netto</h3>
            </div>
            <TrendingUp className="w-5 h-5 text-warmData-income" />
          </div>
          <div className="text-3xl font-bold text-warmText-primary mb-1">
            {formatCurrency(netWealth)}
          </div>
          <div className="text-sm text-warmText-tertiary">
            Valore nominale &bull; {formatPercent(totalGrowth)} crescita
          </div>
        </div>

        {/* Real Wealth */}
        <div className="bg-[#3b82f6] bg-opacity-10 border border-[#3b82f6] border-opacity-20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#60a5fa]" />
              <h3 className="text-sm font-medium text-[#60a5fa]" title="Quanto varrebbe il patrimonio futuro in euro di oggi, considerando l'inflazione">Patrimonio Reale</h3>
            </div>
            <TrendingDown className="w-5 h-5 text-[#60a5fa]" />
          </div>
          <div className="text-3xl font-bold text-warmText-primary mb-1">
            {formatCurrency(realWealth)}
          </div>
          <div className="text-sm text-warmText-tertiary">
            Potere d&apos;acquisto oggi &bull; {formatPercent(realGrowth)} crescita reale
          </div>
        </div>
      </div>

      {/* Components Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Investments */}
        <div className="bg-warmBg-tertiary border border-warmBg-hover rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#8b5cf6]" />
            <h4 className="text-xs font-medium text-warmText-tertiary">Investimenti</h4>
          </div>
          <div className="text-xl font-bold text-[#a78bfa]">
            {formatCurrency(investments)}
          </div>
          <div className="text-xs text-warmText-tertiary mt-1">
            {((investments / netWealth) * 100).toFixed(1)}% del totale
          </div>
          <div className="text-xs text-warmText-tertiary mt-1 hidden md:block">
            ETF, azioni, fondi, obbligazioni
          </div>
        </div>

        {/* Savings */}
        <div className="bg-warmBg-tertiary border border-warmBg-hover rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-warmData-savings" />
            <h4 className="text-xs font-medium text-warmText-tertiary">Risparmi</h4>
          </div>
          <div className="text-xl font-bold text-warmData-savings">
            {formatCurrency(savings)}
          </div>
          <div className="text-xs text-warmText-tertiary mt-1">
            {((savings / netWealth) * 100).toFixed(1)}% del totale
          </div>
          <div className="text-xs text-warmText-tertiary mt-1 hidden md:block">
            Conto corrente, depositi, contanti
          </div>
        </div>

        {/* Assets */}
        <div className="bg-warmBg-tertiary border border-warmBg-hover rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-warmData-investment" />
            <h4 className="text-xs font-medium text-warmText-tertiary">Immobili</h4>
          </div>
          <div className="text-xl font-bold text-warmData-investment">
            {formatCurrency(totalAssets)}
          </div>
          <div className="text-xs text-warmText-tertiary mt-1">
            {totalAssets > 0 ? `${((totalAssets / (netWealth + totalDebts)) * 100).toFixed(1)}% del totale` : 'Nessuno'}
          </div>
          <div className="text-xs text-warmText-tertiary mt-1 hidden md:block">
            Case, terreni, immobili di propriet&agrave;
          </div>
        </div>

        {/* Debts */}
        <div className="bg-warmBg-tertiary border border-warmBg-hover rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-warmData-expense" />
            <h4 className="text-xs font-medium text-warmText-tertiary">Debiti</h4>
          </div>
          <div className="text-xl font-bold text-warmData-expense">
            {totalDebts > 0 ? `-${formatCurrency(totalDebts)}` : '\u20AC0'}
          </div>
          <div className="text-xs text-warmText-tertiary mt-1">
            {totalDebts > 0 ? 'Da saldare' : 'Nessuno'}
          </div>
          <div className="text-xs text-warmText-tertiary mt-1 hidden md:block">
            Mutui, prestiti, finanziamenti
          </div>
        </div>
      </div>

      {/* Inflation Impact */}
      <div className="bg-warmData-investment bg-opacity-10 border border-warmData-investment border-opacity-20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-warmData-investment" />
          <h4 className="text-sm font-medium text-warmData-investment">Impatto dell&apos;Inflazione</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Tasso Inflazione</div>
            <div className="font-semibold text-warmText-primary">{inflationRate.toFixed(2)}% annuo</div>
          </div>
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Perdita Potere d&apos;Acquisto</div>
            <div className="font-semibold text-warmText-primary">
              {formatCurrency(netWealth - realWealth)} ({purchasingPowerLoss.toFixed(1)}%)
            </div>
          </div>
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Equivalente Oggi</div>
            <div className="font-semibold text-warmText-primary">{formatCurrency(realWealth)}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-warmText-tertiary">
          Il valore reale mostra quanto varr&agrave; il tuo patrimonio futuro in termini di potere d&apos;acquisto odierno,
          considerando un&apos;inflazione media del {inflationRate}% annuo.
        </div>
      </div>

      {/* Glossary */}
      <div className="bg-warmBg-tertiary border border-warmBg-hover rounded-xl p-4">
        <h4 className="text-sm font-medium text-warmText-primary mb-3">Glossario</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs text-warmText-secondary">
          <div><strong className="text-[#a78bfa]">Investimenti</strong> &mdash; Capitale investito in strumenti finanziari (ETF, azioni, fondi, obbligazioni)</div>
          <div><strong className="text-warmData-savings">Risparmi</strong> &mdash; Liquidit&agrave; disponibile su conto corrente, depositi e contanti</div>
          <div><strong className="text-warmData-investment">Immobili</strong> &mdash; Valore degli immobili di propriet&agrave; (case, terreni)</div>
          <div><strong className="text-warmData-expense">Debiti</strong> &mdash; Mutui, prestiti e finanziamenti ancora da rimborsare</div>
          <div><strong className="text-warmData-income">Patrimonio Netto</strong> &mdash; Investimenti + Risparmi + Immobili &minus; Debiti</div>
          <div><strong className="text-[#60a5fa]">Patrimonio Reale</strong> &mdash; Quanto vale il patrimonio futuro in euro di oggi, al netto dell&apos;inflazione</div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-warmBg-tertiary border border-warmBg-hover rounded-xl p-4">
        <h4 className="text-sm font-medium text-warmText-primary mb-3">Riepilogo Crescita</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Capitale Iniziale</div>
            <div className="font-semibold text-warmText-primary">{formatCurrency(initialWealth)}</div>
          </div>
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Capitale Finale</div>
            <div className="font-semibold text-warmText-primary">{formatCurrency(netWealth)}</div>
          </div>
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Crescita Nominale</div>
            <div className={`font-semibold ${totalGrowth >= 0 ? 'text-warmData-income' : 'text-warmData-expense'}`}>
              {formatPercent(totalGrowth)}
            </div>
          </div>
          <div>
            <div className="text-xs text-warmText-tertiary mb-1">Crescita Reale</div>
            <div className={`font-semibold ${realGrowth >= 0 ? 'text-warmData-income' : 'text-warmData-expense'}`}>
              {formatPercent(realGrowth)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
