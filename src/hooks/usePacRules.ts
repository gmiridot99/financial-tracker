'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PacRule } from '@/types/database';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────

interface UsePacRulesParams {
  userId: string;
}

interface AddRuleAsset {
  symbol: string;
  name: string;
  type: string;
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Gestisce stato, caricamento e operazioni CRUD per le regole PAC
 * (Piano di Accumulo Capitale).
 *
 * Side-effects:
 * - Carica le regole da Supabase al mount (e dopo ogni operazione).
 *
 * Validazione:
 * - La somma delle percentuali attive per un conto non può superare 100%.
 * - Duplicate asset per conto gestite tramite constraint DB (23505).
 *
 * @param params.userId - ID utente autenticato (filtro RLS)
 * @returns Stato (rules, isLoading) e action handlers (addRule, updateRule, deleteRule, toggleRule)
 */
export function usePacRules({ userId }: UsePacRulesParams) {
  // ── Core data ────────────────────────────────────────────────────
  const [rules, setRules] = useState<PacRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Data loading ─────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    const { data, error } = await supabase
      .from('pac_rules')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading PAC rules:', error);
      toast.error('Errore nel caricamento delle regole PAC');
      return;
    }

    setRules(data || []);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // ── Helpers ──────────────────────────────────────────────────────

  /**
   * Returns rules filtered by account ID from local state (no DB query).
   */
  const getRulesForAccount = useCallback(
    (accountId: string): PacRule[] => {
      return rules.filter(r => r.investment_account_id === accountId);
    },
    [rules]
  );

  /**
   * Returns the sum of active rule percentages for a given account.
   */
  const getTotalPercentage = useCallback(
    (accountId: string): number => {
      return rules
        .filter(r => r.investment_account_id === accountId && r.is_active)
        .reduce((sum, r) => sum + Number(r.percentage), 0);
    },
    [rules]
  );

  // ── CRUD Actions ─────────────────────────────────────────────────

  /**
   * Add a new PAC rule. Validates that the total active percentage
   * for the account won't exceed 100%.
   */
  const addRule = useCallback(
    async (accountId: string, asset: AddRuleAsset, percentage: number) => {
      if (percentage <= 0 || percentage > 100) {
        toast.error('La percentuale deve essere tra 0 e 100');
        return;
      }

      // Validate sum won't exceed 100%
      const currentTotal = getTotalPercentage(accountId);
      if (currentTotal + percentage > 100) {
        const available = Math.round((100 - currentTotal) * 100) / 100;
        toast.error(
          `Percentuale totale supererebbe 100%. Disponibile: ${available}%`
        );
        return;
      }

      const { error } = await supabase.from('pac_rules').insert({
        user_id: userId,
        investment_account_id: accountId,
        asset_symbol: asset.symbol,
        asset_name: asset.name,
        asset_type: asset.type,
        percentage,
      });

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          toast.error(
            'Questo asset è già presente nelle regole PAC di questo conto'
          );
        } else {
          console.error('Error adding PAC rule:', error);
          toast.error("Errore nell'aggiunta della regola PAC");
        }
        return;
      }

      toast.success(`Regola PAC aggiunta: ${asset.symbol} (${percentage}%)`);
      await loadRules();
    },
    [userId, getTotalPercentage, loadRules]
  );

  /**
   * Update a rule's percentage. Validates total won't exceed 100%.
   */
  const updateRule = useCallback(
    async (ruleId: string, percentage: number) => {
      if (percentage <= 0 || percentage > 100) {
        toast.error('La percentuale deve essere tra 0 e 100');
        return;
      }

      const rule = rules.find(r => r.id === ruleId);
      if (!rule) {
        toast.error('Regola non trovata');
        return;
      }

      // Calculate new total: current total minus old percentage plus new percentage
      // Only count active rules, but if the rule being updated is inactive,
      // the new percentage won't affect the active total validation
      const currentTotal = getTotalPercentage(rule.investment_account_id);
      const oldPercentage = rule.is_active ? Number(rule.percentage) : 0;
      const newPercentage = rule.is_active ? percentage : 0;

      if (currentTotal - oldPercentage + newPercentage > 100) {
        const available = Math.round(
          (100 - currentTotal + oldPercentage) * 100
        ) / 100;
        toast.error(
          `Percentuale totale supererebbe 100%. Massimo consentito: ${available}%`
        );
        return;
      }

      const { error } = await supabase
        .from('pac_rules')
        .update({ percentage })
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating PAC rule:', error);
        toast.error("Errore nell'aggiornamento della regola PAC");
        return;
      }

      toast.success('Percentuale aggiornata');
      await loadRules();
    },
    [userId, rules, getTotalPercentage, loadRules]
  );

  /**
   * Delete a PAC rule. No confirmation here; UI handles the confirm dialog.
   */
  const deleteRule = useCallback(
    async (ruleId: string) => {
      const { error } = await supabase
        .from('pac_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting PAC rule:', error);
        toast.error("Errore nell'eliminazione della regola PAC");
        return;
      }

      toast.success('Regola PAC eliminata');
      await loadRules();
    },
    [userId, loadRules]
  );

  /**
   * Toggle a rule's is_active flag. Validates that activating won't
   * push the total over 100%.
   */
  const toggleRule = useCallback(
    async (ruleId: string) => {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) {
        toast.error('Regola non trovata');
        return;
      }

      const newIsActive = !rule.is_active;

      // If activating, validate total won't exceed 100%
      if (newIsActive) {
        const currentTotal = getTotalPercentage(rule.investment_account_id);
        if (currentTotal + Number(rule.percentage) > 100) {
          const available = Math.round((100 - currentTotal) * 100) / 100;
          toast.error(
            `Impossibile attivare: percentuale totale supererebbe 100%. Disponibile: ${available}%`
          );
          return;
        }
      }

      const { error } = await supabase
        .from('pac_rules')
        .update({ is_active: newIsActive })
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error toggling PAC rule:', error);
        toast.error("Errore nell'aggiornamento della regola PAC");
        return;
      }

      toast.success(newIsActive ? 'Regola attivata' : 'Regola disattivata');
      await loadRules();
    },
    [userId, rules, getTotalPercentage, loadRules]
  );

  // ── Return ───────────────────────────────────────────────────────

  return {
    rules,
    isLoading,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    getRulesForAccount,
    getTotalPercentage,
    loadRules,
  };
}
