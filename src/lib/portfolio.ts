import type { MarketPrice } from '@/lib/market-prices';

export interface PortfolioTransaction {
  asset_symbol: string;
  asset_name: string;
  asset_type: string;
  transaction_type: 'buy' | 'sell';
  quantity: number;
  price_per_unit: number;
  total_amount: number;
}

export interface Holding {
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  avgPrice: number;
  costBasis: number;
}

/**
 * Compute current holdings from a list of investment transactions.
 * Groups by asset_symbol, sums buy quantities - sell quantities.
 * Only returns holdings where quantity > 0.
 */
export function computeHoldings(transactions: PortfolioTransaction[]): Holding[] {
  const holdingMap = new Map<string, {
    name: string;
    type: string;
    totalBuyQty: number;
    totalBuyCost: number;
    totalSellQty: number;
  }>();

  for (const txn of transactions) {
    const existing = holdingMap.get(txn.asset_symbol) || {
      name: txn.asset_name,
      type: txn.asset_type,
      totalBuyQty: 0,
      totalBuyCost: 0,
      totalSellQty: 0,
    };

    if (txn.transaction_type === 'buy') {
      existing.totalBuyQty += txn.quantity;
      existing.totalBuyCost += txn.total_amount;
    } else {
      existing.totalSellQty += txn.quantity;
    }

    existing.name = txn.asset_name;
    holdingMap.set(txn.asset_symbol, existing);
  }

  const holdings: Holding[] = [];
  for (const [symbol, data] of holdingMap) {
    const quantity = data.totalBuyQty - data.totalSellQty;
    if (quantity <= 0) continue;

    const avgPrice = data.totalBuyQty > 0
      ? Math.round((data.totalBuyCost / data.totalBuyQty) * 100) / 100
      : 0;
    const costBasis = Math.round(avgPrice * quantity * 100) / 100;

    holdings.push({
      symbol,
      name: data.name,
      type: data.type,
      quantity: Math.round(quantity * 100000000) / 100000000,
      avgPrice,
      costBasis,
    });
  }

  return holdings;
}

// ── P/L Calculation ──────────────────────────────────────────────────

export interface HoldingWithPL extends Holding {
  /** qty * current market price (null if price unavailable) */
  marketValue: number | null;
  /** marketValue - costBasis (null if price unavailable) */
  unrealizedPL: number | null;
  /** ((marketValue - costBasis) / costBasis) * 100 (null if price unavailable or costBasis is 0) */
  unrealizedPLPercent: number | null;
}

/**
 * Enriches holdings with market value and unrealized P/L data.
 * When a market price is not available for a holding, the P/L fields are null.
 */
export function computeHoldingsWithPL(
  holdings: Holding[],
  marketPrices: Map<string, MarketPrice>
): HoldingWithPL[] {
  return holdings.map((h) => {
    const price = marketPrices.get(h.symbol);

    // Manual assets: use average buy price as current price (P&L = 0)
    if (h.type === 'manual' && !price) {
      return {
        ...h,
        marketValue: h.costBasis,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
      };
    }

    if (!price) {
      return {
        ...h,
        marketValue: null,
        unrealizedPL: null,
        unrealizedPLPercent: null,
      };
    }

    const marketValue = Math.round(h.quantity * price.priceEur * 100) / 100;
    const unrealizedPL = Math.round((marketValue - h.costBasis) * 100) / 100;
    const unrealizedPLPercent = h.costBasis > 0
      ? Math.round(((marketValue - h.costBasis) / h.costBasis) * 10000) / 100
      : null;

    return {
      ...h,
      marketValue,
      unrealizedPL,
      unrealizedPLPercent,
    };
  });
}
