export interface MarketPrice {
  symbol: string;
  priceEur: number;
  priceCurrency: string;
  rawPrice: number;
}

interface PriceEntry {
  price: number;
  currency: string;
}

interface PricesResponse {
  prices: Record<string, PriceEntry>;
  eurUsdRate: number | null;
}

interface CryptoPricesResponse {
  prices: Record<string, PriceEntry>;
}

/**
 * Fetches current market prices for the given symbols and converts them to EUR.
 *
 * Conversion logic:
 * - If the asset is already quoted in EUR, priceEur === rawPrice.
 * - If the asset is quoted in USD and we have a EUR/USD rate, we divide by that rate.
 * - For any other currency (GBP, CHF, etc.) we fall back to rawPrice as-is since
 *   we only fetch the EUR/USD cross. Callers should treat priceEur as approximate
 *   for non-EUR/non-USD assets.
 *
 * @param symbols - Array of asset symbols to look up
 * @param cryptoMap - Optional map of symbol -> CoinGecko ID for crypto assets
 * @param accessToken - Supabase JWT access token for authenticating the API routes
 */
export async function fetchMarketPrices(
  symbols: string[],
  cryptoMap?: Map<string, string>,
  accessToken?: string
): Promise<Map<string, MarketPrice>> {
  const result = new Map<string, MarketPrice>();

  if (symbols.length === 0) {
    return result;
  }

  // Split symbols into stock/ETF and crypto
  const stockSymbols: string[] = [];
  const cryptoSymbols: string[] = []; // symbols that have a coingecko_id mapping
  const symbolToCoingeckoId = new Map<string, string>();

  for (const symbol of symbols) {
    const coingeckoId = cryptoMap?.get(symbol);
    if (coingeckoId) {
      cryptoSymbols.push(symbol);
      symbolToCoingeckoId.set(symbol, coingeckoId);
    } else {
      stockSymbols.push(symbol);
    }
  }

  // Build a reverse map: coingecko_id -> symbol (for mapping results back)
  const coingeckoIdToSymbol = new Map<string, string>();
  for (const [symbol, id] of symbolToCoingeckoId) {
    coingeckoIdToSymbol.set(id, symbol);
  }

  // Fetch stock/ETF prices and crypto prices in parallel
  const [stockResult, cryptoResult] = await Promise.allSettled([
    stockSymbols.length > 0 ? fetchStockPrices(stockSymbols, accessToken) : Promise.resolve(null),
    cryptoSymbols.length > 0
      ? fetchCryptoPrices([...new Set(symbolToCoingeckoId.values())], accessToken)
      : Promise.resolve(null),
  ]);

  // Process stock/ETF results
  if (stockResult.status === 'fulfilled' && stockResult.value) {
    const { data, eurUsdRate } = stockResult.value;

    for (const [symbol, entry] of Object.entries(data.prices)) {
      let priceEur: number;
      const currency = entry.currency.toUpperCase();

      if (currency === 'EUR') {
        priceEur = entry.price;
      } else if (currency === 'USD' && eurUsdRate && eurUsdRate > 0) {
        priceEur = entry.price / eurUsdRate;
      } else {
        priceEur = entry.price;
      }

      priceEur = Math.round(priceEur * 10000) / 10000;

      result.set(symbol, {
        symbol,
        priceEur,
        priceCurrency: currency,
        rawPrice: entry.price,
      });
    }
  }

  // Process crypto results
  if (cryptoResult.status === 'fulfilled' && cryptoResult.value) {
    const cryptoData = cryptoResult.value;

    for (const [coingeckoId, entry] of Object.entries(cryptoData.prices)) {
      const symbol = coingeckoIdToSymbol.get(coingeckoId);
      if (!symbol) continue;

      const priceEur = Math.round(entry.price * 10000) / 10000;

      result.set(symbol, {
        symbol,
        priceEur,
        priceCurrency: entry.currency.toUpperCase(),
        rawPrice: entry.price,
      });
    }
  }

  return result;
}

function authHeaders(accessToken?: string): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function fetchStockPrices(
  symbols: string[],
  accessToken?: string
): Promise<{ data: PricesResponse; eurUsdRate: number | null } | null> {
  try {
    const params = new URLSearchParams({ symbols: symbols.join(',') });
    const response = await fetch(`/api/assets/prices?${params.toString()}`, {
      headers: authHeaders(accessToken),
    });

    if (!response.ok) {
      return null;
    }

    const data: PricesResponse = await response.json();
    return { data, eurUsdRate: data.eurUsdRate };
  } catch {
    return null;
  }
}

async function fetchCryptoPrices(
  coingeckoIds: string[],
  accessToken?: string
): Promise<CryptoPricesResponse | null> {
  try {
    const params = new URLSearchParams({ ids: coingeckoIds.join(',') });
    const response = await fetch(`/api/assets/prices-crypto?${params.toString()}`, {
      headers: authHeaders(accessToken),
    });

    if (!response.ok) {
      return null;
    }

    const data: CryptoPricesResponse = await response.json();
    return data;
  } catch {
    return null;
  }
}
