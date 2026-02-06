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
