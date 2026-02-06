'use client';

import { useState, useMemo } from 'react';
import { DebtInput } from '@/lib/simulator/types';
import { Home, X, ArrowUpRight, Calculator } from 'lucide-react';
import { generateId } from '@/lib/simulator/calculations';

interface InlineDebtFormProps {
  debt?: DebtInput; // If provided, we're editing
  maxYear: number;
  startYear?: number;
  onSave: (debt: DebtInput) => void;
  onCancel: () => void;
}

// Helper: parse numeric input allowing empty string
function numVal(v: string | number): string {
  if (v === 0 || v === '' || v === undefined || v === null) return '';
  return String(v);
}
function parseNum(v: string): number {
  if (v === '' || v === undefined || v === null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

const inputCls =
  'w-full h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:border-warmData-expense focus:ring-2 focus:ring-warmData-expense focus:ring-opacity-20 transition-all';

const inputClsIncome =
  'w-full h-11 px-3 bg-warmBg-primary rounded-xl border border-warmText-muted text-warmText-primary text-sm focus:border-warmData-income focus:ring-2 focus:ring-warmData-income focus:ring-opacity-20 transition-all';

export default function InlineDebtForm({
  debt,
  maxYear,
  startYear,
  onSave,
  onCancel,
}: InlineDebtFormProps) {
  const [name, setName] = useState(debt?.name || '');
  const [year, setYear] = useState(debt?.year || 1);
  const [totalValue, setTotalValue] = useState<string>(numVal(debt?.totalValue || 0));
  const [cashPayment, setCashPayment] = useState<string>(numVal(debt?.cashPayment || 0));
  const [interestRate, setInterestRate] = useState<string>(numVal(debt?.interestRate ?? 3));
  const [durationYears, setDurationYears] = useState<string>(numVal(debt?.durationYears ?? 30));
  const [appreciationRate, setAppreciationRate] = useState<string>(numVal(debt?.appreciationRate || 0));
  const [showSale, setShowSale] = useState(!!debt?.sale);
  const [saleYear, setSaleYear] = useState(debt?.sale?.year || (year + 5));
  const [salePrice, setSalePrice] = useState<string>(numVal(debt?.sale?.salePrice || 0));
  const [saleAllocInv, setSaleAllocInv] = useState(debt?.sale?.allocationInvestments || 60);
  const [saleAllocSav, setSaleAllocSav] = useState(debt?.sale?.allocationSavings || 40);

  // Parsed numeric values
  const totalValueNum = parseNum(totalValue);
  const cashPaymentNum = parseNum(cashPayment);
  const interestRateNum = parseNum(interestRate);
  const durationYearsNum = parseNum(durationYears);
  const appreciationRateNum = parseNum(appreciationRate);
  const salePriceNum = parseNum(salePrice);

  // Auto-calculate debt amount
  const debtAmount = Math.max(0, totalValueNum - cashPaymentNum);

  // Build year options: from year 1 to maxYear, showing "YYYY - X anni"
  const yearOptions = useMemo(() => {
    const options: { value: number; label: string }[] = [];
    for (let y = 1; y <= maxYear; y++) {
      const displayYr = startYear ? startYear + y - 1 : y;
      const diff = y - 1;
      let label: string;
      if (diff === 0) {
        label = `${displayYr} - Anno inizio`;
      } else if (diff === 1) {
        label = `${displayYr} - 1 anno`;
      } else {
        label = `${displayYr} - ${diff} anni`;
      }
      options.push({ value: y, label });
    }
    return options;
  }, [maxYear, startYear]);

  // Build sale year options (must be after purchase year)
  const saleYearOptions = useMemo(() => {
    const options: { value: number; label: string }[] = [];
    for (let y = year + 1; y <= maxYear; y++) {
      const displayYr = startYear ? startYear + y - 1 : y;
      const diff = y - 1;
      let label: string;
      if (diff === 0) {
        label = `${displayYr} - Anno inizio`;
      } else if (diff === 1) {
        label = `${displayYr} - 1 anno`;
      } else {
        label = `${displayYr} - ${diff} anni`;
      }
      options.push({ value: y, label });
    }
    return options;
  }, [year, maxYear, startYear]);

  // Auto-calculate estimated sale price based on appreciation
  const handleCalculateSalePrice = () => {
    if (totalValueNum <= 0) return;
    const yearsHeld = saleYear - year;
    if (yearsHeld <= 0) return;
    const rate = appreciationRateNum > 0 ? appreciationRateNum : 0;
    const estimated = totalValueNum * Math.pow(1 + rate / 100, yearsHeld);
    setSalePrice(Math.round(estimated).toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Inserisci un nome per il debito');
      return;
    }

    if (totalValueNum <= 0) {
      alert('Il valore totale deve essere maggiore di zero');
      return;
    }

    if (cashPaymentNum < 0 || cashPaymentNum > totalValueNum) {
      alert('Il pagamento cash deve essere tra 0 e il valore totale');
      return;
    }

    if (year < 1 || year > maxYear) {
      alert(`L'anno deve essere tra 1 e ${maxYear}`);
      return;
    }

    if (interestRateNum < 0 || interestRateNum > 100) {
      alert('Il tasso di interesse deve essere tra 0 e 100%');
      return;
    }

    if (durationYearsNum < 1 || durationYearsNum > 50) {
      alert('La durata deve essere tra 1 e 50 anni');
      return;
    }

    const newDebt: DebtInput = {
      id: debt?.id || generateId(),
      name: name.trim(),
      year,
      totalValue: totalValueNum,
      cashPayment: cashPaymentNum,
      debtAmount,
      interestRate: interestRateNum,
      durationYears: durationYearsNum,
      appreciationRate: appreciationRateNum > 0 ? appreciationRateNum : undefined,
      sale: showSale ? {
        year: saleYear,
        salePrice: salePriceNum,
        allocationInvestments: saleAllocInv,
        allocationSavings: saleAllocSav,
      } : undefined,
    };

    onSave(newDebt);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-warmBg-tertiary rounded-2xl p-4 border border-warmData-expense border-opacity-20 animate-cardEnter"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-warmText-primary uppercase tracking-wider">
          {debt ? 'Modifica Debito' : 'Nuovo Debito'}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-warmText-tertiary hover:text-warmText-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Row 1: Name + Year */}
      <div className="grid grid-cols-2 gap-3 mb-3 min-w-0">
        <div>
          <label className="block text-xs text-warmText-tertiary mb-1.5">
            Nome
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Casa Milano"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-warmText-tertiary mb-1.5">
            Anno Acquisto
          </label>
          <select
            value={year}
            onChange={(e) => {
              const newYear = Number(e.target.value);
              setYear(newYear);
              // Auto-update sale year if it's now <= purchase year
              if (saleYear <= newYear) {
                setSaleYear(newYear + 1);
              }
            }}
            className={inputCls}
            required
          >
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Total Value + Cash Payment */}
      <div className="grid grid-cols-2 gap-3 mb-3 min-w-0">
        <div>
          <label className="block text-xs text-warmText-tertiary mb-1.5">
            Valore Totale (EUR)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={totalValue}
            onChange={(e) => setTotalValue(e.target.value)}
            placeholder="300000"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-warmText-tertiary mb-1.5">
            Pagamento Cash (EUR)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={cashPayment}
            onChange={(e) => setCashPayment(e.target.value)}
            placeholder="60000"
            className={inputCls}
            required
          />
        </div>
      </div>

      {/* Calculated Debt (readonly) */}
      <div className="mb-3 p-3 bg-warmBg-primary rounded-xl border border-warmData-expense border-opacity-20">
        <div className="flex justify-between items-center">
          <span className="text-xs text-warmText-tertiary">Debito Rimanente</span>
          <span className="text-lg font-bold text-warmData-expense truncate">
            &euro;{debtAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Row 3: Interest Rate + Duration */}
      <div className="grid grid-cols-2 gap-3 mb-3 min-w-0">
        <div>
          <label className="block text-xs text-warmText-tertiary mb-1.5">
            Tasso Interesse (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="3.0"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-warmText-tertiary mb-1.5">
            Durata (anni)
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={durationYears}
            onChange={(e) => setDurationYears(e.target.value)}
            placeholder="30"
            className={inputCls}
            required
          />
        </div>
      </div>

      {/* Optional: Appreciation Rate (for real estate) */}
      <div className="mb-4">
        <label className="block text-xs text-warmText-tertiary mb-1.5">
          Rivalutazione Annua (%, opzionale - solo immobili)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={appreciationRate}
          onChange={(e) => setAppreciationRate(e.target.value)}
          placeholder="es. 2.0"
          className={inputCls}
        />
      </div>

      {/* Sale Configuration (optional) */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowSale(!showSale)}
          className="flex items-center gap-2 text-sm text-warmData-income hover:text-warmData-income/80 transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" />
          {showSale ? 'Rimuovi vendita pianificata' : 'Aggiungi vendita pianificata'}
        </button>

        {showSale && (
          <div className="mt-3 p-4 bg-warmData-income bg-opacity-5 rounded-xl border border-warmData-income border-opacity-20 animate-cardEnter">
            {/* Sale Year + Sale Price */}
            <div className="grid grid-cols-2 gap-3 mb-3 min-w-0">
              <div>
                <label className="block text-xs text-warmText-tertiary mb-1.5">
                  Anno Vendita
                </label>
                <select
                  value={saleYear}
                  onChange={(e) => setSaleYear(Number(e.target.value))}
                  className={inputClsIncome}
                  required
                >
                  {saleYearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-warmText-tertiary mb-1.5">
                  Prezzo Vendita Stimato (EUR)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder={totalValueNum > 0 && appreciationRateNum > 0
                      ? `~${Math.round(totalValueNum * Math.pow(1 + appreciationRateNum / 100, saleYear - year)).toLocaleString()}`
                      : '0'
                    }
                    className={`flex-1 ${inputClsIncome}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleCalculateSalePrice}
                    className="h-11 px-3 bg-warmData-income bg-opacity-20 text-warmData-income rounded-xl hover:bg-opacity-30 transition-all flex items-center gap-1.5 shrink-0"
                    title="Calcola prezzo con rivalutazione"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Surplus Allocation Slider */}
            <div>
              <label className="block text-xs text-warmText-tertiary mb-1.5">
                Allocazione Surplus
              </label>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-warmData-investment">
                  Investments: {saleAllocInv}%
                </span>
                <span className="text-sm font-medium text-warmData-savings">
                  Savings: {saleAllocSav}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={saleAllocInv}
                onChange={(e) => {
                  const inv = Number(e.target.value);
                  setSaleAllocInv(inv);
                  setSaleAllocSav(100 - inv);
                }}
                className="w-full h-2 bg-warmBg-tertiary rounded-full appearance-none cursor-pointer accent-warmData-investment"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-6 text-sm font-medium text-warmText-tertiary hover:text-warmText-secondary rounded-full transition-colors"
        >
          Annulla
        </button>
        <button
          type="submit"
          className="h-11 px-8 bg-warmData-expense text-warmBg-primary rounded-full text-sm font-semibold hover:opacity-90 transition-all"
        >
          Salva Debito
        </button>
      </div>
    </form>
  );
}
