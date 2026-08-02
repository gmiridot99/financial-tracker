'use client';

import { Plus, X } from 'lucide-react';
import type { InvestmentAccountsHook } from './types';

interface CreateAccountFormProps {
  inv: InvestmentAccountsHook;
}

/** Inline "new account" form, toggled from a dashed placeholder button. */
export default function CreateAccountForm({ inv }: CreateAccountFormProps) {
  if (!inv.showCreateForm) {
    return (
      <button
        onClick={() => inv.setShowCreateForm(true)}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-warmBg-tertiary text-warmText-tertiary text-sm font-medium hover:border-warmData-investment hover:text-warmData-investment transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nuovo conto investimento
      </button>
    );
  }

  return (
    <div className="bg-warmBg-secondary rounded-2xl p-4 animate-cardEnter">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inv.newAccountName}
          onChange={(e) => inv.setNewAccountName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') inv.handleCreate();
            if (e.key === 'Escape') { inv.setShowCreateForm(false); inv.setNewAccountName(''); }
          }}
          placeholder="Nome del conto"
          className="flex-1 h-11 bg-warmBg-tertiary rounded-xl px-3 text-warmText-primary text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-warmData-investment focus:ring-opacity-50"
          autoFocus
        />
        <button
          onClick={inv.handleCreate}
          className="h-11 px-4 bg-warmData-investment text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Crea
        </button>
        <button
          onClick={() => { inv.setShowCreateForm(false); inv.setNewAccountName(''); }}
          className="w-11 h-11 flex items-center justify-center text-warmText-tertiary hover:bg-warmBg-tertiary rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
