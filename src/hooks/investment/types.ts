// ── Shared types & utilities for investment account hooks ──────────────

/** Raw transaction record with ID, used for edit/delete */
export interface RawTransaction {
  id: string;
  investment_account_id: string;
  asset_symbol: string;
  asset_name: string;
  asset_type: string;
  transaction_type: 'buy' | 'sell';
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  transaction_date: string;
}

export interface EditingTransaction {
  id: string;
  accountId: string;
  originalQuantity: number;
  originalPricePerUnit: number;
  originalTotalAmount: number;
  transactionType: 'buy' | 'sell';
  assetSymbol: string;
  quantity: string;
  pricePerUnit: string;
  transactionDate: string;
}

export interface InvestmentDistributionData {
  accountValues: { id: string; name: string; cashBalance: number; holdingsValue: number }[];
  assetValues: { name: string; value: number }[];
}

export interface UseInvestmentAccountsParams {
  userId: string;
  onAccountsChanged?: () => void;
  onTotalMarketValue?: (value: number, totalCostBasis: number) => void;
  onDistributionData?: (data: InvestmentDistributionData) => void;
  /** Optional callback invoked after a successful deposit. Used for PAC auto-execution. */
  pacExecutor?: (accountId: string, depositAmount: number) => Promise<void>;
}

/** Common dependencies shared by most write-operation helper functions. */
export interface OpsCommonDeps {
  userId: string;
  loadAccounts: () => Promise<void>;
  onAccountsChanged?: () => void;
}

// ── Utilities ────────────────────────────────────────────────────────

/** Parses a decimal string accepting both comma and dot as separator (European format). */
export function parseEuropeanDecimal(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

/** Formats a numeric value as EUR currency string in Italian locale (e.g. "1.234,56 €"). */
export function formatCurrency(value: number): string {
  return Number(value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
