'use client';

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';
import { usePacRules } from '@/hooks/usePacRules';
import { formatCurrency, parseEuropeanDecimal } from '@/hooks/useInvestmentAccounts';
import AssetSearchModal, { type AssetSearchResult } from '@/components/AssetSearchModal';
import type { PacRule } from '@/types/database';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────

interface PacRulesPanelProps {
  accountId: string;
  userId: string;
}

// ── Constants ────────────────────────────────────────────────────────

const TYPE_BADGE_STYLES: Record<string, string> = {
  stock: 'bg-blue-500/20 text-blue-300',
  etf: 'bg-emerald-500/20 text-emerald-300',
  crypto: 'bg-orange-500/20 text-orange-300',
  index: 'bg-purple-500/20 text-purple-300',
  bond: 'bg-gray-500/20 text-gray-300',
  commodity: 'bg-amber-500/20 text-amber-300',
};

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stock',
  etf: 'ETF',
  crypto: 'Crypto',
  index: 'Index',
  bond: 'Bond',
  commodity: 'Commodity',
};

// ── Component ────────────────────────────────────────────────────────

export default function PacRulesPanel({ accountId, userId }: PacRulesPanelProps) {
  const {
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    getRulesForAccount,
    getTotalPercentage,
  } = usePacRules({ userId });

  // ── Local state ──────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<AssetSearchResult | null>(null);
  const [percentageInput, setPercentageInput] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────
  const rules = getRulesForAccount(accountId);
  const totalPercentage = getTotalPercentage(accountId);
  const remainingPercentage = Math.round((100 - totalPercentage) * 100) / 100;
  const activeRulesCount = rules.filter(r => r.is_active).length;

  // ── Handlers ─────────────────────────────────────────────────────

  const handleAssetSelected = useCallback((asset: AssetSearchResult) => {
    setPendingAsset(asset);
    setPercentageInput('');
    setShowAssetSearch(false);
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    if (!pendingAsset) return;

    const pct = parseEuropeanDecimal(percentageInput);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast.error('Inserisci una percentuale valida (1-100)');
      return;
    }

    await addRule(
      accountId,
      { symbol: pendingAsset.symbol, name: pendingAsset.name, type: pendingAsset.type },
      pct
    );
    setPendingAsset(null);
    setPercentageInput('');
  }, [pendingAsset, percentageInput, addRule, accountId]);

  const handleStartEdit = useCallback((rule: PacRule) => {
    setEditingRuleId(rule.id);
    setEditingValue(String(rule.percentage).replace('.', ','));
  }, []);

  const handleConfirmEdit = useCallback(async () => {
    if (!editingRuleId) return;

    const pct = parseEuropeanDecimal(editingValue);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast.error('Inserisci una percentuale valida (1-100)');
      return;
    }

    await updateRule(editingRuleId, pct);
    setEditingRuleId(null);
    setEditingValue('');
  }, [editingRuleId, editingValue, updateRule]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingRuleId) return;
    await deleteRule(deletingRuleId);
    setDeletingRuleId(null);
  }, [deletingRuleId, deleteRule]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="mt-3 border-t border-warmBg-tertiary/50 pt-3">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-1.5 group"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-warmData-investment uppercase tracking-wider">
            Piano di Accumulo (PAC)
          </span>
          {activeRulesCount > 0 && !isExpanded && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-warmData-investment/20 text-warmData-investment rounded-full">
              {activeRulesCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-warmText-tertiary group-hover:text-warmText-secondary transition-colors" />
        ) : (
          <ChevronDown className="w-4 h-4 text-warmText-tertiary group-hover:text-warmText-secondary transition-colors" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-3 animate-cardEnter">
          {/* Progress Bar */}
          {rules.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-warmText-tertiary">
                  Allocazione
                </span>
                <span className={`text-[10px] font-bold ${totalPercentage > 100 ? 'text-warmData-expense' : 'text-warmText-secondary'}`}>
                  {totalPercentage}%
                  <span className="text-warmText-muted font-normal"> / 100%</span>
                </span>
              </div>
              <div className="w-full h-2 bg-warmBg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    totalPercentage > 100
                      ? 'bg-warmData-expense'
                      : totalPercentage === 100
                        ? 'bg-warmData-income'
                        : 'bg-warmData-investment'
                  }`}
                  style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="py-3 text-center">
              <p className="text-xs text-warmText-tertiary">
                Nessuna regola PAC configurata
              </p>
              <p className="text-[10px] text-warmText-muted mt-0.5">
                Aggiungi asset per automatizzare gli acquisti al deposito
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl transition-colors ${
                    rule.is_active ? 'bg-warmBg-tertiary/50' : 'bg-warmBg-tertiary/20 opacity-60'
                  }`}
                >
                  {/* Asset info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-warmText-primary">
                        {rule.asset_symbol}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                          TYPE_BADGE_STYLES[rule.asset_type] ?? TYPE_BADGE_STYLES.stock
                        }`}
                      >
                        {TYPE_LABELS[rule.asset_type] ?? rule.asset_type}
                      </span>
                    </div>
                    <p className="text-[10px] text-warmText-tertiary truncate">
                      {rule.asset_name}
                    </p>
                  </div>

                  {/* Percentage (editable) */}
                  {editingRuleId === rule.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmEdit();
                          if (e.key === 'Escape') {
                            setEditingRuleId(null);
                            setEditingValue('');
                          }
                        }}
                        className="w-14 h-8 bg-warmBg-tertiary rounded-lg px-2 text-warmText-primary text-base md:text-sm text-right focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
                        autoFocus
                      />
                      <span className="text-xs text-warmText-tertiary">%</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(rule)}
                      className="px-2 py-1 text-sm font-bold text-warmData-investment hover:bg-warmData-investment/10 rounded-lg transition-colors"
                    >
                      {rule.percentage}%
                    </button>
                  )}

                  {/* Toggle */}
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      rule.is_active ? 'bg-warmData-investment' : 'bg-warmBg-tertiary'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                        rule.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeletingRuleId(rule.id)}
                    className="w-8 h-8 flex items-center justify-center text-warmText-muted hover:text-warmData-expense hover:bg-warmData-expense/10 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Info message: remaining as liquidity */}
          {rules.length > 0 && totalPercentage < 100 && totalPercentage > 0 && (
            <div className="flex items-start gap-2 px-2 py-2 rounded-xl bg-warmData-investment/5">
              <Info className="w-3.5 h-3.5 text-warmData-investment flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-warmText-secondary leading-relaxed">
                Il <span className="font-bold text-warmData-investment">{remainingPercentage}%</span> restante
                rimarr&agrave; come liquidit&agrave; nel conto
              </p>
            </div>
          )}

          {/* Error: over 100% */}
          {totalPercentage > 100 && (
            <div className="flex items-start gap-2 px-2 py-2 rounded-xl bg-warmData-expense/10">
              <Info className="w-3.5 h-3.5 text-warmData-expense flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-warmData-expense font-medium leading-relaxed">
                La somma delle percentuali supera il 100%. Riduci alcune percentuali.
              </p>
            </div>
          )}

          {/* Pending Asset: percentage input */}
          {pendingAsset && (
            <div className="p-3 rounded-xl bg-warmData-investment/10 border border-warmData-investment/20 space-y-2 animate-cardEnter">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-warmText-primary">
                    {pendingAsset.symbol}
                  </span>
                  <span className="text-xs text-warmText-tertiary ml-2">
                    {pendingAsset.name}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setPendingAsset(null);
                    setPercentageInput('');
                  }}
                  className="w-6 h-6 flex items-center justify-center text-warmText-tertiary hover:text-warmText-primary rounded-lg"
                >
                  &times;
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={percentageInput}
                  onChange={(e) => setPercentageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmAdd();
                    if (e.key === 'Escape') {
                      setPendingAsset(null);
                      setPercentageInput('');
                    }
                  }}
                  placeholder={`Max ${remainingPercentage}%`}
                  className="flex-1 h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
                  autoFocus
                />
                <span className="text-sm text-warmText-tertiary">%</span>
                <button
                  onClick={handleConfirmAdd}
                  className="h-11 px-4 bg-warmData-investment text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Aggiungi
                </button>
              </div>
            </div>
          )}

          {/* Add Asset button */}
          {!pendingAsset && (
            <button
              onClick={() => setShowAssetSearch(true)}
              className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl bg-warmBg-tertiary hover:bg-warmBg-hover text-warmText-secondary text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Aggiungi asset
            </button>
          )}

          {/* Delete confirmation dialog */}
          {deletingRuleId && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
              <div className="w-full sm:max-w-sm bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 animate-sheetSlideUp sm:animate-cardEnter">
                <h3 className="text-base font-semibold text-warmText-primary mb-2">
                  Elimina regola PAC
                </h3>
                <p className="text-sm text-warmText-secondary mb-5">
                  Sei sicuro di voler eliminare questa regola? L&apos;azione non pu&ograve; essere annullata.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingRuleId(null)}
                    className="flex-1 h-11 bg-warmBg-tertiary text-warmText-primary rounded-xl text-sm font-medium hover:bg-warmBg-hover transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="flex-1 h-11 bg-warmData-expense text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Asset Search Modal */}
          <AssetSearchModal
            isOpen={showAssetSearch}
            onClose={() => setShowAssetSearch(false)}
            onSelect={handleAssetSelected}
          />
        </div>
      )}
    </div>
  );
}
