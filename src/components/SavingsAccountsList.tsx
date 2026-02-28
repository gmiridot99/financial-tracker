'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, PiggyBank, ArrowLeftRight, Wallet, Shield, Landmark, Building2 } from 'lucide-react';
import CountUp from '@/components/CountUp';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useSavingsAccounts } from '@/hooks/useSavingsAccounts';
import type { SavingsAccount } from '@/types/database';

// ── UI Constants (module-level) ─────────────────────────────────────

const SAVINGS_CARD_COLORS = [
  { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', text: '#3b82f6' },  // blue-500
  { border: '#06b6d4', bg: 'rgba(6,182,212,0.08)', text: '#06b6d4' },   // cyan-500
  { border: '#14b8a6', bg: 'rgba(20,184,166,0.08)', text: '#14b8a6' },  // teal-500
  { border: '#10b981', bg: 'rgba(16,185,129,0.08)', text: '#10b981' },  // emerald-500
  { border: '#6366f1', bg: 'rgba(99,102,241,0.08)', text: '#6366f1' },  // indigo-500
];

const SAVINGS_ICONS = [PiggyBank, Wallet, Shield, Landmark];

// ── Props ───────────────────────────────────────────────────────────

/**
 * @prop userId - ID utente autenticato
 * @prop onAccountsChanged - Callback dopo ogni operazione DB riuscita
 */
interface SavingsAccountsListProps {
  userId: string;
  onAccountsChanged?: () => void;
}

// ── Component ───────────────────────────────────────────────────────

/**
 * Lista dei conti risparmio con card colorate e form inline per deposito e trasferimento.
 *
 * Tutta la business logic e delegata a `useSavingsAccounts`; questo componente
 * e puro JSX + costanti UI (palette colori, icone).
 */
export default function SavingsAccountsList({ userId, onAccountsChanged }: SavingsAccountsListProps) {
  const {
    accounts,
    isLoading,
    showCreateForm, setShowCreateForm,
    newAccountName, setNewAccountName,
    editingId, setEditingId,
    editingName, setEditingName,
    transferringId, setTransferringId,
    transferAmount, setTransferAmount,
    transferDestination, setTransferDestination,
    handleCreate,
    handleEditName,
    handleDelete,
    handleSetPrimary,
    handleTransfer,
    editingBalanceId, setEditingBalanceId,
    editingBalanceValue, setEditingBalanceValue,
    handleEditBalance,
    formatCurrency,
  } = useSavingsAccounts({ userId, onAccountsChanged });

  const [deletingAccount, setDeletingAccount] = useState<SavingsAccount | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-warmText-tertiary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Create Button */}
      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full mb-4 py-3 px-4 bg-warmBg-secondary rounded-2xl border border-dashed border-warmText-muted text-warmText-secondary text-sm font-medium hover:border-warmData-savings hover:text-warmData-savings transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuovo conto risparmio
        </button>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="mb-4 bg-warmBg-secondary rounded-2xl p-4 animate-cardEnter">
          <input
            type="text"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Nome del conto..."
            className="w-full h-11 bg-warmBg-tertiary rounded-xl px-4 text-warmText-primary placeholder-warmText-muted text-sm focus:outline-none focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-50 mb-3"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setShowCreateForm(false);
                setNewAccountName('');
              }
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newAccountName.trim()}
              className="flex-1 h-10 bg-warmData-savings text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Salva
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewAccountName('');
              }}
              className="h-10 px-4 bg-warmBg-tertiary text-warmText-secondary rounded-lg text-sm font-medium hover:bg-warmBg-hover transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      {accounts.length === 0 && !showCreateForm ? (
        <div className="text-center py-12">
          <PiggyBank className="w-12 h-12 text-warmText-muted mx-auto mb-3" />
          <p className="text-warmText-tertiary text-sm">Nessun conto risparmio. Crea il primo!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account, index) => {
            const colorScheme = SAVINGS_CARD_COLORS[index % SAVINGS_CARD_COLORS.length];
            const IconComponent = account.is_primary ? Building2 : SAVINGS_ICONS[index % SAVINGS_ICONS.length];

            return (
            <div
              key={account.id}
              className="bg-warmBg-secondary rounded-2xl p-4 animate-cardEnter transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/20 cursor-default"
              style={{ borderLeft: `4px solid ${colorScheme.border}` }}
            >
              {/* Account Header */}
              <div className="flex items-center justify-between">
                {/* Icon + Name (editable) */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Account type icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: colorScheme.bg }}
                  >
                    <IconComponent className="w-4.5 h-4.5" style={{ color: colorScheme.text, width: '18px', height: '18px' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                  {editingId === account.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 h-9 bg-warmBg-tertiary rounded-lg px-3 text-warmText-primary text-sm focus:outline-none focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-50"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditName(account.id);
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditingName('');
                          }
                        }}
                        onBlur={() => handleEditName(account.id)}
                      />
                      <button
                        onClick={() => handleEditName(account.id)}
                        className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center text-warmData-savings hover:bg-warmBg-tertiary rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                        className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-warmText-primary truncate">
                          {account.name}
                        </span>
                        {account.is_primary && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-warmData-savings bg-opacity-15 text-warmData-savings text-xs font-medium">
                            Principale
                          </span>
                        )}
                        {!account.is_primary && (
                          <button
                            onClick={() => handleSetPrimary(account.id)}
                            className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-warmBg-tertiary text-warmText-tertiary text-xs font-medium hover:bg-warmData-savings hover:bg-opacity-15 hover:text-warmData-savings transition-colors"
                          >
                            Rendi principale
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(account.id);
                            setEditingName(account.name);
                          }}
                          className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center text-warmText-muted hover:text-warmText-secondary hover:bg-warmBg-tertiary rounded-lg transition-colors flex-shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs leading-tight text-warmText-tertiary mt-0.5">
                        Creato il {format(new Date(account.created_at), 'd MMM yyyy', { locale: it })}
                      </p>
                    </div>
                  )}
                  </div>
                </div>

                {/* Delete (hidden for primary account) */}
                {!account.is_primary && (
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => setDeletingAccount(account)}
                      className="w-7 h-7 flex items-center justify-center text-warmText-muted hover:text-warmData-expense hover:bg-warmBg-tertiary rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Prominent Balance */}
              <div
                className="mt-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: colorScheme.bg }}
              >
                <p className="text-xs leading-tight uppercase tracking-wider text-warmText-tertiary mb-1">Saldo</p>
                {editingBalanceId === account.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editingBalanceValue}
                      onChange={(e) => setEditingBalanceValue(e.target.value)}
                      className="flex-1 h-9 bg-warmBg-secondary rounded-lg px-3 text-warmText-primary text-base font-bold text-right focus:outline-none focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditBalance(account.id);
                        if (e.key === 'Escape') {
                          setEditingBalanceId(null);
                          setEditingBalanceValue('');
                        }
                      }}
                    />
                    <button
                      onClick={() => handleEditBalance(account.id)}
                      className="w-8 h-8 flex items-center justify-center text-warmData-savings hover:bg-warmBg-secondary rounded-lg transition-colors flex-shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingBalanceId(null);
                        setEditingBalanceValue('');
                      }}
                      className="w-8 h-8 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-secondary rounded-lg transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-warmText-primary flex-1">
                      <CountUp end={Number(account.balance)} />
                    </p>
                    <button
                      onClick={() => {
                        setEditingBalanceId(account.id);
                        setEditingBalanceValue(Number(account.balance).toFixed(2).replace('.', ','));
                      }}
                      className="w-7 h-7 flex items-center justify-center text-warmText-muted hover:text-warmText-secondary hover:bg-warmBg-secondary rounded-lg transition-colors flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {editingId !== account.id && editingBalanceId !== account.id && transferringId !== account.id && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-warmBg-tertiary">
                  <button
                    onClick={() => {
                      setTransferringId(account.id);
                      setTransferAmount('');
                      setTransferDestination('');
                    }}
                    className="flex-1 h-9 bg-warmBg-tertiary rounded-lg text-xs font-medium text-warmText-secondary hover:bg-warmBg-hover transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Trasferisci
                  </button>
                </div>
              )}

              {/* Transfer Form */}
              {transferringId === account.id && (
                <div className="mt-3 pt-3 border-t border-warmBg-tertiary space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-warmText-tertiary">
                      Da {account.name} (disponibili: {formatCurrency(Number(account.balance))})
                    </p>
                    <button
                      type="button"
                      onClick={() => setTransferAmount(Number(account.balance).toFixed(2).replace('.', ','))}
                      className="text-xs leading-tight font-semibold text-warmAccent-primary hover:text-warmAccent-hover px-1.5 py-0.5 rounded bg-warmAccent-primary bg-opacity-10 hover:bg-opacity-20 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="Importo..."
                    className="w-full h-10 bg-warmBg-tertiary rounded-lg px-3 text-warmText-primary text-sm focus:outline-none focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-50"
                    autoFocus
                  />
                  <select
                    value={transferDestination}
                    onChange={(e) => setTransferDestination(e.target.value)}
                    className="w-full h-10 bg-warmBg-tertiary rounded-lg px-3 text-warmText-primary text-sm focus:outline-none focus:ring-2 focus:ring-warmData-savings focus:ring-opacity-50 appearance-none"
                  >
                    <option value="">Seleziona destinazione...</option>
                    {accounts
                      .filter(a => a.id !== account.id)
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTransfer(account)}
                      className="flex-1 h-10 bg-warmData-savings text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      Trasferisci
                    </button>
                    <button
                      onClick={() => {
                        setTransferringId(null);
                        setTransferAmount('');
                        setTransferDestination('');
                      }}
                      className="h-10 w-10 flex items-center justify-center bg-warmBg-tertiary text-warmText-tertiary rounded-lg hover:bg-warmBg-hover transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Delete Account Confirm */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-sm bg-warmBg-primary sm:rounded-2xl rounded-t-2xl p-6 animate-sheetSlideUp sm:animate-cardEnter">
            <h3 className="text-base font-semibold text-warmText-primary mb-2">
              Elimina conto
            </h3>
            <p className="text-sm text-warmText-secondary mb-1">
              Sei sicuro di voler eliminare &ldquo;{deletingAccount.name}&rdquo;?
            </p>
            {Number(deletingAccount.balance) > 0 && (
              <p className="text-sm text-warmData-expense font-medium mb-1">
                Il saldo di {formatCurrency(Number(deletingAccount.balance))} verra scartato.
              </p>
            )}
            <p className="text-xs text-warmText-tertiary mb-5">
              Questa azione non puo essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingAccount(null)}
                className="flex-1 h-11 bg-warmBg-tertiary text-warmText-primary rounded-xl text-sm font-medium hover:bg-warmBg-hover transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  handleDelete(deletingAccount);
                  setDeletingAccount(null);
                }}
                className="flex-1 h-11 bg-warmData-expense text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
