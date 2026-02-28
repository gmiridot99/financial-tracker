import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/api-auth';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CoinGeckoPriceResponse {
  [id: string]: {
    eur?: number;
  };
}

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

  const idsParam = request.nextUrl.searchParams.get('ids');

  if (!idsParam || idsParam.trim() === '') {
    return NextResponse.json(
      { error: 'missing_ids', code: 'MISSING_IDS', message: 'Query parameter "ids" is required.' },
      { status: 400 }
    );
  }

  const ids = idsParam
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'missing_ids', code: 'MISSING_IDS', message: 'At least one valid CoinGecko ID is required.' },
      { status: 400 }
    );
  }

  if (ids.length > 50) {
    return NextResponse.json(
      { error: 'too_many_ids', code: 'TOO_MANY_IDS', message: 'Maximum 50 IDs per request.' },
      { status: 400 }
    );
  }

  const supabaseServer = createSupabaseForUser(accessToken);
  const prices: Record<string, PriceResult> = {};
  const idsToFetch: string[] = [];
  const now = new Date();

  // Step 1: Check cache for each id
  try {
    const { data: cached } = await supabaseServer
      .from('asset_prices_cache')
      .select('symbol, coingecko_id, current_price, price_currency, last_updated')
      .in('coingecko_id', ids);

    if (cached) {
      for (const row of cached) {
        if (!row.coingecko_id || row.current_price == null) continue;

        const lastUpdated = new Date(row.last_updated);
        const age = now.getTime() - lastUpdated.getTime();

        if (age < CACHE_TTL_MS) {
          // Cache is fresh
          prices[row.coingecko_id] = {
            price: Number(row.current_price),
            currency: row.price_currency ?? 'EUR',
          };
        }
      }
    }
  } catch {
    // Cache read failed - proceed to fetch all
  }

  // Determine which IDs still need fetching
  for (const id of ids) {
    if (!prices[id]) {
      idsToFetch.push(id);
    }
  }

  // Step 2: Fetch from CoinGecko for stale/missing entries
  if (idsToFetch.length > 0) {
    try {
      const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${idsToFetch.join(',')}&vs_currencies=eur`;
      const response = await fetch(cgUrl, {
        headers: { 'Accept': 'application/json' },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        return NextResponse.json(
          { error: 'rate_limit', message: 'CoinGecko rate limit reached. Try again later.' },
          {
            status: 429,
            headers: retryAfter ? { 'Retry-After': retryAfter } : {},
          }
        );
      }

      if (response.ok) {
        const data: CoinGeckoPriceResponse = await response.json();
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        for (const id of idsToFetch) {
          const priceData = data[id];
          if (priceData && typeof priceData.eur === 'number') {
            const priceEur = priceData.eur;
            prices[id] = { price: priceEur, currency: 'EUR' };

            // Upsert into asset_prices_cache
            try {
              await supabaseServer
                .from('asset_prices_cache')
                .upsert(
                  {
                    symbol: id.toUpperCase(),
                    coingecko_id: id,
                    asset_type: 'crypto',
                    current_price: priceEur,
                    price_currency: 'EUR',
                    last_updated: new Date().toISOString(),
                  },
                  { onConflict: 'symbol' }
                );
            } catch {
              // Cache write failed - continue, price still returned
            }

            // Upsert into asset_price_history (one row per symbol per day)
            try {
              await supabaseServer
                .from('asset_price_history')
                .upsert(
                  {
                    symbol: id.toUpperCase(),
                    price_eur: priceEur,
                    price_date: today,
                  },
                  { onConflict: 'symbol,price_date' }
                );
            } catch {
              // History write failed - non-critical
            }
          }
        }
      }
    } catch {
      // CoinGecko fetch failed - return whatever we have from cache
    }
  }

  return NextResponse.json({ prices });
}
