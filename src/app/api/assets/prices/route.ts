import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import YahooFinance from 'yahoo-finance2';
import { getAuthenticatedUser } from '@/lib/api-auth';

const yahooFinance = new YahooFinance();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PriceResult {
  price: number;
  currency: string;
}

function createSupabaseForUser(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '');

  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam || symbolsParam.trim() === '') {
    return NextResponse.json(
      { error: 'missing_symbols', code: 'MISSING_SYMBOLS', message: 'Query parameter "symbols" is required.' },
      { status: 400 }
    );
  }

  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: 'missing_symbols', code: 'MISSING_SYMBOLS', message: 'At least one valid symbol is required.' },
      { status: 400 }
    );
  }

  if (symbols.length > 50) {
    return NextResponse.json(
      { error: 'too_many_symbols', code: 'TOO_MANY_SYMBOLS', message: 'Maximum 50 symbols per request.' },
      { status: 400 }
    );
  }

  const supabaseServer = createSupabaseForUser(accessToken);
  const prices: Record<string, PriceResult> = {};
  const symbolsToFetch: string[] = [];
  const now = new Date();

  // Step 1: Check cache for each symbol
  try {
    const { data: cached } = await supabaseServer
      .from('asset_prices_cache')
      .select('symbol, current_price, price_currency, last_updated')
      .in('symbol', symbols);

    if (cached) {
      for (const row of cached) {
        if (row.current_price == null) continue;

        const lastUpdated = new Date(row.last_updated);
        const age = now.getTime() - lastUpdated.getTime();

        if (age < CACHE_TTL_MS) {
          // Cache is fresh - use cached price
          prices[row.symbol] = {
            price: Number(row.current_price),
            currency: row.price_currency ?? 'USD',
          };
        }
      }
    }
  } catch {
    // Cache read failed - proceed to fetch all from Yahoo
  }

  // Determine which symbols still need fetching
  for (const symbol of symbols) {
    if (!prices[symbol]) {
      symbolsToFetch.push(symbol);
    }
  }

  // Fetch EUR/USD exchange rate (always needed for conversion)
  let eurUsdRate: number | null = null;
  try {
    const fxQuote = await yahooFinance.quote('EURUSD=X');
    if (fxQuote && typeof fxQuote.regularMarketPrice === 'number') {
      eurUsdRate = fxQuote.regularMarketPrice;
    }
  } catch {
    // EUR/USD rate unavailable - will be null in response
  }

  // Step 2: Fetch from Yahoo Finance for stale/missing entries
  if (symbolsToFetch.length > 0) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    await Promise.allSettled(
      symbolsToFetch.map(async (symbol) => {
        try {
          const quote = await yahooFinance.quote(symbol);
          if (quote && typeof quote.regularMarketPrice === 'number') {
            const fetchedPrice = quote.regularMarketPrice;
            const fetchedCurrency = (quote.currency as string) || 'USD';

            prices[symbol] = {
              price: fetchedPrice,
              currency: fetchedCurrency,
            };

            // Upsert into asset_prices_cache
            try {
              await supabaseServer
                .from('asset_prices_cache')
                .upsert(
                  {
                    symbol,
                    asset_type: 'stock',
                    current_price: fetchedPrice,
                    price_currency: fetchedCurrency,
                    last_updated: new Date().toISOString(),
                  },
                  { onConflict: 'symbol' }
                );
            } catch {
              // Cache write failed - continue, price still returned
            }

            // Compute EUR price for history
            let priceEur: number;
            const currency = fetchedCurrency.toUpperCase();
            if (currency === 'EUR') {
              priceEur = fetchedPrice;
            } else if (currency === 'USD' && eurUsdRate && eurUsdRate > 0) {
              priceEur = fetchedPrice / eurUsdRate;
            } else {
              priceEur = fetchedPrice; // Fallback for other currencies
            }

            // Upsert into asset_price_history (one row per symbol per day)
            try {
              await supabaseServer
                .from('asset_price_history')
                .upsert(
                  {
                    symbol,
                    price_eur: Math.round(priceEur * 10000) / 10000,
                    price_date: today,
                  },
                  { onConflict: 'symbol,price_date' }
                );
            } catch {
              // History write failed - non-critical
            }
          }
        } catch {
          // Skip this symbol silently - it will be absent from the prices object
        }
      })
    );
  }

  return NextResponse.json({
    prices,
    eurUsdRate,
  });
}
