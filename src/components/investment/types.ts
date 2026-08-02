import type { useInvestmentAccounts } from '@/hooks/useInvestmentAccounts';

/** The full return value of `useInvestmentAccounts` — passed down to investment subcomponents. */
export type InvestmentAccountsHook = ReturnType<typeof useInvestmentAccounts>;

// ── UI constant maps (module scope, per project convention) ────────────

export const TYPE_BADGE_STYLES: Record<string, string> = {
  stock: 'bg-blue-500/20 text-blue-300',
  etf: 'bg-emerald-500/20 text-emerald-300',
  crypto: 'bg-orange-500/20 text-orange-300',
  index: 'bg-purple-500/20 text-purple-300',
  bond: 'bg-gray-500/20 text-gray-300',
  commodity: 'bg-amber-500/20 text-amber-300',
  manual: 'bg-warmText-tertiary/20 text-warmText-secondary',
};

export const TYPE_LABELS: Record<string, string> = {
  stock: 'Stock',
  etf: 'ETF',
  crypto: 'Crypto',
  index: 'Index',
  bond: 'Bond',
  commodity: 'Commodity',
  manual: 'Manuale',
};
