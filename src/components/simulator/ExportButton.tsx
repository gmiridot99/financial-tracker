'use client';

import React, { useState } from 'react';
import { Download, FileText, Table, Link2, Loader2 } from 'lucide-react';
import type { SimulationResult, SimulationConfig } from '@/lib/simulator/types';
import { displayYear } from '@/lib/dateUtils';

interface ExportButtonProps {
  result: SimulationResult | null;
  config: SimulationConfig | null;
}

export default function ExportButton({ result, config }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!result || !config) {
    return null;
  }

  // Export to CSV
  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Year',
        'Investments',
        'Savings',
        'Total Assets',
        'Total Debts',
        'Net Wealth',
        'Real Wealth',
      ];

      const rows = result.yearlySnapshots.map((snapshot) => [
        snapshot.year,
        snapshot.investments.toFixed(2),
        snapshot.savings.toFixed(2),
        snapshot.totalAssets.toFixed(2),
        snapshot.totalDebts.toFixed(2),
        snapshot.netWealth.toFixed(2),
        snapshot.realWealth.toFixed(2),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `simulation_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export CSV error:', error);
      alert('Errore durante l\'export CSV');
    } finally {
      setIsExporting(false);
      setShowMenu(false);
    }
  };

  // Export configuration as JSON
  const exportConfiguration = () => {
    setIsExporting(true);
    try {
      const configData = JSON.stringify(config, null, 2);
      const blob = new Blob([configData], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `simulation_config_${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export config error:', error);
      alert('Errore durante l\'export della configurazione');
    } finally {
      setIsExporting(false);
      setShowMenu(false);
    }
  };

  // Copy configuration to clipboard
  const copyConfiguration = async () => {
    setIsExporting(true);
    try {
      const configData = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(configData);
      alert('Configurazione copiata negli appunti!');
    } catch (error) {
      console.error('Copy config error:', error);
      alert('Errore durante la copia della configurazione');
    } finally {
      setIsExporting(false);
      setShowMenu(false);
    }
  };

  // Export detailed report as text
  const exportReport = () => {
    setIsExporting(true);
    try {
      const finalSnapshot = result.yearlySnapshots[result.yearlySnapshots.length - 1];

      let report = `SIMULAZIONE FINANZIARIA - REPORT COMPLETO\n`;
      report += `==============================================\n\n`;
      report += `Data generazione: ${new Date().toLocaleString('it-IT')}\n`;
      report += `Orizzonte temporale: ${config.horizonYears} anni\n`;
      if (config.startYear) {
        report += `Anno di inizio: ${config.startYear}\n`;
      }
      report += `Tasso inflazione: ${config.inflationRate}%\n\n`;

      report += `PATRIMONIO INIZIALE\n`;
      report += `-------------------\n`;
      report += `Investments: €${config.initialInvestments.toLocaleString('it-IT')}\n`;
      report += `Savings: €${config.initialSavings.toLocaleString('it-IT')}\n`;
      report += `Totale: €${(config.initialInvestments + config.initialSavings).toLocaleString('it-IT')}\n\n`;

      report += `PATRIMONIO FINALE (${displayYear(finalSnapshot.year, config.startYear)})\n`;
      report += `-------------------\n`;
      report += `Investments: €${finalSnapshot.investments.toLocaleString('it-IT')}\n`;
      report += `Savings: €${finalSnapshot.savings.toLocaleString('it-IT')}\n`;
      const finalAssetsValue = finalSnapshot.assets.reduce((sum, a) => sum + a.currentValue, 0);
      report += `Assets illiquidi: €${finalAssetsValue.toLocaleString('it-IT')}\n`;
      report += `Totale Assets: €${finalSnapshot.totalAssets.toLocaleString('it-IT')}\n`;
      report += `Debiti: €${finalSnapshot.totalDebts.toLocaleString('it-IT')}\n`;
      report += `Net Wealth (nominale): €${finalSnapshot.netWealth.toLocaleString('it-IT')}\n`;
      report += `Real Wealth (valore reale): €${finalSnapshot.realWealth.toLocaleString('it-IT')}\n\n`;

      const nominalGrowth = ((finalSnapshot.netWealth / (config.initialInvestments + config.initialSavings)) - 1) * 100;
      const realGrowth = ((finalSnapshot.realWealth / (config.initialInvestments + config.initialSavings)) - 1) * 100;

      report += `CRESCITA\n`;
      report += `--------\n`;
      report += `Crescita nominale: +${nominalGrowth.toFixed(1)}%\n`;
      report += `Crescita reale: +${realGrowth.toFixed(1)}%\n`;
      report += `Perdita potere d'acquisto: €${(finalSnapshot.netWealth - finalSnapshot.realWealth).toLocaleString('it-IT')}\n\n`;

      // Check if using new milestone-based config or legacy phase-based config
      if ('milestones' in config && config.milestones) {
        report += `CONFIGURAZIONE MILESTONE\n`;
        report += `------------------------\n`;
        report += `Allocazione globale: ${config.allocationInvestments}% Inv / ${config.allocationSavings}% Sav\n`;
        report += `Rendimento Inv: ${config.investmentReturnRate}% | Sav: ${config.savingsReturnRate}%\n\n`;
        report += `Milestone (Stipendio):\n`;
        report += `  Anno 1:  €${config.milestones.year1.salary.toLocaleString('it-IT')}\n`;
        report += `  Anno 5:  €${config.milestones.year5.salary.toLocaleString('it-IT')}\n`;
        report += `  Anno 10: €${config.milestones.year10.salary.toLocaleString('it-IT')}\n`;
        report += `  Anno 20: €${config.milestones.year20.salary.toLocaleString('it-IT')}\n`;
        report += `  Anno 30: €${config.milestones.year30.salary.toLocaleString('it-IT')}\n`;
        report += `  Anno 50: €${config.milestones.year50.salary.toLocaleString('it-IT')}\n\n`;

        if (config.expenseRows && config.expenseRows.length > 0) {
          report += `SPESE PER CATEGORIA\n`;
          report += `--------------------\n`;
          config.expenseRows.forEach((row) => {
            report += `${row.label}:\n`;
            report += `  Anno 1: €${row.amounts.year1.toLocaleString('it-IT')} | `;
            report += `Anno 5: €${row.amounts.year5.toLocaleString('it-IT')} | `;
            report += `Anno 10: €${row.amounts.year10.toLocaleString('it-IT')} | `;
            report += `Anno 20: €${row.amounts.year20.toLocaleString('it-IT')} | `;
            report += `Anno 30: €${row.amounts.year30.toLocaleString('it-IT')} | `;
            report += `Anno 50: €${row.amounts.year50.toLocaleString('it-IT')}\n`;
          });
          report += `\n`;
        }

        if ('debts' in config && config.debts && config.debts.length > 0) {
          report += `DEBITI/ACQUISTI\n`;
          report += `---------------\n`;
          config.debts.forEach((debt) => {
            report += `${displayYear(debt.year, config.startYear)} - ${debt.name}:\n`;
            report += `  Valore totale: €${debt.totalValue.toLocaleString('it-IT')}\n`;
            report += `  Cash payment: €${debt.cashPayment.toLocaleString('it-IT')}\n`;
            report += `  Debito: €${debt.debtAmount.toLocaleString('it-IT')} (${debt.durationYears} anni @ ${debt.interestRate}%)\n`;
            if (debt.appreciationRate) {
              report += `  Rivalutazione: ${debt.appreciationRate}%/anno\n`;
            }
            if (debt.sale) {
              report += `  VENDITA PIANIFICATA:\n`;
              report += `    Anno: ${displayYear(debt.sale.year, config.startYear)}\n`;
              report += `    Prezzo vendita: €${debt.sale.salePrice.toLocaleString('it-IT')}\n`;
              report += `    Surplus → ${debt.sale.allocationInvestments}% Inv / ${debt.sale.allocationSavings}% Sav\n`;
            }
            report += `\n`;
          });
        }
      } else if ('phases' in config && config.phases) {
        report += `FASI TEMPORALI\n`;
        report += `--------------\n`;
        config.phases.forEach((phase, index) => {
          report += `Fase ${index + 1} (Anni ${phase.startYear}-${phase.endYear}):\n`;
          report += `  Reddito mensile: €${phase.monthlyIncome.toLocaleString('it-IT')}\n`;
          report += `  Spese mensili: €${phase.monthlyExpenses.toLocaleString('it-IT')}\n`;
          report += `  Allocazione: ${phase.allocationInvestments}% Inv / ${phase.allocationSavings}% Sav\n`;
          report += `  Rendimento Inv: ${phase.investmentReturnRate}% | Sav: ${phase.savingsReturnRate}%\n\n`;
        });

        if ('events' in config && config.events && config.events.length > 0) {
          report += `EVENTI\n`;
          report += `------\n`;
          config.events.forEach((event) => {
            if (event.type === 'purchase') {
              report += `Anno ${event.year} - Acquisto ${event.assetName || 'Asset'}:\n`;
              report += `  Prezzo: €${(event.purchasePrice || 0).toLocaleString('it-IT')}\n`;
              report += `  Anticipo: €${(event.downPayment || 0).toLocaleString('it-IT')}\n`;
              report += `  Debito: €${(event.debtAmount || 0).toLocaleString('it-IT')} (${event.debtDuration || 0} anni @ ${event.debtInterestRate || 0}%)\n`;
              report += `  Rivalutazione: ${event.assetAppreciationRate || 0}%/anno\n\n`;
            } else if (event.type === 'sale') {
              report += `Anno ${event.year} - Vendita ${event.saleAssetId || 'Asset'}:\n`;
              report += `  Allocazione surplus: ${event.surplusAllocation?.investmentsPercent || 0}% Inv / ${event.surplusAllocation?.savingsPercent || 0}% Sav\n\n`;
            }
          });
        }
      }

      report += `EVOLUZIONE ANNO PER ANNO\n`;
      report += `========================\n\n`;
      result.yearlySnapshots.forEach((snapshot) => {
        const assetsValue = snapshot.assets.reduce((sum, a) => sum + a.currentValue, 0);
        report += `${displayYear(snapshot.year, config.startYear)}:\n`;
        report += `  Inv: €${snapshot.investments.toLocaleString('it-IT')} | `;
        report += `Sav: €${snapshot.savings.toLocaleString('it-IT')} | `;
        report += `Assets: €${assetsValue.toLocaleString('it-IT')} | `;
        report += `Debiti: €${snapshot.totalDebts.toLocaleString('it-IT')}\n`;
        report += `  Net Wealth: €${snapshot.netWealth.toLocaleString('it-IT')} | `;
        report += `Real Wealth: €${snapshot.realWealth.toLocaleString('it-IT')}\n\n`;
      });

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `simulation_report_${new Date().toISOString().split('T')[0]}.txt`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export report error:', error);
      alert('Errore durante l\'export del report');
    } finally {
      setIsExporting(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-warmData-investment hover:bg-warmData-investment hover:brightness-110 text-warmText-primary rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span className="font-medium">Esporta</span>
      </button>

      {showMenu && (
        <>
          {/* Overlay to close menu when clicking outside */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Export menu */}
          <div className="absolute right-0 mt-2 w-64 bg-warmBg-secondary rounded-lg border border-warmBg-tertiary z-20 overflow-hidden">
            <div className="p-2">
              <button
                onClick={exportReport}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-warmText-primary hover:bg-warmBg-tertiary rounded-md transition-colors"
              >
                <FileText className="w-5 h-5 text-warmData-investment" />
                <div>
                  <div className="font-medium text-sm">Report Completo</div>
                  <div className="text-xs text-warmText-tertiary">
                    File .txt con tutti i dettagli
                  </div>
                </div>
              </button>

              <button
                onClick={exportToCSV}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-warmText-primary hover:bg-warmBg-tertiary rounded-md transition-colors"
              >
                <Table className="w-5 h-5 text-warmData-income" />
                <div>
                  <div className="font-medium text-sm">Dati CSV</div>
                  <div className="text-xs text-warmText-tertiary">
                    Tabella anno-per-anno per Excel
                  </div>
                </div>
              </button>

              <button
                onClick={exportConfiguration}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-warmText-primary hover:bg-warmBg-tertiary rounded-md transition-colors"
              >
                <Download className="w-5 h-5 text-warmData-savings" />
                <div>
                  <div className="font-medium text-sm">Configurazione JSON</div>
                  <div className="text-xs text-warmText-tertiary">
                    Salva configurazione per riutilizzo
                  </div>
                </div>
              </button>

              <button
                onClick={copyConfiguration}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-warmText-primary hover:bg-warmBg-tertiary rounded-md transition-colors"
              >
                <Link2 className="w-5 h-5 text-warmAccent-primary" />
                <div>
                  <div className="font-medium text-sm">Copia Config</div>
                  <div className="text-xs text-warmText-tertiary">
                    Copia negli appunti per condividere
                  </div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
