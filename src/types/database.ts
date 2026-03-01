export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  savings_percentage: number;
  investments_percentage: number;
  currency: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense';
  is_default: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  is_recurring: boolean;
  frequency: 'monthly' | 'annual' | 'one-time';
  start_date: string;
  description: string;
  created_at: string;
  investment_account_id: string | null;
  savings_account_id: string | null;
  trigger_pac: boolean;
  from_savings_account_id?: string | null;
  to_savings_account_id?: string | null;
  status: 'pending' | 'active' | null;
}

export interface Transfer {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  note?: string | null;
  is_recurring: boolean;
  frequency?: 'monthly' | 'weekly' | 'yearly' | null;
  trigger_pac: boolean;
  from_savings_account_id?: string | null;
  to_savings_account_id?: string | null;
  to_investment_account_id?: string | null;
  created_at: string;
  status: 'pending' | 'active' | null;
}

export interface InvestmentCategory {
  id: string;
  user_id: string | null;
  name: string;
  expected_return_rate: number;
}

export interface InvestmentAllocation {
  id: string;
  user_id: string;
  month: number;
  year: number;
  investment_category_id: string;
  amount: number;
}

export interface WealthSnapshot {
  id: string;
  user_id: string;
  year: number;
  month: number;
  investments_balance: number;
  savings_balance: number;
  is_manual: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedSimulation {
  id: string;
  user_id: string;
  name: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SavingsAccount {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  created_at: string;
  sort_order: number;
  is_primary: boolean;
}

export interface SavingsTransfer {
  id: string;
  user_id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface InvestmentAccount {
  id: string;
  user_id: string;
  name: string;
  cash_balance: number;
  created_at: string;
  sort_order: number;
}

export interface InvestmentTransaction {
  id: string;
  user_id: string;
  investment_account_id: string;
  asset_symbol: string;
  asset_name: string;
  asset_type: 'stock' | 'etf' | 'crypto' | 'commodity' | 'bond' | 'manual';
  transaction_type: 'buy' | 'sell';
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  currency: string;
  transaction_date: string;
  created_at: string;
}

export interface AssetPriceCache {
  id: string;
  symbol: string;
  asset_type: string;
  current_price: number | null;
  price_currency: string;
  last_updated: string;
  coingecko_id: string | null;
}

export interface AssetPriceHistory {
  id: string;
  symbol: string;
  price_eur: number;
  price_date: string;
  created_at: string;
}

export interface PacRule {
  id: string;
  user_id: string;
  investment_account_id: string;
  asset_symbol: string;
  asset_name: string;
  asset_type: string;
  percentage: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}
